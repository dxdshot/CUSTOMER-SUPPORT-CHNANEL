"use client";

import { useCallback, useEffect, useState } from "react";
import { siteIdFor } from "./conversations";
import { getSupabase } from "./supabase";

/*
 * Site tags are the dashboard's only tag list (D46): no hardcoded options.
 * Every surface reads this table, and a Realtime INSERT/DELETE refreshes the
 * list in every open dashboard tab.
 */

export const TAG_NAME_MAX = 40;

function cleanTagName(value: string): string {
  // Array.from keeps astral characters (emoji) intact when the 40-char cap
  // lands mid-surrogate-pair.
  return Array.from(value.replace(/\s+/g, " ").trim()).slice(0, TAG_NAME_MAX).join("");
}

/** All tag names for a site, or null when Supabase is not configured. */
async function fetchTags(siteKey: string): Promise<string[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const siteId = await siteIdFor(client, siteKey);
  if (!siteId) return null;
  const { data, error } = await client
    .from("tags")
    .select("name")
    .eq("site_id", siteId)
    .order("name");
  if (error || !data) return null;
  return data.map((row) => String(row.name));
}

type CreateTagResult =
  | { ok: true; name: string; created: boolean }
  | { ok: false; reason: "backend" | "invalid" | "failed" };

/**
 * Creates a tag, or returns the existing row when the name matches after case
 * folding. The unique index is (site_id, lower(name)), so two tabs racing on the
 * same name both resolve to one canonical tag.
 */
export async function createTag(siteKey: string, rawName: string): Promise<CreateTagResult> {
  const name = cleanTagName(rawName);
  if (!name) return { ok: false, reason: "invalid" };
  const client = getSupabase();
  if (!client) return { ok: false, reason: "backend" };
  const siteId = await siteIdFor(client, siteKey);
  if (!siteId) return { ok: false, reason: "failed" };

  const { data, error } = await client
    .from("tags")
    .insert({ site_id: siteId, name })
    .select("name")
    .single();
  if (!error && data) return { ok: true, name: String(data.name), created: true };

  if (error?.code === "23505") {
    const { data: rows } = await client.from("tags").select("name").eq("site_id", siteId);
    const existing = (rows ?? []).find(
      (row) => String(row.name).toLowerCase() === name.toLowerCase(),
    );
    if (existing) return { ok: true, name: String(existing.name), created: false };
  }
  return { ok: false, reason: "failed" };
}

/** One hook per dashboard surface; both refresh on the same Realtime events. */
export function useTags(siteKey: string) {
  const [tags, setTags] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const next = await fetchTags(siteKey);
    if (next) setTags(next);
  }, [siteKey]);

  useEffect(() => {
    let active = true;
    const load = () => {
      void fetchTags(siteKey).then((next) => {
        if (active && next) setTags(next);
      });
    };
    load();

    const client = getSupabase();
    const channel = client
      ?.channel("tags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tags" },
        load,
      )
      .subscribe();

    return () => {
      active = false;
      if (client && channel) void client.removeChannel(channel);
    };
  }, [siteKey]);

  return { tags, refresh };
}
