import { widgetStateRequest } from "@/lib/widget-requests";
import { NextResponse, type NextRequest } from "next/server";
import { widgetClient, widgetSite } from "@/lib/widget-admin";

/*
 * Widget state actions (D31): read receipts, typing, CSAT, identity, and
 * starting a fresh conversation. One route — each action is a small update,
 * keeping the widget transport thin.
 */

const TOPIC_ACK = "Thanks — we'll get back to you as soon as possible.";

async function resolve(siteKey: string, visitorId: string, conversationId?: string) {
  const client = widgetClient();
  if (!client) return { error: "Chat backend is not configured", status: 503 as const };
  const site = await widgetSite(siteKey);
  if (!site) return { error: "Unknown site", status: 404 as const };
  const query = client
    .from("conversations")
    .select(
      "id, status, visitor_name, visitor_email, country, flag, browser, os, device, timezone, current_page, tags",
    )
    .eq("site_id", site.id)
    .eq("visitor_id", visitorId);
  // Target the conversation the widget is actually showing; history actions
  // must never touch a different thread (D37).
  const { data: conversation, error } = conversationId
    ? await query.eq("id", conversationId).maybeSingle()
    : await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { error: "Could not load the conversation", status: 503 as const };
  return { client, siteId: site.id as string, conversation };
}

const clean = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 160) : null;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = widgetStateRequest.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid state request" }, { status: 400 });
  }
  const payload = parsed.data;
  const { site: siteKey, visitor, action } = payload;

  const resolved = await resolve(siteKey, visitor, action === "new" ? undefined : payload.conversation);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { client, siteId, conversation } = resolved;
  const now = new Date().toISOString();

  if (action === "new") {
    if (conversation?.status === "open") {
      const { error } = await client.from("conversations").update({ status: "closed", updated_at: now }).eq("id", conversation.id);
      if (error) return NextResponse.json({ error: "Could not close the conversation" }, { status: 503 });
    }
    // Carry identity + device context into the fresh thread so the visitor is
    // not asked who they are again (D31).
    const { data: created, error } = await client
      .from("conversations")
      .insert({
        site_id: siteId,
        visitor_id: visitor,
        visitor_name: conversation?.visitor_name ?? null,
        visitor_email: conversation?.visitor_email ?? null,
        country: conversation?.country ?? null,
        flag: conversation?.flag ?? null,
        browser: conversation?.browser ?? null,
        os: conversation?.os ?? null,
        device: conversation?.device ?? null,
        timezone: conversation?.timezone ?? null,
        current_page: conversation?.current_page ?? null,
      })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: "Could not start a conversation" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, conversationId: created.id });
  }

  if (!conversation) return NextResponse.json({ ok: true });

  let writeError: { message: string } | null = null;
  switch (action) {
    case "read":
      ({ error: writeError } = await client
        .from("conversations")
        .update({ visitor_last_read_at: now })
        .eq("id", conversation.id));
      break;
    case "typing":
      ({ error: writeError } = await client.from("typing").upsert(
        {
          conversation_id: conversation.id,
          visitor_typing_at: payload.value === "false" ? null : now,
        },
        { onConflict: "conversation_id" },
      ));
      break;
    case "tag": {
      // The widget only sends a name from its current topicOptions; verify it
      // still exists before touching the conversation (a tag may have been
      // removed between the poll and the click). Re-selecting is a no-op.
      const { data: tagRow } = await client
        .from("tags")
        .select("name")
        .eq("site_id", siteId)
        .eq("name", payload.value)
        .maybeSingle();
      if (!tagRow) return NextResponse.json({ error: "Unknown topic" }, { status: 409 });
      const current = Array.isArray(conversation.tags) ? (conversation.tags as string[]) : [];
      const name = String(tagRow.name);
      if (!current.includes(name)) {
        ({ error: writeError } = await client
          .from("conversations")
          .update({ tags: [...current, name] })
          .eq("id", conversation.id));
      }
      // One confirmation per conversation, even if the visitor re-selects or a
      // retry repeats the action. The topic-ask- prefix is the trigger's
      // transcript-only namespace, so this never replaces the inbox preview.
      // Best-effort: the tag is already saved.
      if (!writeError) {
        await client.from("messages").upsert(
          {
            id: `topic-ask-ack-${conversation.id}`,
            conversation_id: conversation.id,
            author: "agent",
            agent_name: "Widget",
            is_automated: true,
            body: TOPIC_ACK,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      }
      break;
    }
    case "csat":
      if (payload.value === "good" || payload.value === "bad") {
        ({ error: writeError } = await client
          .from("conversations")
          .update({ csat: payload.value, csat_comment: clean(payload.comment) })
          .eq("id", conversation.id));
      }
      break;
    case "identify": {
      const name = clean(payload.name);
      const email = clean(payload.email);
      const patch: { visitor_name?: string; visitor_email?: string } = {};
      if (name) patch.visitor_name = name;
      if (email) patch.visitor_email = email;
      if (Object.keys(patch).length > 0) {
        ({ error: writeError } = await client
          .from("conversations")
          .update(patch)
          .eq("id", conversation.id));
      }
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (writeError) return NextResponse.json({ error: "Could not save the change" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
