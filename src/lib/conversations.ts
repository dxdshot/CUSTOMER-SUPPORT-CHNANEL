import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currentAgent,
  type Conversation,
  type ConversationStatus,
  type Message,
} from "./mock-data";
import { getSupabase } from "./supabase";

/*
 * Dashboard data layer. Mirrors the mock-data.ts shapes exactly so the inbox
 * components keep their props: seed data is the offline fallback, Supabase
 * rows are mapped into the same Conversation/Message types.
 *
 * Two learnings in one file:
 *   1. fetchConversations / sendAgentMessage / updateConversation — plain REST.
 *   2. subscribeInbox — Postgres Changes pushes new rows; the inbox merges
 *      them by id (same merge-by-id pattern widget.ts uses on reload).
 */

export const DEMO_SITE_KEY = "site_demo_001";

type DbConversation = {
  id: string;
  visitor_id: string;
  status: string;
  last_message: string | null;
  updated_at: string;
  created_at: string;
  visitor_name: string | null;
  visitor_email: string | null;
  country: string | null;
  flag: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  timezone: string | null;
  current_page: string | null;
  journey: { id: string; label: string; path: string; at: string }[] | null;
  agent_last_read_at: string | null;
  visitor_last_read_at: string | null;
  csat: string | null;
  csat_comment: string | null;
  assignee: string | null;
  tags: string[] | null;
  unread_count: number | null;
  last_agent_id: string | null;
};

type DbMessage = {
  id: string;
  author: "visitor" | "agent" | "system";
  body: string;
  created_at: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_avatar: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: string | null;
  attachment_type: string | null;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string): "Today" | "Yesterday" {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86400000);
  return days <= 0 ? "Today" : "Yesterday";
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function toMessage(row: DbMessage, visitorLastReadAt: string | null): Message {
  const read =
    row.author === "agent" && visitorLastReadAt
      ? new Date(row.created_at).getTime() <= new Date(visitorLastReadAt).getTime()
      : row.author !== "agent";
  return {
    id: row.id,
    author: row.author,
    name: row.author === "agent" ? (row.agent_name?.trim() || currentAgent) : undefined,
    body: row.body,
    at: formatTime(row.created_at),
    createdAt: row.created_at,
    day: dayLabel(row.created_at),
    read,
    attachment: row.attachment_url
      ? {
          name: row.attachment_name ?? "Attachment",
          size: row.attachment_size ?? "",
          kind: row.attachment_type === "image" ? "image" : "file",
          url: row.attachment_url,
        }
      : undefined,
  };
}

function toConversation(
  row: DbConversation,
  messages: DbMessage[],
  historyLoaded = true,
): Conversation {
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  // unread_count is maintained by the messages trigger + mark-read.
  const unread = Math.max(0, row.unread_count ?? 0);
  const device = row.device === "phone" || row.device === "tablet" || row.device === "laptop"
    ? row.device
    : "desktop";
  return {
    id: row.id,
    visitor: {
      id: row.visitor_id,
      name: row.visitor_name?.trim() || `Visitor ${row.visitor_id.slice(0, 8)}`,
      email: row.visitor_email ?? "",
      country: row.country ?? "",
      flag: row.flag ?? "",
      browser: row.browser ?? "",
      os: row.os ?? "",
      device,
      timezone: row.timezone ?? "",
      firstSeen: formatTime(row.created_at),
      sessionCount: 1,
      currentPage: row.current_page ?? "",
      journey: (row.journey ?? []).map((step) => ({
        id: step.id,
        label: step.label,
        path: step.path,
        at: step.at,
      })),
    },
    status: (row.status as ConversationStatus) ?? "open",
    assignee: row.assignee ?? null,
    tags: row.tags ?? [],
    unread,
    updatedMinutes: minutesSince(row.updated_at),
    updatedLabel: minutesSince(row.updated_at) === 0 ? "now" : `${minutesSince(row.updated_at)}m`,
    lastMessage: row.last_message ?? sorted[sorted.length - 1]?.body ?? "",
    csat: row.csat === "good" || row.csat === "bad" ? row.csat : undefined,
    messages: sorted.map((message) => toMessage(message, row.visitor_last_read_at)),
    historyLoaded,
  };
}

const CONVERSATION_COLUMNS =
  "id, visitor_id, status, last_message, updated_at, created_at, visitor_name, visitor_email, country, flag, browser, os, device, timezone, current_page, journey, agent_last_read_at, visitor_last_read_at, csat, csat_comment, assignee, tags, unread_count, last_agent_id";
const MESSAGE_COLUMNS =
  "id, author, body, created_at, agent_id, agent_name, agent_avatar, attachment_url, attachment_name, attachment_size, attachment_type";

const siteIdCache = new Map<string, string>();

export async function siteIdFor(client: SupabaseClient, siteKey: string): Promise<string | null> {
  const cached = siteIdCache.get(siteKey);
  if (cached) return cached;
  const { data } = await client.from("sites").select("id").eq("site_key", siteKey).maybeSingle();
  const id = (data?.id as string | undefined) ?? null;
  if (id) siteIdCache.set(siteKey, id);
  return id;
}

export async function fetchConversations(siteKey: string): Promise<Conversation[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const siteId = await siteIdFor(client, siteKey);
  if (!siteId) return null;
  const { data: rows, error } = await client
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("site_id", siteId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error || !rows) return null;
  // List rows only: threads are fetched on selection. This avoids loading
  // every message of every conversation just to render the inbox.
  return (rows as DbConversation[]).map((row) => toConversation(row, [], false));
}

export async function fetchConversationById(conversationId: string): Promise<Conversation | null> {
  const client = getSupabase();
  if (!client) return null;
  const [{ data: row, error: rowError }, { data: messageRows, error: messageError }] = await Promise.all([
    client.from("conversations").select(CONVERSATION_COLUMNS).eq("id", conversationId).maybeSingle(),
    client.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
  if (!row || rowError || messageError) return null;
  return toConversation(row as DbConversation, (messageRows ?? []) as DbMessage[]);
}

export async function sendAgentMessage(
  conversationId: string,
  id: string,
  body: string,
  attachment?: { name: string; size: string; kind: "image" | "file"; url?: string },
  authorName?: string,
  authorAvatar?: string,
  authorId?: string,
): Promise<Message | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client
    .from("messages")
    .insert({
      id,
      conversation_id: conversationId,
      author: "agent",
      agent_id: authorId?.trim() || null,
      agent_name: authorName?.trim() || null,
      agent_avatar: authorAvatar?.trim() || null,
      body,
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_size: attachment?.size ?? null,
      attachment_type: attachment ? (attachment.kind === "image" ? "image" : "file") : null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error?.code === "23505") {
    const { data: existing } = await client
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("id", id)
      .eq("conversation_id", conversationId)
      .eq("author", "agent")
      .eq("body", body)
      .maybeSingle();
    return existing ? toMessage(existing as DbMessage, null) : null;
  }
  if (error || !data) return null;
  // last_message/updated_at are handled by the messages trigger.
  return toMessage(data as DbMessage, null);
}

export async function updateConversation(
  conversationId: string,
  patch: {
    status?: ConversationStatus;
    agent_last_read_at?: string;
    unread_count?: number;
    assignee?: string | null;
    tags?: string[];
  },
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  const { error } = await client.from("conversations").update(patch).eq("id", conversationId);
  return !error;
}

/** Mark the thread read up to now — clears unread and lights visitor receipts. */
export async function markAgentRead(conversationId: string): Promise<void> {
  await updateConversation(conversationId, {
    agent_last_read_at: new Date().toISOString(),
    unread_count: 0,
  });
}

/** Agent typing heartbeat; the widget treats it as active for 5s and names the writer. */
export async function setAgentTyping(
  conversationId: string,
  typing: boolean,
  agent?: { id: string; name: string; avatarUrl: string },
): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from("typing").upsert(
    {
      conversation_id: conversationId,
      agent_typing_at: typing ? new Date().toISOString() : null,
      agent_id: agent?.id ?? null,
      agent_name: agent?.name ?? null,
      agent_avatar: agent?.avatarUrl || null,
    },
    { onConflict: "conversation_id" },
  );
}

/** Presence: the widget shows Online while a dashboard tab is open. */
export async function heartbeat(siteKey: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from("sites").update({ agent_online_at: new Date().toISOString() }).eq("site_key", siteKey);
}

/** Visitor typing rows stream in through Postgres Changes. */
export function subscribeTyping(
  onChange: (conversationId: string, visitorTypingAt: string | null) => void,
): (() => void) | null {
  const client = getSupabase();
  if (!client) return null;
  const channel = client
    .channel("typing")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "typing" },
      (payload) => {
        const row = payload.new as { conversation_id?: string; visitor_typing_at?: string | null };
        if (row?.conversation_id) onChange(row.conversation_id, row.visitor_typing_at ?? null);
      },
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/*
 * Live inbox: INSERTs on messages (visitor sends, or another agent replies)
 * arrive here without polling. The caller merges by id — same pattern as
 * widget.ts reload(). Returns an unsubscribe function.
 */
export type ConversationPatch = {
  id: string;
  status?: string;
  agent_last_read_at?: string | null;
  last_message?: string | null;
  updated_at?: string | null;
  unread_count?: number | null;
  assignee?: string | null;
  tags?: string[] | null;
};

/* Exact-thread presence: who has this conversation open right now. */
const VIEWER_KEY = "chat-platform:viewer-id";

export function getViewerId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(VIEWER_KEY);
    if (existing) return existing;
    const fresh = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `viewer-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    window.localStorage.setItem(VIEWER_KEY, fresh);
    return fresh;
  } catch {
    return `viewer-${Date.now()}`;
  }
}

export async function pingViewer(
  conversationId: string,
  name: string,
  avatarUrl = "",
  agentId = "",
): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from("conversation_viewers").upsert(
    {
      conversation_id: conversationId,
      viewer_id: getViewerId(),
      agent_id: agentId || null,
      name: name.slice(0, 60),
      avatar_url: avatarUrl || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,viewer_id" },
  );
}

export async function clearViewer(conversationId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client
    .from("conversation_viewers")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("viewer_id", getViewerId());
}

export async function fetchViewers(
  conversationId: string,
): Promise<{ id: string; agentId: string; name: string; avatarUrl: string }[]> {
  const client = getSupabase();
  if (!client) return [];
  const since = new Date(Date.now() - 30_000).toISOString();
  const { data } = await client
    .from("conversation_viewers")
    .select("viewer_id, agent_id, name, avatar_url, last_seen_at")
    .eq("conversation_id", conversationId)
    .gt("last_seen_at", since);
  const self = getViewerId();
  return (data ?? [])
    .filter((row) => row.viewer_id !== self)
    .map((row) => ({
      id: row.viewer_id as string,
      agentId: (row.agent_id as string | null) ?? "",
      name: (row.name as string) || "Agent",
      avatarUrl: (row.avatar_url as string | null) ?? "",
    }));
}

export function subscribeViewers(
  conversationId: string,
  onChange: () => void,
): (() => void) | null {
  const client = getSupabase();
  if (!client) return null;
  const channel = client
    .channel(`viewers-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversation_viewers",
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeInbox(
  onMessage: (conversationId: string, message: Message) => void,
  onConversation: (patch: ConversationPatch) => void,
): (() => void) | null {
  const client = getSupabase();
  if (!client) return null;
  const channel = client
    .channel("inbox")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const row = payload.new as DbMessage & { conversation_id: string };
        onMessage(row.conversation_id, toMessage(row, null));
      },
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "conversations" },
      (payload) => {
        onConversation(payload.new as ConversationPatch);
      },
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
