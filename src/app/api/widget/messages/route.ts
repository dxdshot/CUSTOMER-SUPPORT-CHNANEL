import { widgetMessageRequest } from "@/lib/widget-requests";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { widgetClient, widgetSite, type WidgetSite } from "@/lib/widget-admin";
import { DEFAULT_WELCOME, presetMessages, widgetSize } from "@/lib/widget-copy";

/*
 * Widget backend: the embed script ships dependency-free, so it talks to
 * these routes instead of Supabase directly (D27).
 *
 *   GET  /api/widget/messages?site=KEY&visitor=VID[&conversation=ID]
 *        → { messages, meta }
 *   POST /api/widget/messages {site, visitor, id, body, context, identity, attachment}
 *        → WidgetMessage
 *
 * GET returns the latest conversation whatever its status, so a closed chat
 * can still show its transcript and the CSAT prompt (D31).
 */

type WidgetMessage = {
  id: string;
  author: "visitor" | "agent";
  agentId?: string;
  authorName?: string;
  authorAvatar?: string;
  isAutomated?: boolean;
  body: string;
  createdAt: string;
  attachment?: { url: string; name: string; size: string; kind: "image" | "file" };
};

type DbMessage = {
  id: string;
  author: "visitor" | "agent";
  body: string;
  created_at: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_avatar: string | null;
  is_automated: boolean;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: string | null;
  attachment_type: string | null;
  conversation_id?: string;
};

type DbConversation = {
  id: string;
  status: string;
  visitor_name: string | null;
  visitor_email: string | null;
  agent_last_read_at: string | null;
  csat: string | null;
  tags: string[] | null;
  journey: JourneyStep[] | null;
  last_agent_id?: string | null;
};

const MESSAGE_COLUMNS =
  "id, author, body, created_at, agent_id, agent_name, agent_avatar, is_automated, attachment_url, attachment_name, attachment_size, attachment_type";
const CONVERSATION_COLUMNS =
  "id, status, visitor_name, visitor_email, agent_last_read_at, csat, tags, journey, last_agent_id";
// The visitor prompt is one automated message per conversation (D47).
const TOPIC_PROMPT = "What best describes your problem?";
// An agent is online while their dashboard tab heartbeats (D39).
const AGENT_ONLINE_MS = 90_000;

function toWidgetMessage(row: DbMessage): WidgetMessage {
  return {
    id: row.id,
    author: row.author,
    agentId: row.author === "agent" ? (row.agent_id ?? undefined) : undefined,
    authorName: row.author === "agent" ? (row.agent_name?.trim() || "Support") : undefined,
    authorAvatar: row.author === "agent" ? (row.agent_avatar?.trim() || undefined) : undefined,
    isAutomated: row.is_automated,
    body: row.body,
    createdAt: row.created_at,
    attachment: row.attachment_url
      ? {
          url: row.attachment_url,
          name: row.attachment_name ?? "Attachment",
          size: row.attachment_size ?? "",
          kind: row.attachment_type === "image" ? "image" : "file",
        }
      : undefined,
  };
}

async function latestConversation(
  supabase: SupabaseClient,
  siteId: string,
  visitorId: string,
) {
  const { data } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("site_id", siteId)
    .eq("visitor_id", visitorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DbConversation | null) ?? null;
}

function onlineNow(site: WidgetSite): boolean {
  if (!site.agent_online_at) return false;
  if (Date.now() - new Date(site.agent_online_at).getTime() > 120_000) return false;
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: site.timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    );
    return hour >= site.hours_start && hour < site.hours_end;
  } catch {
    return true;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}

export async function GET(request: NextRequest) {
  const siteKey = request.nextUrl.searchParams.get("site") ?? "";
  const visitor = request.nextUrl.searchParams.get("visitor") ?? "";
  const requested = request.nextUrl.searchParams.get("conversation") ?? "";
  const afterParam = request.nextUrl.searchParams.get("after") ?? "";
  const after = afterParam && !Number.isNaN(Date.parse(afterParam)) ? afterParam : "";
  const metaOnly = request.nextUrl.searchParams.get("meta") === "1";
  if (!siteKey || !visitor) {
    return NextResponse.json({ error: "Missing site or visitor" }, { status: 400 });
  }
  const supabase = widgetClient();
  const site = await widgetSite(siteKey);
  if (!supabase || !site) {
    return NextResponse.json(
      { error: supabase ? "Unknown site" : "Chat backend is not configured" },
      { status: supabase ? 404 : 503 },
    );
  }

  let conversation = await latestConversation(supabase, site.id, visitor);
  const latestId = conversation?.id ?? null;
  const onlineSince = new Date(Date.now() - AGENT_ONLINE_MS).toISOString();
  // Most recent agent wins the public away line; online is derived from its heartbeat.
  const { data: agentRows } = await supabase
    .from("agents")
    .select("id, name, avatar_url, away_message, last_seen_at")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(20);
  const agents = ((agentRows ?? []) as {
    id: string;
    name: string | null;
    avatar_url: string | null;
    away_message: string | null;
    last_seen_at: string | null;
  }[]);
  // One workspace identity (D58): ignore rows left behind by pre-shared-profile
  // tabs. Fall back to the old behaviour until the shared row has been seeded.
  const workspaceAgentId = `agent-${site.site_key}`;
  const sharedAgents = agents.filter((agent) => agent.id === workspaceAgentId);
  const activeAgents = sharedAgents.length > 0 ? sharedAgents : agents;
  const onlineAgents = activeAgents
    .filter((agent) => agent.last_seen_at && agent.last_seen_at > onlineSince)
    .map((agent) => ({ id: agent.id, name: agent.name || "Agent", avatar: agent.avatar_url || undefined }));
  const supportAgent = activeAgents[0]
    ? { id: activeAgents[0].id, name: activeAgents[0].name || "Agent", avatar: activeAgents[0].avatar_url || undefined }
    : null;
  // Prefer the agent who replied last; otherwise the most recently active one.
  const awayFor = (agentId?: string | null) => {
    const match = agentId ? activeAgents.find((agent) => agent.id === agentId) : undefined;
    return (
      match?.away_message?.trim() ||
      activeAgents[0]?.away_message?.trim() ||
      site.away_message?.trim() ||
      "We'll reply as soon as possible"
    );
  };

  if (requested) {
    const { data } = await supabase
      .from("conversations")
      .select(CONVERSATION_COLUMNS)
      .eq("id", requested)
      .eq("site_id", site.id)
      .eq("visitor_id", visitor)
      .maybeSingle();
    if (data) conversation = data as DbConversation;
  }

  if (!conversation) {
    return NextResponse.json({
      messages: [],
      meta: {
        conversationId: null,
        latestConversationId: null,
        status: "open",
        agentLastReadAt: null,
        agentTyping: false,
        online: onlineNow(site),
        awayMessage: awayFor(null),
        welcomeMessage: site.welcome_message?.trim() || DEFAULT_WELCOME,
        welcomeNotify: Boolean(site.welcome_notify),
        widgetSize: widgetSize(site.widget_size),
        presetMessages: presetMessages(site.preset_messages),
        topicOptions: site.tags,
        conversationTags: [],
        onlineAgents,
        supportAgent,
        csat: null,
        visitorName: null,
        visitorEmail: null,
        identified: false,
        agentsViewing: [],
        typingAgent: null,
      },
    });
  }

  const since = new Date(Date.now() - 30_000).toISOString();
  const messageQuery = supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });
  if (after) messageQuery.gt("created_at", after);
  const messagesPromise = metaOnly
    ? Promise.resolve({ data: [] as DbMessage[], error: null })
    : messageQuery;
  const [{ data: rows, error }, { data: typing }, { data: viewers }] =
    await Promise.all([
      messagesPromise,
      supabase
        .from("typing")
        .select("agent_typing_at, agent_id, agent_name, agent_avatar")
        .eq("conversation_id", conversation.id)
        .maybeSingle(),
      supabase
        .from("conversation_viewers")
        .select("agent_id, name, avatar_url")
        .eq("conversation_id", conversation.id)
        .gt("last_seen_at", since),
    ]);
  if (error) return NextResponse.json({ error: "Could not load messages" }, { status: 500 });

  const agentTypingAt = typing?.agent_typing_at ? new Date(typing.agent_typing_at).getTime() : 0;
  const agentTyping = agentTypingAt > 0 && Date.now() - agentTypingAt < 5000;
  return NextResponse.json({
    messages: (rows as DbMessage[]).map(toWidgetMessage),
    meta: {
      conversationId: conversation.id,
      latestConversationId: latestId,
      status: conversation.status === "closed" ? "closed" : "open",
      agentLastReadAt: conversation.agent_last_read_at,
      agentTyping,
      typingAgent: agentTyping
        ? {
            id: (typing?.agent_id as string | null) ?? undefined,
            name: (typing?.agent_name as string | null) || "Support",
            avatar: (typing?.agent_avatar as string | null) || undefined,
          }
        : null,
      onlineAgents,
      supportAgent,
      online: onlineNow(site),
      awayMessage: awayFor(conversation.last_agent_id),
      welcomeMessage: site.welcome_message?.trim() || DEFAULT_WELCOME,
      welcomeNotify: Boolean(site.welcome_notify),
      widgetSize: widgetSize(site.widget_size),
      presetMessages: presetMessages(site.preset_messages),
      topicOptions: site.tags,
      conversationTags: conversation.tags ?? [],
      csat: conversation.csat === "good" || conversation.csat === "bad" ? conversation.csat : null,
      visitorName: conversation.visitor_name,
      visitorEmail: conversation.visitor_email,
      identified: Boolean(conversation.visitor_name || conversation.visitor_email),
      agentsViewing: (viewers ?? []).map((row) => ({
        id: (row.agent_id as string | null) || undefined,
        name: (row.name as string) || "Support",
        avatar: (row.avatar_url as string | null) || undefined,
      })),
    },
  });
}

type JourneyStep = { id: string; label: string; path: string; at: string };

const clean = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 160) : null;

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = widgetMessageRequest.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message request" }, { status: 400 });
  }
  const payload = parsed.data;
  const { site: siteKey, visitor, id, body, attachment } = payload;
  const client = widgetClient();
  const site = await widgetSite(siteKey);
  if (!client || !site) {
    return NextResponse.json(
      { error: client ? "Unknown site" : "Chat backend is not configured" },
      { status: client ? 404 : 503 },
    );
  }
  const preset = payload.presetQuestion
    ? presetMessages(site.preset_messages).find((item) => item.question === payload.presetQuestion && item.answer)
    : undefined;
  if (payload.presetQuestion && (!preset || body !== preset.question || attachment)) {
    return NextResponse.json({ error: "Preset question is unavailable" }, { status: 400 });
  }

  const countryCode = (request.headers.get("x-vercel-ip-country") ?? "").trim().toUpperCase().slice(0, 2);
  const flag = countryCode
    ? String.fromCodePoint(...[...countryCode].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : undefined;
  const page = clean(payload.context?.page);
  const now = new Date();
  const journeyStep: JourneyStep = {
    id: `j-${now.getTime()}`,
    label: page ? `Visited ${page.slice(0, 60)}` : "Opened the chat",
    path: page ?? "/",
    at: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };

  let conversation = await latestConversation(client, site.id, visitor);

  // A closed conversation starts a fresh row on the next visitor message, so
  // history stays intact and the inbox sees a new thread (D31).
  if (conversation && conversation.status === "closed") {
    conversation = null;
  }

  if (conversation) {
    const existingJourney = conversation.journey ?? [];
    const journey = [...existingJourney, journeyStep].slice(-20);
    const patch: Record<string, unknown> = {
      browser: clean(payload.context?.browser),
      os: clean(payload.context?.os),
      device: clean(payload.context?.device) ?? "desktop",
      timezone: clean(payload.context?.timezone),
      current_page: page,
      journey,
      updated_at: now.toISOString(),
    };
    Object.keys(patch).forEach((key) => patch[key] == null && delete patch[key]);
    if (countryCode) {
      patch.country = countryCode;
      patch.flag = flag;
    }
    if (clean(payload.identity?.name)) patch.visitor_name = clean(payload.identity?.name);
    if (clean(payload.identity?.email)) patch.visitor_email = clean(payload.identity?.email);
    await client.from("conversations").update(patch).eq("id", conversation.id);
  } else {
    const { data: created, error } = await client
      .from("conversations")
      .insert({
        site_id: site.id,
        visitor_id: visitor,
        visitor_name: clean(payload.identity?.name),
        visitor_email: clean(payload.identity?.email),
        browser: clean(payload.context?.browser),
        os: clean(payload.context?.os),
        device: clean(payload.context?.device) ?? "desktop",
        timezone: clean(payload.context?.timezone),
        current_page: page,
        country: countryCode || null,
        flag: flag || null,
        journey: [journeyStep],
      })
      .select(CONVERSATION_COLUMNS)
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Could not create the conversation" }, { status: 500 });
    }
    conversation = created as DbConversation;
  }

  // Ask once per conversation, after the first normal visitor message, when the
  // site has tags and the thread is still unclassified. The stable id makes
  // retries and follow-up messages no-ops, and the trigger keeps this automated
  // row out of the inbox preview (D47).
  const conversationId = conversation.id;
  const conversationTags = conversation.tags ?? [];
  const askTopicOnce = async () => {
    if (site.tags.length === 0 || conversationTags.length > 0) return;
    await client.from("messages").upsert(
      {
        id: `topic-ask-${conversationId}`,
        conversation_id: conversationId,
        author: "agent",
        agent_name: "Widget",
        is_automated: true,
        body: TOPIC_PROMPT,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  };

  // Idempotent without being destructive: a replayed id returns its original
  // visitor message; it can never overwrite an agent message or another
  // conversation's row (D37).
  const { data: existing } = await client
    .from("messages")
    .select(`${MESSAGE_COLUMNS}, conversation_id`)
    .eq("id", id)
    .maybeSingle();
  if (existing) {
    const row = existing as DbMessage;
    if (row.conversation_id !== conversation.id || row.author !== "visitor") {
      return NextResponse.json({ error: "Message id already belongs to another message" }, { status: 409 });
    }
    if (preset) {
      const { data: reply } = await client.from("messages").select(MESSAGE_COLUMNS)
        .eq("id", `preset-${id}`).eq("conversation_id", conversation.id).eq("is_automated", true).maybeSingle();
      if (!reply) return NextResponse.json({ error: "Preset reply is incomplete" }, { status: 409 });
      return NextResponse.json({ question: toWidgetMessage(row), answer: toWidgetMessage(reply as DbMessage) });
    }
    await askTopicOnce();
    return NextResponse.json(toWidgetMessage(row));
  }

  if (preset) {
    const { data: pair, error: pairError } = await client.from("messages")
      .insert([
        { id, conversation_id: conversation.id, author: "visitor", body: preset.question,
          is_automated: false, created_at: now.toISOString() },
        { id: `preset-${id}`, conversation_id: conversation.id, author: "agent", body: preset.answer,
          agent_name: "Widget", is_automated: true, created_at: new Date(now.getTime() + 1).toISOString() },
      ])
      .select(MESSAGE_COLUMNS);
    if (pairError || !pair || pair.length !== 2) {
      if (pairError?.code === "23505") {
        const { data: duplicate } = await client.from("messages").select(`${MESSAGE_COLUMNS}, conversation_id`)
          .in("id", [id, `preset-${id}`]).eq("conversation_id", conversation.id);
        const question = duplicate?.find((item) => item.id === id && item.author === "visitor");
        const answer = duplicate?.find((item) => item.id === `preset-${id}` && item.is_automated);
        if (question && answer) {
          return NextResponse.json({ question: toWidgetMessage(question as DbMessage), answer: toWidgetMessage(answer as DbMessage) });
        }
      }
      return NextResponse.json({ error: "Could not send the preset reply" }, { status: 500 });
    }
    const question = pair.find((item) => item.id === id);
    const answer = pair.find((item) => item.id === `preset-${id}`);
    if (!question || !answer) return NextResponse.json({ error: "Preset reply is incomplete" }, { status: 500 });
    return NextResponse.json({ question: toWidgetMessage(question as DbMessage), answer: toWidgetMessage(answer as DbMessage) });
  }

  const { data: row, error } = await client
    .from("messages")
    .insert({
      id,
      conversation_id: conversation.id,
      author: "visitor",
      body,
      attachment_url: attachment?.url ?? null,
      attachment_name: clean(attachment?.name),
      attachment_size: clean(attachment?.size),
      attachment_type: attachment?.type === "image" ? "image" : attachment ? "file" : null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error?.code === "23505") {
    const { data: duplicate } = await client
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("id", id)
      .eq("conversation_id", conversation.id)
      .eq("author", "visitor")
      .maybeSingle();
    if (duplicate) {
      await askTopicOnce();
      return NextResponse.json(toWidgetMessage(duplicate as DbMessage));
    }
  }
  if (error || !row) {
    return NextResponse.json({ error: "Could not send the message" }, { status: 500 });
  }

  await askTopicOnce();

  // last_message/updated_at are handled by the messages trigger (D35), so a
  // send costs one insert plus the one-time topic prompt after the conversation
  // lookup — no extra update.
  return NextResponse.json(toWidgetMessage(row as DbMessage));
}
