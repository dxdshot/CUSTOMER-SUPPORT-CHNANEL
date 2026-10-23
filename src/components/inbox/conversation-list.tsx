"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import type { Conversation } from "@/lib/mock-data";
import { TypingDots } from "./typing-dots";
import { VisitorAvatar } from "./visitor-avatar";

const statusDot: Record<Conversation["status"], string> = {
  open: "bg-(--obsidian-dashboard-shell-success)",
  pending: "bg-(--obsidian-dashboard-shell-warning)",
  closed: "bg-(--obsidian-dashboard-shell-border-strong)",
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  loading,
  className,
}: {
  conversations: Conversation[];
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col border-r border-(--obsidian-dashboard-shell-border)", className)}>
      <div className="shrink-0 px-4 pb-2 pt-3">
        <label suppressHydrationWarning className="flex h-8 items-center gap-2 rounded-lg bg-(--obsidian-dashboard-shell-muted) px-2.5 transition-shadow focus-within:ring-2 focus-within:ring-(--obsidian-dashboard-shell-ring)">
          <Search aria-hidden className="size-3.5 shrink-0 text-(--obsidian-dashboard-shell-text-subtle)" />
          <span className="sr-only">Search conversations</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search conversations…"
            spellCheck={false}
            autoComplete="off"
            className="h-full w-full min-w-0 bg-transparent text-xs text-(--obsidian-dashboard-shell-foreground) outline-none placeholder:text-(--obsidian-dashboard-shell-text-subtle)"
          />
        </label>
      </div>

      <div className="obsidian-dashboard-shell-scroll min-h-0 flex-1 overflow-y-auto pb-4">
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs leading-relaxed text-(--obsidian-dashboard-shell-text-subtle)">
            {loading ? <BrandSpinner label="Loading conversations" /> : "No conversations match these filters."}
          </p>
        ) : (
          <ul>
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <ConversationRow conversation={conversation} selected={conversation.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  selected,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { visitor, unread, typing, updatedLabel, lastMessage, status, tags } = conversation;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      data-selected={selected}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-150",
        "hover:bg-(--obsidian-dashboard-shell-hover) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring) focus-visible:ring-inset",
        "data-[selected=true]:bg-(--obsidian-dashboard-shell-muted)",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-(--obsidian-dashboard-shell-accent)" />}

      <span className="relative shrink-0">
        <VisitorAvatar name={visitor.name} />
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-(--obsidian-dashboard-shell-background)",
            statusDot[status],
          )}
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">{visitor.name}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-(--obsidian-dashboard-shell-text-subtle)">{updatedLabel}</span>
        </span>

        {typing ? (
          <span className="flex items-center gap-1.5 text-[12.5px] leading-5 text-(--obsidian-dashboard-shell-accent)">
            <TypingDots />
            typing…
          </span>
        ) : (
          <span className="truncate text-[12.5px] leading-5 text-(--obsidian-dashboard-shell-text-muted)">{lastMessage}</span>
        )}

        <span className="mt-1 flex items-center gap-1.5">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-[5px] border border-amber-400/35 bg-amber-400/10 px-1.5 py-px text-[10.5px] leading-4 text-amber-300"
            >
              {tag}
            </span>
          ))}
          {unread > 0 && (
            <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-(--obsidian-dashboard-shell-accent) px-1 text-[10.5px] font-medium leading-none tabular-nums text-(--obsidian-dashboard-shell-accent-foreground)">
              {unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
