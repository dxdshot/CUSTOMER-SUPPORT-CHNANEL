import type { Visitor } from "./mock-data";

/* Shapes shared by the live and demo visitor maps. */

export type VisitorSession = {
  session_id: string;
  visitor_id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  country: string | null;
  flag: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  timezone: string | null;
  current_page: string | null;
  page_views: number;
  started_at: string;
  last_seen_at: string;
};

export const locations: Record<string, [number, number]> = {
  US: [39, -98], CA: [56, -106], MX: [23, -102], BR: [-14, -52], AR: [-38, -64],
  GB: [54, -2], IE: [53, -8], FR: [46, 2], DE: [51, 10], NL: [52, 5],
  ES: [40, -4], PT: [39, -8], IT: [42, 12], CH: [47, 8], SE: [62, 15],
  NO: [62, 10], PL: [52, 19], UA: [49, 32], RU: [61, 95], TR: [39, 35],
  IN: [22, 79], PK: [30, 70], BD: [24, 90], CN: [35, 104], JP: [36, 138],
  KR: [36, 128], SG: [1, 104], ID: [-2, 118], PH: [13, 122], TH: [15, 101],
  VN: [16, 108], AU: [-25, 134], NZ: [-41, 174], ZA: [-29, 24], NG: [9, 8],
  KE: [0, 38], EG: [27, 30], AE: [24, 54], SA: [24, 45], IL: [31, 35],
};

export function toVisitor(session: VisitorSession, count: number): Visitor {
  const device =
    session.device === "phone" || session.device === "tablet" || session.device === "laptop"
      ? session.device
      : "desktop";
  let country = session.country || "";
  if (country) {
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(country) || country;
    } catch {
      // Keep the country code.
    }
  }
  return {
    id: session.visitor_id,
    name: session.visitor_name?.trim() || `Visitor ${session.visitor_id.slice(0, 8)}`,
    email: session.visitor_email || "",
    country,
    flag: session.flag || "",
    browser: session.browser || "",
    os: session.os || "",
    device,
    timezone: session.timezone || "",
    firstSeen: new Date(session.started_at).toLocaleString(),
    sessionCount: count,
    currentPage: session.current_page || "",
    journey: [],
  };
}
