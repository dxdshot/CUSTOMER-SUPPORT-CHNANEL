"use client";

import { useMemo, useState } from "react";
import { VisitorSheet } from "@/components/inbox/visitor-sheet";
import { BrandSpinner } from "@/components/ui/brand-spinner";
import WorldMap, { type MapDot } from "@/components/ui/world-map";
import { locations, toVisitor, type VisitorSession } from "@/lib/visitor-sessions";

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

/* Shared by the live dashboard and the public /demo page. */
export function VisitorsView({
  sessions,
  loaded,
  error,
  now,
}: {
  sessions: VisitorSession[];
  loaded: boolean;
  error: boolean;
  now: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const data = useMemo(() => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const visits = sessions.filter((row) => new Date(row.started_at).getTime() >= today.getTime());
    const active = sessions.filter((row) => now - new Date(row.last_seen_at).getTime() < 90_000);
    const latest = new Map<string, VisitorSession>();
    for (const row of active) if (!latest.has(row.visitor_id)) latest.set(row.visitor_id, row);
    const completed = visits.filter((row) => now - new Date(row.last_seen_at).getTime() >= 90_000);
    const counts = new Map<string, number>();
    for (const row of visits) counts.set(row.visitor_id, (counts.get(row.visitor_id) ?? 0) + 1);
    const visitors = [...latest.values()].map((row) => ({
      row,
      profile: toVisitor(row, counts.get(row.visitor_id) ?? 1),
    }));
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
      visitors,
      dots,
      unique: new Set(active.map((row) => row.visitor_id)).size,
      visits: visits.length,
      bounce: completed.length
        ? Math.round((completed.filter((row) => row.page_views === 1).length / completed.length) * 100)
        : 0,
    };
  }, [sessions, now]);

  const selected = data.visitors.find(({ profile }) => profile.id === selectedId)?.profile;
  const metricValue = (value: string): MetricValue => {
    if (!loaded) return { state: "loading" };
    if (error) return { state: "unavailable" };
    return { state: "ready", value };
  };

  return (
    <div className="relative flex min-h-full flex-col gap-6 bg-[#161616] p-5 text-white md:p-8">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Visitors" value={metricValue(String(data.unique))} />
        <MetricCard label="Visits" value={metricValue(String(data.visits))} />
        <MetricCard label="Bounce rate" value={metricValue(`${data.bounce}%`)} />
      </div>
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Visitors right now</h2>
            <p className="text-sm text-[#999]">Select a dot to open a visitor profile.</p>
          </div>
        </div>
        <WorldMap dots={data.dots} onDotClick={setSelectedId} />
        {error && <p role="status" className="text-sm text-[#aaa]">Live visitor data is unavailable.</p>}
        {data.visitors.filter(({ row }) => !locations[row.country || ""]).map(({ profile }) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => setSelectedId(profile.id)}
            className="mr-2 rounded-full border border-[#444] px-3 py-1.5 text-sm hover:bg-[#292929] focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            {profile.name} · Location unavailable
          </button>
        ))}
      </section>
      {selected && <VisitorSheet visitor={selected} open onClose={() => setSelectedId(null)} />}
    </div>
  );
}
