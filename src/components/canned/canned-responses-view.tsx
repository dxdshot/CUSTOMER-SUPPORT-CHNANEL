"use client";

import { useMemo, useState } from "react";
import { Plus, Zap } from "lucide-react";
import { AppShell, type NotificationRow } from "@/components/app-shell";
import { DashboardButton } from "@/components/block/dashboard-shell";
import { ComingSoon } from "@/components/coming-soon";
import { ResponseEditor } from "@/components/canned/response-editor";
import { ResponseList } from "@/components/canned/response-list";
import { useCannedResponseStore } from "@/lib/canned-store";
import { useDemoCannedStore } from "@/lib/demo-canned-store";
import { cn } from "@/lib/utils";
import type { CannedResponse } from "@/lib/mock-data";

type CannedTab = "all" | "popular" | "unused";

const DRAFT_ID = "draft";

export function CannedResponsesView({
  demo = false,
  demoUnread = 0,
  demoNotifications,
}: {
  demo?: boolean;
  demoUnread?: number;
  demoNotifications?: NotificationRow[];
}) {
  const [tab, setTab] = useState<CannedTab>("all");
  const liveStore = useCannedResponseStore();
  const demoStore = useDemoCannedStore();
  const [items, commit] = demo ? demoStore : liveStore;
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id ?? null);
  const [draft, setDraft] = useState<CannedResponse | null>(null);
  const [query, setQuery] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "editor">("list");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = items.filter((response) => {
      if (tab === "popular" && response.usedCount === 0) return false;
      if (tab === "unused" && response.usedCount > 0) return false;
      if (needle) {
        const haystack = `${response.shortcut} ${response.title} ${response.body}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return list.sort((a, b) =>
      tab === "popular" ? b.usedCount - a.usedCount : a.shortcut.localeCompare(b.shortcut),
    );
  }, [items, tab, query]);

  const committed = items.find((response) => response.id === selectedId) ?? null;
  const selected = draft ?? committed ?? visible[0] ?? null;
  const takenShortcuts = items
    .filter((response) => response.id !== selected?.id)
    .map((response) => response.shortcut);

  const startDraft = () => {
    setDraft({ id: DRAFT_ID, shortcut: "", title: "", body: "", usedCount: 0 });
    setMobilePane("editor");
  };

  const save = (next: CannedResponse) => {
    if (draft) {
      const created = { ...next, id: `cr-${Date.now()}` };
      commit([...items, created]);
      setDraft(null);
      setSelectedId(created.id);
      return;
    }
    commit(items.map((response) => (response.id === next.id ? next : response)));
  };

  const remove = (id: string) => {
    const remaining = items.filter((response) => response.id !== id);
    commit(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  };

  return (
    <AppShell
      demo={demo}
      demoUnread={demoUnread}
      demoNotifications={demoNotifications}
      title="Canned responses"
      status={`${items.length} responses`}
      statusTone="neutral"
      tabs={[
        { value: "all", label: "All" },
        { value: "popular", label: "Most used" },
        { value: "unused", label: "Unused" },
      ]}
      tab={tab}
      onTabChange={(value) => setTab(value as CannedTab)}
      toolbarActions={
        <DashboardButton variant="primary" size="sm" onClick={startDraft} disabled={draft !== null}>
          <Plus aria-hidden />
          New response
        </DashboardButton>
      }
    >
      <div className="flex h-full min-h-0 overflow-hidden">
        <ResponseList
          responses={visible}
          draft={draft}
          selectedId={selected?.id ?? ""}
          onSelect={(id) => {
            if (id !== DRAFT_ID) {
              setDraft(null);
              setSelectedId(id);
            }
            setMobilePane("editor");
          }}
          query={query}
          onQueryChange={setQuery}
          className={cn("w-full md:w-[320px] md:shrink-0", mobilePane === "editor" && "max-md:hidden")}
        />

        {selected ? (
          <ResponseEditor
            key={draft ? DRAFT_ID : selected.id}
            response={selected}
            isNew={draft !== null}
            existingShortcuts={takenShortcuts}
            onSave={save}
            onDelete={() => remove(selected.id)}
            onCancel={() => {
              setDraft(null);
              setMobilePane("list");
            }}
            onBack={() => setMobilePane("list")}
            className={mobilePane === "list" ? "max-md:hidden" : undefined}
          />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1">
            <ComingSoon
              icon={Zap}
              title="No response selected"
              description="Pick a shortcut on the left, or create a new one to get started."
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
