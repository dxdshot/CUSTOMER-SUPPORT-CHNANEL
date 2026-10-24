"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { VisitorsView } from "@/components/visitors/visitors-view";
import { demoNotifications, demoUnread } from "@/lib/demo-conversations";
import { buildDemoSessions } from "@/lib/demo-sessions";

// Fixed clock so the demo map is deterministic and never differs on hydration.
const DEMO_NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

export default function DemoVisitorsPage() {
  const [sessions] = useState(() => buildDemoSessions(DEMO_NOW));

  return (
    <AppShell
      demo
      demoUnread={demoUnread}
      demoNotifications={demoNotifications}
      title="Live visitors"
    >
      <VisitorsView sessions={sessions} loaded error={false} now={DEMO_NOW} />
    </AppShell>
  );
}
