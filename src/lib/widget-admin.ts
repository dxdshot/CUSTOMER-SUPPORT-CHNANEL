import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Server-only Supabase access for widget routes (D35). One client, one cached
 * site lookup — the widget polls every 0.8s while open, so a per-request site
 * query would be pure overhead.
 */

export type WidgetSite = {
  id: string;
  site_key: string;
  agent_online_at: string | null;
  hours_start: number;
  hours_end: number;
  timezone: string;
  away_message: string;
  welcome_message: string;
  welcome_notify: boolean;
  preset_messages: unknown;
  /** Site tags offered as topic choices (D47). Empty when none exist. */
  tags: string[];
};

let client: SupabaseClient | null | undefined;

export function widgetClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

// One-second TTL keeps settings responsive without querying the site on every poll.
const cache = new Map<string, { row: WidgetSite; at: number }>();
const TTL = 1000;

export async function widgetSite(siteKey: string): Promise<WidgetSite | null> {
  const now = Date.now();
  const hit = cache.get(siteKey);
  if (hit && now - hit.at < TTL) return hit.row;
  const supabase = widgetClient();
  if (!supabase) return null;
  const baseSelect = "id, site_key, agent_online_at, hours_start, hours_end, timezone, away_message, welcome_message, preset_messages";
  let data: Record<string, unknown> | null = null;
  const primary = await supabase
    .from("sites")
    .select(`${baseSelect}, welcome_notify`)
    .eq("site_key", siteKey)
    .maybeSingle();
  if (primary.data) {
    data = primary.data as Record<string, unknown>;
  } else if (primary.error) {
    // Pre-D50 installs: keep the widget working with notifications off.
    const fallback = await supabase
      .from("sites")
      .select(baseSelect)
      .eq("site_key", siteKey)
      .maybeSingle();
    if (!fallback.data) return null;
    data = { ...(fallback.data as Record<string, unknown>), welcome_notify: false };
  } else {
    return null;
  }
  const siteId = String(data.id);
  // Tags are a separate query on purpose: an install that has not run the tags
  // migration keeps working, with no topic prompt. Errors mean "no tags".
  const { data: tagRows } = await supabase
    .from("tags")
    .select("name")
    .eq("site_id", siteId)
    .order("name");
  const row = {
    ...data,
    tags: (tagRows ?? []).map((tag) => String(tag.name)),
  } as WidgetSite;
  cache.set(siteKey, { row, at: now });
  return row;
}
