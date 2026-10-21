import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Shared Supabase client for the dashboard (agent side).
 *
 * Returns null when the env vars are missing so the dashboard keeps running
 * on seed data — every caller falls back to mocks when there is no client.
 * The widget never imports this: embed.js ships dependency-free and talks
 * to Next API routes instead (see src/widget/embed.ts).
 */

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    client = null;
    return client;
  }
  client = createClient(url, key);
  return client;
}
