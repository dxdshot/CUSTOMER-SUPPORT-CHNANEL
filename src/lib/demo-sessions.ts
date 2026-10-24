import type { VisitorSession } from "./visitor-sessions";

/*
 * Visitor sessions for the demo live map. The page passes a fixed clock, so
 * the map renders the same dots on every load.
 */

type SessionSeed = {
  country: string;
  tz: string;
  page: string;
  views: number;
  /** Seconds since the last page view. Under 90 is "online". */
  age: number;
  /** Minutes since the session started. */
  started: number;
};

const sessionSeeds: SessionSeed[] = [
  { country: "US", tz: "PST", page: "/", views: 4, age: 8, started: 42 },
  { country: "GB", tz: "GMT", page: "/pricing", views: 2, age: 14, started: 63 },
  { country: "DE", tz: "CET", page: "/docs/widget", views: 5, age: 22, started: 55 },
  { country: "IN", tz: "IST", page: "/projects", views: 3, age: 5, started: 31 },
  { country: "CA", tz: "EST", page: "/", views: 2, age: 47, started: 84 },
  { country: "FR", tz: "CET", page: "/about", views: 6, age: 33, started: 72 },
  { country: "BR", tz: "BRT", page: "/pricing", views: 2, age: 19, started: 48 },
  { country: "JP", tz: "JST", page: "/", views: 7, age: 61, started: 96 },
  { country: "AU", tz: "AEST", page: "/projects/chat-platform", views: 4, age: 11, started: 27 },
  { country: "SG", tz: "SGT", page: "/docs/widget", views: 3, age: 72, started: 118 },
  { country: "ES", tz: "CET", page: "/pricing", views: 2, age: 38, started: 66 },
  { country: "IT", tz: "CET", page: "/", views: 5, age: 26, started: 44 },
  { country: "SE", tz: "CET", page: "/about", views: 3, age: 54, started: 89 },
  { country: "PL", tz: "CET", page: "/projects", views: 4, age: 44, started: 77 },
  { country: "TR", tz: "TRT", page: "/contact", views: 2, age: 320, started: 103 },
  { country: "AE", tz: "GST", page: "/", views: 6, age: 9, started: 22 },
  { country: "ZA", tz: "SAST", page: "/pricing", views: 3, age: 240, started: 131 },
  { country: "NG", tz: "WAT", page: "/projects", views: 3, age: 58, started: 94 },
  { country: "MX", tz: "CST", page: "/", views: 4, age: 17, started: 39 },
  { country: "KR", tz: "KST", page: "/about", views: 2, age: 50, started: 82 },
  { country: "ID", tz: "WIB", page: "/pricing", views: 5, age: 31, started: 57 },
  { country: "PH", tz: "PHT", page: "/", views: 3, age: 480, started: 101 },
  { country: "VN", tz: "ICT", page: "/docs/widget", views: 2, age: 23, started: 46 },
  { country: "NZ", tz: "NZDT", page: "/about", views: 1, age: 600, started: 142 },
  { country: "CH", tz: "CET", page: "/projects/chat-platform", views: 6, age: 13, started: 35 },
  { country: "NO", tz: "CET", page: "/", views: 4, age: 41, started: 68 },
  { country: "UA", tz: "EET", page: "/pricing", views: 2, age: 300, started: 127 },
  { country: "IL", tz: "IST", page: "/", views: 3, age: 29, started: 53 },
  { country: "SA", tz: "AST", page: "/contact", views: 1, age: 900, started: 92 },
  { country: "TH", tz: "ICT", page: "/projects", views: 5, age: 7, started: 24 },
  { country: "BD", tz: "BST", page: "/pricing", views: 2, age: 46, started: 74 },
  { country: "PK", tz: "PKT", page: "/", views: 4, age: 200, started: 98 },
  { country: "AR", tz: "ART", page: "/about", views: 3, age: 36, started: 61 },
  { country: "KE", tz: "EAT", page: "/contact", views: 1, age: 420, started: 116 },
  { country: "PT", tz: "WET", page: "/", views: 2, age: 20, started: 43 },
];

const BROWSERS = ["Chrome 141", "Safari 18", "Firefox 145", "Edge 141"];
const SYSTEMS = ["macOS 16", "Windows 11", "iOS 19", "Android 16", "Ubuntu 26.04"];
const DEVICES: Array<"desktop" | "laptop" | "phone" | "tablet"> = ["laptop", "desktop", "phone", "tablet"];

function flagFor(code: string) {
  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

export function buildDemoSessions(now = Date.now()): VisitorSession[] {
  return sessionSeeds.map((seed, index) => {
    return {
      session_id: `demo-session-${index + 1}`,
      visitor_id: `demo-visitor-${index + 1}`,
      visitor_name: `Visitor ${index + 15}`,
      visitor_email: null,
      country: seed.country,
      flag: flagFor(seed.country),
      browser: BROWSERS[index % BROWSERS.length],
      os: SYSTEMS[index % SYSTEMS.length],
      device: DEVICES[index % DEVICES.length],
      timezone: seed.tz,
      current_page: seed.page,
      page_views: seed.views,
      started_at: new Date(now - seed.started * 60_000).toISOString(),
      last_seen_at: new Date(now - seed.age * 1000).toISOString(),
    };
  });
}
