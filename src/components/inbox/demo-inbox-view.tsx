"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  currentAgent,
  type Conversation,
  type ConversationStatus,
  type Message,
} from "@/lib/mock-data";
import { demoConversations } from "@/lib/demo-conversations";
import { useDemoCannedResponses } from "@/lib/demo-canned-store";
import { visibleConversations, type InboxSort, type InboxTab } from "@/lib/inbox";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import { VisitorSheet } from "./visitor-sheet";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/*
 * The inbox, driven entirely by local demo data. Nothing here reads or writes
 * Supabase, so a public visitor can click around without touching the real
 * workspace.
 */
export function DemoInboxView({
  tab,
  sort,
  tag,
  availableTags,
}: {
  tab: InboxTab;
  sort: InboxSort;
  tag: string;
  availableTags: string[];
}) {
  const [items, setItems] = useState<Conversation[]>(() =>
    demoConversations.map((conversation) => ({
      ...conversation,
      messages: [...conversation.messages],
    })),
  );
  const [selectedId, setSelectedId] = useState(() => items[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const [profileOpen, setProfileOpen] = useState(false);
  const requestedId = useSearchParams().get("conversation") ?? "";
  const demoCanned = useDemoCannedResponses();

  const visible = useMemo(
    () => visibleConversations(items, { tab, sort, tag, query }),
    [items, tab, sort, tag, query],
  );

  const selected = (requestedId
    ? items.find((conversation) => conversation.id === requestedId)
    : visible.find((conversation) => conversation.id === selectedId)) ?? visible[0];
  const activePane = requestedId ? "thread" : mobilePane;

  const patch = (conversationId: string, update: (conversation: Conversation) => Conversation) => {
    setItems((previous) =>
      previous.map((conversation) => (conversation.id === conversationId ? update(conversation) : conversation)),
    );
  };

  const send = (body: string, attachment?: Message["attachment"]) => {
    if (!selected) return;
    const now = new Date();
    const message: Message = {
      id: newId(),
      author: "agent",
      name: currentAgent,
      body,
      at: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      createdAt: now.toISOString(),
      day: "Today",
      read: false,
      delivery: "sent",
      attachment,
    };
    patch(selected.id, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
      lastMessage: body || attachment?.name || "Attachment",
      updatedMinutes: 0,
      updatedLabel: "now",
      unread: 0,
      typing: false,
    }));
  };

  const retry = (message: Message) => {
    if (!selected) return;
    patch(selected.id, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((item) =>
        item.id === message.id ? { ...item, delivery: "sent" } : item,
      ),
    }));
  };

  const setStatus = (status: ConversationStatus) => {
    if (selected) patch(selected.id, (conversation) => ({ ...conversation, status }));
  };

  const assign = (agent: string) => {
    if (selected) patch(selected.id, (conversation) => ({ ...conversation, assignee: agent }));
  };

  const addTag = (name: string) => {
    if (!selected || selected.tags.some((value) => value.toLowerCase() === name.toLowerCase())) return;
    patch(selected.id, (conversation) => ({ ...conversation, tags: [...conversation.tags, name] }));
  };

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <ConversationList
        conversations={visible}
        selectedId={selected?.id ?? ""}
        onSelect={(id) => {
          if (requestedId) window.history.replaceState(null, "", "/demo");
          setSelectedId(id);
          setItems((previous) =>
            previous.map((conversation) =>
              conversation.id === id ? { ...conversation, unread: 0 } : conversation,
            ),
          );
          setMobilePane("thread");
          setProfileOpen(false);
        }}
        query={query}
        onQueryChange={setQuery}
        className={cn("w-full md:w-[304px] md:shrink-0", activePane === "thread" && "max-md:hidden")}
      />

      {selected ? (
        <ConversationThread
          key={selected.id}
          conversation={selected}
          onSend={send}
          onRetry={retry}
          onTyping={() => {}}
          onStatusChange={setStatus}
          onAssign={assign}
          onOpenProfile={() => setProfileOpen(true)}
          onBack={() => setMobilePane("list")}
          localUpload
          cannedResponses={demoCanned}
          className={activePane === "list" ? "max-md:hidden" : undefined}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="max-w-xs text-center text-xs leading-relaxed text-(--obsidian-dashboard-shell-text-subtle)">
            No conversations match these filters. Clear the search or switch tabs to see more.
          </p>
        </div>
      )}

      {selected && (
        <VisitorSheet
          visitor={selected.visitor}
          tags={selected.tags}
          availableTags={availableTags}
          csat={selected.csat}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onAddTag={addTag}
          settingsHref="/demo/settings"
        />
      )}
    </div>
  );
}
