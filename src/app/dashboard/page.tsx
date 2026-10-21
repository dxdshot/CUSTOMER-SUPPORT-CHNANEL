"use client";

import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardFilterMenu } from "@/components/block/dashboard-shell";
import { InboxView, type InboxSort, type InboxTab } from "@/components/inbox/inbox-view";
import { DEMO_SITE_KEY } from "@/lib/conversations";
import { useTags } from "@/lib/tags";

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "unread", label: "Unread first" },
];

export default function InboxPage() {
  const [tab, setTab] = useState<InboxTab>("all");
  const [sort, setSort] = useState<InboxSort>("newest");
  const [tag, setTag] = useState("all");
  const { tags } = useTags(DEMO_SITE_KEY);

  const tagOptions = useMemo(
    () => [
      { value: "all", label: "All tags" },
      ...tags.map((name) => ({ value: name, label: name })),
    ],
    [tags],
  );

  // A tag can disappear between reads (another tab deleted it); never leave the
  // inbox filtered by something the menu no longer offers. Derive the effective
  // value instead of resetting state in an effect.
  const activeTag = tag === "all" || tags.includes(tag) ? tag : "all";

  return (
    <AppShell
      title="Inbox"
      status="Online"
      tabs={[
        { value: "all", label: "All" },
        { value: "mine", label: "Mine" },
        { value: "unassigned", label: "Unassigned" },
        { value: "closed", label: "Closed" },
      ]}
      tab={tab}
      onTabChange={(value) => setTab(value as InboxTab)}
      filters={
        <>
          <DashboardFilterMenu label="Tag" value={activeTag} options={tagOptions} onValueChange={setTag} />
          <DashboardFilterMenu label="Sort by" value={sort} options={sortOptions} onValueChange={(value) => setSort(value as InboxSort)} />
        </>
      }
    >
      <Suspense fallback={<p className="p-6 text-sm">Loading inbox…</p>}>
        <InboxView tab={tab} sort={sort} tag={activeTag} availableTags={tags} />
      </Suspense>
    </AppShell>
  );
}
