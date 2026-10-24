"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { VisitorsView } from "@/components/visitors/visitors-view";
import { DEMO_SITE_KEY, siteIdFor } from "@/lib/conversations";
import { getSupabase } from "@/lib/supabase";
import type { VisitorSession } from "@/lib/visitor-sessions";

async function loadSessions(): Promise<VisitorSession[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const siteId = await siteIdFor(client, DEMO_SITE_KEY);
  if (!siteId) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: VisitorSession[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from("visitor_sessions")
      .select("session_id, visitor_id, visitor_name, visitor_email, country, flag, browser, os, device, timezone, current_page, page_views, started_at, last_seen_at")
      .eq("site_id", siteId).gte("last_seen_at", today.toISOString())
      .order("last_seen_at", { ascending: false }).range(start, start + 999);
    if (error || !data) return null;
    rows.push(...(data as VisitorSession[]));
    if (data.length < 1000) return rows;
  }
}

export default function VisitorsPage() {
  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(0);

  useEffect(() => {
    let mounted = true;
    const refresh = () => void loadSessions().then((rows) => {
      if (!mounted) return;
      setLoaded(true);
      if (rows) {
        setSessions(rows);
        setRefreshedAt(Date.now());
        setError(false);
      } else {
        setError(true);
      }
    });
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <AppShell title="Live visitors">
      <VisitorsView sessions={sessions} loaded={loaded} error={error} now={refreshedAt} />
    </AppShell>
  );
}
