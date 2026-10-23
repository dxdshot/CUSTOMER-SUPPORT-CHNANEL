"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { VisitorSheet } from "@/components/inbox/visitor-sheet";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import WorldMap, { type MapDot } from "@/components/ui/world-map";
import { DEMO_SITE_KEY, siteIdFor } from "@/lib/conversations";
import type { Visitor } from "@/lib/mock-data";
import { getSupabase } from "@/lib/supabase";

type Session = {
  session_id: string; visitor_id: string; visitor_name: string | null; visitor_email: string | null;
  country: string | null; flag: string | null; browser: string | null; os: string | null;
  device: string | null; timezone: string | null; current_page: string | null;
  page_views: number; started_at: string; last_seen_at: string;
};

const locations: Record<string, [number, number]> = {
  US: [39, -98], CA: [56, -106], MX: [23, -102], BR: [-14, -52], AR: [-38, -64],
  GB: [54, -2], IE: [53, -8], FR: [46, 2], DE: [51, 10], NL: [52, 5],
  ES: [40, -4], PT: [39, -8], IT: [42, 12], CH: [47, 8], SE: [62, 15],
  NO: [62, 10], PL: [52, 19], UA: [49, 32], RU: [61, 95], TR: [39, 35],
  IN: [22, 79], PK: [30, 70], BD: [24, 90], CN: [35, 104], JP: [36, 138],
  KR: [36, 128], SG: [1, 104], ID: [-2, 118], PH: [13, 122], TH: [15, 101],
  VN: [16, 108], AU: [-25, 134], NZ: [-41, 174], ZA: [-29, 24], NG: [9, 8],
  KE: [0, 38], EG: [27, 30], AE: [24, 54], SA: [24, 45], IL: [31, 35],
};

function toVisitor(session: Session, count: number): Visitor {
  const device = session.device === "phone" || session.device === "tablet" || session.device === "laptop"
    ? session.device : "desktop";
  let country = session.country || "";
  if (country) {
    try { country = new Intl.DisplayNames(["en"], { type: "region" }).of(country) || country; }
    catch { /* Keep the country code. */ }
  }
  return {
    id: session.visitor_id, name: session.visitor_name?.trim() || `Visitor ${session.visitor_id.slice(0, 8)}`,
    email: session.visitor_email || "", country, flag: session.flag || "",
    browser: session.browser || "", os: session.os || "", device, timezone: session.timezone || "",
    firstSeen: new Date(session.started_at).toLocaleString(), sessionCount: count,
    currentPage: session.current_page || "", journey: [],
  };
}

async function loadSessions(): Promise<Session[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const siteId = await siteIdFor(client, DEMO_SITE_KEY);
  if (!siteId) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows: Session[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client.from("visitor_sessions")
      .select("session_id, visitor_id, visitor_name, visitor_email, country, flag, browser, os, device, timezone, current_page, page_views, started_at, last_seen_at")
      .eq("site_id", siteId).gte("last_seen_at", today.toISOString())
      .order("last_seen_at", { ascending: false }).range(start, start + 999);
    if (error || !data) return null;
    rows.push(...(data as Session[]));
    if (data.length < 1000) return rows;
  }
}

type MetricValue =
  | { state: "loading" }
  | { state: "ready"; value: string }
  | { state: "unavailable" };

function MetricCard({ label, value }: { label: string; value: MetricValue }) {
  return (
    <div className="flex min-h-[88px] flex-col justify-between rounded-[16px] border border-[#343434] bg-[#252525] px-4 py-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.025)]">
      <span className="text-[14px] font-medium leading-5 text-[#aaa]">{label}</span>
      {value.state === "loading" ? (
        <BrandSpinner label={`Loading ${label}`} className="h-7 text-[#3b82f6]" />
      ) : value.state === "ready" ? (
        <strong className="text-[26px] font-semibold leading-7 tabular-nums text-white">{value.value}</strong>
      ) : (
        <span className="text-xs font-medium text-[#aaa]">Unavailable</span>
      )}
    </div>
  );
}

export default function VisitorsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState(0);
  useEffect(() => {
    let mounted = true;
    const refresh = () => void loadSessions().then((rows) => {
      if (!mounted) return;
      setLoaded(true);
      if (rows) { setSessions(rows); setRefreshedAt(Date.now()); setError(false); }
      else setError(true);
    });
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  const data = useMemo(() => {
    const now = refreshedAt;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const visits = sessions.filter((row) => new Date(row.started_at).getTime() >= today.getTime());
    const active = sessions.filter((row) => now - new Date(row.last_seen_at).getTime() < 90_000);
    const latest = new Map<string, Session>();
    for (const row of active) if (!latest.has(row.visitor_id)) latest.set(row.visitor_id, row);
    const completed = visits.filter((row) => now - new Date(row.last_seen_at).getTime() >= 90_000);
    const counts = new Map<string, number>();
    for (const row of visits) counts.set(row.visitor_id, (counts.get(row.visitor_id) ?? 0) + 1);
    const visitors = [...latest.values()].map((row) => ({ row, profile: toVisitor(row, counts.get(row.visitor_id) ?? 1) }));
    const dots: MapDot[] = visitors.flatMap(({ row, profile }) => {
      const point = locations[row.country || ""];
      return point
        ? [{
            id: row.visitor_id,
            start: { lat: point[0], lng: point[1], label: profile.name },
            end: { lat: point[0], lng: point[1], label: profile.name },
          }]
        : [];
    });
    return {
      visitors, dots, unique: new Set(active.map((row) => row.visitor_id)).size, visits: visits.length,
      bounce: completed.length ? Math.round(completed.filter((row) => row.page_views === 1).length / completed.length * 100) : 0,
    };
  }, [sessions, refreshedAt]);
  const selected = data.visitors.find(({ profile }) => profile.id === selectedId)?.profile;
  const metricValue = (value: string): MetricValue => {
    if (!loaded) return { state: "loading" };
    if (error) return { state: "unavailable" };
    return { state: "ready", value };
  };

  return (
    <AppShell title="Live visitors">
      <div className="relative flex min-h-full flex-col gap-6 bg-[#161616] p-5 text-white md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Visitors" value={metricValue(String(data.unique))} />
          <MetricCard label="Visits" value={metricValue(String(data.visits))} />
          <MetricCard label="Bounce rate" value={metricValue(`${data.bounce}%`)} />
        </div>
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <div><h2 className="text-lg font-semibold">Visitors right now</h2><p className="text-sm text-[#999]">Select a dot to open a visitor profile.</p></div>
          </div>
          <WorldMap dots={data.dots} onDotClick={setSelectedId} />
          {error && <p role="status" className="text-sm text-[#aaa]">Live visitor data is unavailable.</p>}
          {data.visitors.filter(({ row }) => !locations[row.country || ""]).map(({ profile }) => (
            <button key={profile.id} type="button" onClick={() => setSelectedId(profile.id)} className="mr-2 rounded-full border border-[#444] px-3 py-1.5 text-sm hover:bg-[#292929] focus-visible:outline-2 focus-visible:outline-blue-400">
              {profile.name} · Location unavailable
            </button>
          ))}
        </section>
        {selected && <VisitorSheet visitor={selected} open onClose={() => setSelectedId(null)} />}
      </div>
    </AppShell>
  );
}
