"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CannedResponse } from "@/lib/mock-data";

export function ResponseList({
  responses,
  draft,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  className,
}: {
  responses: CannedResponse[];
  /** An unsaved new response, pinned above the saved ones while it is being written. */
  draft?: CannedResponse | null;
  selectedId: string;
  onSelect: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col border-r border-(--obsidian-dashboard-shell-border)", className)}>
      <div className="shrink-0 px-4 pb-2 pt-3">
        <label className="flex h-8 items-center gap-2 rounded-lg bg-(--obsidian-dashboard-shell-muted) px-2.5 transition-shadow focus-within:ring-2 focus-within:ring-(--obsidian-dashboard-shell-ring)">
          <Search aria-hidden className="size-3.5 shrink-0 text-(--obsidian-dashboard-shell-text-subtle)" />
          <span className="sr-only">Search canned responses</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search shortcuts and messages…"
            spellCheck={false}
            autoComplete="off"
            className="h-full w-full min-w-0 bg-transparent text-xs text-(--obsidian-dashboard-shell-foreground) outline-none placeholder:text-(--obsidian-dashboard-shell-text-subtle)"
          />
        </label>
      </div>

      <div className="obsidian-dashboard-shell-scroll min-h-0 flex-1 overflow-y-auto pb-4">
        {responses.length === 0 && !draft ? (
          <p className="px-4 py-8 text-center text-xs leading-relaxed text-(--obsidian-dashboard-shell-text-subtle)">
            {query.trim() ? "No responses match that search." : "No responses in this view yet."}
          </p>
        ) : (
          <ul>
            {draft && (
              <li key={draft.id}>
                <ResponseRow response={draft} selected={draft.id === selectedId} onSelect={onSelect} isDraft />
              </li>
            )}
            {responses.map((response) => (
              <li key={response.id}>
                <ResponseRow response={response} selected={response.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResponseRow({
  response,
  selected,
  onSelect,
  isDraft = false,
}: {
  response: CannedResponse;
  selected: boolean;
  onSelect: (id: string) => void;
  isDraft?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(response.id)}
      data-selected={selected}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full flex-col gap-0.5 px-4 py-2.5 text-left outline-none transition-colors duration-150",
        "hover:bg-(--obsidian-dashboard-shell-hover) focus-visible:ring-2 focus-visible:ring-(--obsidian-dashboard-shell-ring) focus-visible:ring-inset",
        "data-[selected=true]:bg-(--obsidian-dashboard-shell-muted)",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-(--obsidian-dashboard-shell-accent)" />}

      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5">{response.title.trim() || "Untitled response"}</span>
        {isDraft ? (
          <span className="shrink-0 rounded-[5px] border border-(--obsidian-dashboard-shell-border-strong) bg-(--obsidian-dashboard-shell-muted) px-1.5 py-px text-[10.5px] leading-4 text-(--obsidian-dashboard-shell-warning)">
            Draft
          </span>
        ) : (
          <span className="shrink-0 text-[11px] tabular-nums text-(--obsidian-dashboard-shell-text-subtle)">
            {response.usedCount > 0 ? `${response.usedCount} uses` : "Unused"}
          </span>
        )}
      </span>
      <span className="truncate font-mono text-[11.5px] leading-4 text-(--obsidian-dashboard-shell-accent)">
        {response.shortcut.trim() || "/shortcut"}
      </span>
      <span className="truncate text-[12px] leading-5 text-(--obsidian-dashboard-shell-text-muted)">
        {response.body.trim() || "No message yet"}
      </span>
    </button>
  );
}
