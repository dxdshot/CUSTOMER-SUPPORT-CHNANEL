"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import { failMessage, receiveMessage } from "@/lib/message-state";
import { getSupabase } from "@/lib/supabase";
import { useAgentProfile } from "@/lib/agent-profile";
import {
  conversations as seedConversations,
  conversationStatus,
  type Conversation,
  type ConversationStatus,
  type Message,
} from "@/lib/mock-data";
import {
  DEMO_SITE_KEY,
  clearViewer,
  fetchConversationById,
  fetchConversations,
  fetchViewers,
  heartbeat,
  markAgentRead,
  pingViewer,
  sendAgentMessage,
  setAgentTyping,
  subscribeInbox,
  subscribeTyping,
  subscribeViewers,
  updateConversation,
  type ConversationPatch,
} from "@/lib/conversations";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import { VisitorSheet } from "./visitor-sheet";
import { visibleConversations, type InboxSort, type InboxTab } from "@/lib/inbox";

export function InboxView({
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
  const profile = useAgentProfile();
  const requestedId = useSearchParams().get("conversation");
  // Start empty, never with seed rows: with Supabase configured the live rows
  // fill in on load; without it the seed arrives as the fallback below.
  // Seeding useState with mocks is what flashed fake conversations for a second.
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>(requestedId ?? "");
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  // Below the md breakpoint the panes can't sit side by side, so one shows at a time.
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; agentId: string; name: string; avatarUrl: string }[]>([]);
  const typingTimers = useRef(new Map<string, number>());
  const agentTypingSent = useRef(0);
  const selectedRef = useRef(selectedId);
  const lastReadWrite = useRef(new Map<string, number>());
  const threadLoads = useRef(new Set<string>());

  // Presence heartbeat: the widget reads "Online" while a dashboard tab is open.
  useEffect(() => {
    const beat = () => void heartbeat(DEMO_SITE_KEY);
    beat();
    const timer = window.setInterval(beat, 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Visitor typing streams from Postgres Changes; each ping stays active 4.5s.
  useEffect(() => {
    const timers = typingTimers.current;
    const unsubscribe = subscribeTyping((conversationId, at) => {
      const active = at ? Date.now() - new Date(at).getTime() < 4500 : false;
      setItems((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, typing: active } : conversation,
        ),
      );
      const existing = timers.get(conversationId);
      if (existing) window.clearTimeout(existing);
      if (active) {
        timers.set(
          conversationId,
          window.setTimeout(() => {
            setItems((previous) =>
              previous.map((conversation) =>
                conversation.id === conversationId ? { ...conversation, typing: false } : conversation,
              ),
            );
            timers.delete(conversationId);
          }, 4500),
        );
      }
    });
    return () => {
      unsubscribe?.();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // 1. Load: live conversations, or the seed fallback when there is no backend.
  useEffect(() => {
    let cancelled = false;
    void fetchConversations(DEMO_SITE_KEY)
      .then((live) => {
        if (cancelled) return;
        const rows = live ?? seedConversations;
        const chosen = rows.some((conversation) => conversation.id === selectedRef.current)
          ? selectedRef.current
          : (rows[0]?.id ?? "");
        setItems(
          rows.map((conversation) =>
            conversation.id === chosen ? { ...conversation, unread: 0 } : conversation,
          ),
        );
        setSelectedId(chosen);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const mergeMessage = (conversationId: string, message: Message) => {
      setItems((previous) => {
        const existing = previous.find((conversation) => conversation.id === conversationId);
        if (!existing) {
          // New visitor: pull the full conversation (visitor row + history).
          void fetchConversationById(conversationId).then((fresh) => {
            if (cancelled || !fresh) return;
            setItems((current) =>
              current.some((conversation) => conversation.id === conversationId)
                ? current
                : [fresh, ...current],
            );
            setSelectedId((current) => current || fresh.id);
          });
          return previous;
        }
        const isNew = !existing.messages.some((item) => item.id === message.id);
        const messages = receiveMessage(existing.messages, message);
        const latest = messages[messages.length - 1];
        return previous.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages,
                lastMessage: latest.body || latest.attachment?.name || "Attachment",
                updatedMinutes: 0,
                updatedLabel: "now",
                unread:
                  isNew && message.author === "visitor" && selectedRef.current !== conversationId
                    ? conversation.unread + 1
                    : conversation.unread,
              }
            : conversation,
        );
      });
      // Same notification sound as the widget preview (ready/press cue).
      if (message.author === "visitor") {
        void import("cuelume")
          .then(({ play }) => play("ready", { theme: "press" }))
          .catch(() => {});
      }
    };
    const touchConversation = (patch: ConversationPatch) => {
      // Apply the realtime row locally instead of refetching the world — read
      // updates previously cleared badges a beat late and cost 2 queries each.
      setItems((previous) =>
        previous.map((conversation) => {
          if (conversation.id !== patch.id) return conversation;
          const agentRead = patch.agent_last_read_at ?? null;
          const computed = agentRead
            ? conversation.messages.filter(
                (message) =>
                  message.author === "visitor" &&
                  (!message.createdAt ||
                    new Date(message.createdAt).getTime() > new Date(agentRead).getTime()),
              ).length
            : conversation.unread;
          return {
            ...conversation,
            status: conversationStatus(patch.status, conversation.status),
            lastMessage: patch.last_message ?? conversation.lastMessage,
            updatedLabel: patch.last_message ? "now" : conversation.updatedLabel,
            unread: typeof patch.unread_count === "number" ? patch.unread_count : computed,
            assignee: "assignee" in patch ? (patch.assignee ?? null) : conversation.assignee,
            tags: patch.tags ?? conversation.tags,
          };
        }),
      );
    };
    const unsubscribe = subscribeInbox(mergeMessage, touchConversation);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const visible = useMemo(
    () => visibleConversations(items, { tab, sort, tag, query }),
    [items, tab, sort, tag, query],
  );

  // The thread follows the list: if the selected conversation is filtered out, open the first visible one.
  const selected = (requestedId
    ? items.find((conversation) => conversation.id === requestedId)
    : visible.find((conversation) => conversation.id === selectedId)) ?? visible[0];
  const activePane = requestedId ? "thread" : mobilePane;

  useEffect(() => {
    selectedRef.current = selected?.id ?? "";
  }, [selected?.id]);

  // The list carries row data only; fetch the transcript when a thread opens.
  const selectedConversationId = selected?.id;
  const selectedHistoryLoaded = selected?.historyLoaded;
  useEffect(() => {
    if (!selectedConversationId || selectedHistoryLoaded) return;
    const id = selectedConversationId;
    if (threadLoads.current.has(id)) return;
    threadLoads.current.add(id);
    void fetchConversationById(id).then((fresh) => {
      threadLoads.current.delete(id);
      if (!fresh) return;
      setItems((previous) =>
        previous.map((conversation) => {
          if (conversation.id !== id) return conversation;
          // Keep optimistic/realtime messages that landed during the fetch.
          const messages = conversation.messages.reduce(
            (list, message) =>
              list.some((item) => item.id === message.id) ? list : receiveMessage(list, message),
            fresh.messages,
          );
          return { ...fresh, messages, unread: 0, historyLoaded: true };
        }),
      );
    });
  }, [selectedConversationId, selectedHistoryLoaded]);

  // Read receipts: viewing the thread marks it read for this agent.
  // Debounced per conversation so message churn doesn't spam writes.
  useEffect(() => {
    if (!selected?.id) return;
    const now = Date.now();
    const previous = lastReadWrite.current.get(selected.id) ?? 0;
    if (now - previous < 2000) return;
    lastReadWrite.current.set(selected.id, now);
    void markAgentRead(selected.id);
  }, [selected?.id, selected?.messages.length]);

  // Exact-thread presence: only while this conversation is open and the
  // tab is visible. Independent of site availability, typing, and read receipts.
  useEffect(() => {
    const conversationId = selected?.id;
    if (!conversationId) return;
    let cancelled = false;
    const refresh = () => {
      void fetchViewers(conversationId).then((next) => {
        if (!cancelled) setViewers(next);
      });
    };
    void pingViewer(conversationId, profile.name, profile.avatarUrl, profile.id);
    refresh();
    const beat = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void pingViewer(conversationId, profile.name, profile.avatarUrl, profile.id);
      refresh();
    }, 15_000);
    const unsubscribe = subscribeViewers(conversationId, refresh);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void clearViewer(conversationId);
      else {
        void pingViewer(conversationId, profile.name, profile.avatarUrl, profile.id);
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(beat);
      unsubscribe?.();
      document.removeEventListener("visibilitychange", onVisibility);
      void clearViewer(conversationId);
    };
  }, [selected?.id, profile.name, profile.avatarUrl, profile.id]);

  // Agent typing heartbeat, throttled to one write per 2s.
  const notifyTyping = () => {
    if (!selected) return;
    const now = Date.now();
    if (now - agentTypingSent.current < 2000) return;
    agentTypingSent.current = now;
    void setAgentTyping(selected.id, true, {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
  };

  const patchSelected = (patch: (conversation: Conversation) => Conversation) => {
    setItems((previous) => previous.map((conversation) => (conversation.id === selected.id ? patch(conversation) : conversation)));
  };

  const persistMessage = async (conversationId: string, message: Message) => {
    try {
      const saved = getSupabase()
        ? await sendAgentMessage(conversationId, message.id, message.body, message.attachment, profile.name, profile.avatarUrl, profile.id)
        : message;
      setItems((previous) => previous.map((conversation) => conversation.id === conversationId
        ? { ...conversation, messages: saved
          ? receiveMessage(conversation.messages, saved)
          : failMessage(conversation.messages, message.id) }
        : conversation));
    } catch {
      setItems((previous) => previous.map((conversation) => conversation.id === conversationId
        ? { ...conversation, messages: failMessage(conversation.messages, message.id) }
        : conversation));
    }
  };

  const send = (body: string, attachment?: Message["attachment"]) => {
    if (!selected) return;
    // Optimistic patch first (same UI as before), then persist.
    const optimisticId = crypto.randomUUID();
    const message: Message = {
      id: optimisticId,
      author: "agent",
      name: profile.name,
      body,
      at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      day: "Today",
      read: false,
      delivery: "sending",
      attachment,
    };
    patchSelected((conversation) => ({
      ...conversation,
      messages: [
        ...conversation.messages,
        message,
      ],
      lastMessage: body || attachment?.name || "Attachment",
      updatedMinutes: 0,
      updatedLabel: "now",
      unread: 0,
      typing: false,
    }));
    void setAgentTyping(selected.id, false, {
      id: profile.id,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
    void persistMessage(selected.id, message);
  };

  const retry = (message: Message) => {
    if (!selected || message.delivery !== "failed") return;
    patchSelected((conversation) => ({ ...conversation, messages: conversation.messages.map((item) =>
      item.id === message.id ? { ...item, delivery: "sending" } : item) }));
    void persistMessage(selected.id, message);
  };

  const setStatus = (status: ConversationStatus) => {
    if (!selected) return;
    patchSelected((conversation) => ({ ...conversation, status }));
    // Realtime echoes the UPDATE back via touchConversation; failure rolls back.
    void updateConversation(selected.id, { status }).then((ok) => {
      if (!ok) patchSelected((conversation) => ({ ...conversation, status: selected.status }));
    });
  };
  const assign = (agent: string) => {
    if (!selected) return;
    patchSelected((conversation) => ({ ...conversation, assignee: agent }));
    void updateConversation(selected.id, { assignee: agent }).then((ok) => {
      if (!ok) patchSelected((conversation) => ({ ...conversation, assignee: selected.assignee }));
    });
  };
  const addTag = (tagName: string) => {
    if (
      !selected ||
      selected.tags.some((existing) => existing.toLowerCase() === tagName.toLowerCase())
    ) return;
    const tags = [...selected.tags, tagName];
    patchSelected((conversation) => ({ ...conversation, tags }));
    void updateConversation(selected.id, { tags }).then((ok) => {
      if (!ok) patchSelected((conversation) => ({ ...conversation, tags: selected.tags }));
    });
  };

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <ConversationList
        conversations={visible}
        selectedId={selected?.id ?? ""}
        onSelect={(id) => {
          if (requestedId) window.history.replaceState(null, "", "/dashboard");
          setSelectedId(id);
          selectedRef.current = id;
          setViewers([]);
          setItems((previous) =>
            previous.map((conversation) =>
              conversation.id === id ? { ...conversation, unread: 0 } : conversation,
            ),
          );
          setMobilePane("thread");
        }}
        query={query}
        onQueryChange={setQuery}
        loading={!loaded}
        className={cn("w-full md:w-[304px] md:shrink-0", activePane === "thread" && "max-md:hidden")}
      />

      {selected ? (
        <ConversationThread
          key={selected.id}
          conversation={selected}
          onSend={send}
          onRetry={retry}
          onTyping={notifyTyping}
          viewers={viewers}
          onStatusChange={setStatus}
          onAssign={assign}
          onOpenProfile={() => setProfileOpen(true)}
          onBack={() => {
            if (requestedId) window.history.replaceState(null, "", "/dashboard");
            setMobilePane("list");
          }}
          className={activePane === "list" ? "max-md:hidden" : undefined}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-xs text-center text-xs leading-relaxed text-(--obsidian-dashboard-shell-text-subtle)">
            {loaded
              ? "No conversations match these filters. Clear the search or switch tabs to see more."
              : <BrandSpinner label="Loading conversations" />}
          </div>
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
        />
      )}
    </div>
  );
}
