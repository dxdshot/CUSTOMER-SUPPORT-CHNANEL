"use client";

import { Suspense, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardFilterMenu } from "@/components/block/dashboard-shell";
import { DemoInboxView } from "@/components/inbox/demo-inbox-view";
import type { InboxSort, InboxTab } from "@/lib/inbox";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import { demoNotifications, demoTagNames, demoUnread } from "@/lib/demo-conversations";

const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "unread", label: "Unread first" },
];

const tagOptions = [
  { value: "all", label: "All tags" },
  ...demoTagNames.map((name) => ({ value: name, label: name })),
];

export default function DemoInboxPage() {
  const [tab, setTab] = useState<InboxTab>("all");
  const [sort, setSort] = useState<InboxSort>("newest");
  const [tag, setTag] = useState("all");

  const activeTag = tag === "all" || demoTagNames.includes(tag) ? tag : "all";

  return (
    <AppShell
      demo
      demoUnread={demoUnread}
      demoNotifications={demoNotifications}
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
      <Suspense
        fallback={
          <div className="flex min-h-full items-center justify-center p-6">
            <BrandSpinner label="Loading demo inbox" />
          </div>
        }
      >
        <DemoInboxView tab={tab} sort={sort} tag={activeTag} availableTags={demoTagNames} />
      </Suspense>
    </AppShell>
  );
}
