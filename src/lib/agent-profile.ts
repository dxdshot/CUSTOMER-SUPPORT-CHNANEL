import { useSyncExternalStore } from "react";
import { DEMO_SITE_KEY } from "./conversations";
import { getSupabase } from "./supabase";

// Without auth the workspace has one agent identity. Every browser computes the
// same id, so a photo set on one device is the same agent on the others.

export type AgentProfile = {
  id: string;
  name: string;
  avatarUrl: string;
  awayMessage: string;
};

const KEY = "chat-platform:agent-profile";
const listeners = new Set<() => void>();
const DEFAULT_AWAY = "We'll reply as soon as possible";
const WORKSPACE_AGENT_ID = `agent-${DEMO_SITE_KEY}`;
const serverProfile: AgentProfile = {
  id: WORKSPACE_AGENT_ID,
  name: "You",
  avatarUrl: "",
  awayMessage: DEFAULT_AWAY,
};

type AgentRow = {
  name: string | null;
  avatar_url: string | null;
  away_message: string | null;
};

let cached: AgentProfile | null = null;
let hydration: Promise<AgentProfile> | null = null;
let hydratedAt = 0;

function rowToProfile(row: AgentRow): AgentProfile {
  return {
    id: WORKSPACE_AGENT_ID,
    name: (row.name ?? "").trim().slice(0, 60) || "You",
    avatarUrl: (row.avatar_url ?? "").trim().slice(0, 500),
    awayMessage: (row.away_message ?? "").trim().slice(0, 200) || DEFAULT_AWAY,
  };
}

function store(next: AgentProfile): AgentProfile {
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Profile is still available in memory.
  }
  listeners.forEach((notify) => notify());
  return next;
}

export function getAgentProfile(): AgentProfile {
  if (typeof window === "undefined") return serverProfile;
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AgentProfile>;
      if (parsed.name) {
        cached = {
          // Legacy caches carry a random per-browser id; the workspace id wins.
          id: WORKSPACE_AGENT_ID,
          name: String(parsed.name).slice(0, 60),
          avatarUrl: parsed.avatarUrl ? String(parsed.avatarUrl) : "",
          awayMessage: parsed.awayMessage
            ? String(parsed.awayMessage).slice(0, 200)
            : DEFAULT_AWAY,
        };
        return cached;
      }
    }
  } catch {
    // Storage blocked: fall through to a fresh in-memory profile.
  }
  cached = {
    id: WORKSPACE_AGENT_ID,
    name: "You",
    avatarUrl: "",
    awayMessage: DEFAULT_AWAY,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Identity still works for this tab.
  }
  return cached;
}

/**
 * Pulls the workspace profile from the database. localStorage is only a cache:
 * whichever device loaded last cannot overwrite a photo saved elsewhere unless
 * the user saves from that device.
 */
export function hydrateAgentProfile(): Promise<AgentProfile> {
  if (typeof window === "undefined") return Promise.resolve(serverProfile);
  if (hydration) return hydration;
  const client = getSupabase();
  if (!client) return Promise.resolve(getAgentProfile());
  if (Date.now() - hydratedAt < 5_000) return Promise.resolve(getAgentProfile());
  hydration = (async () => {
    const { data: row } = await client
      .from("agents")
      .select("name, avatar_url, away_message")
      .eq("id", WORKSPACE_AGENT_ID)
      .maybeSingle();
    hydratedAt = Date.now();
    if (row) return store(rowToProfile(row as AgentRow));

    // First load after this change: seed the shared row. Prefer a legacy row
    // that already has a photo so an uploaded avatar is not lost.
    const { data: legacy } = await client
      .from("agents")
      .select("name, avatar_url, away_message")
      .neq("id", WORKSPACE_AGENT_ID)
      .not("avatar_url", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const seed = legacy ? rowToProfile(legacy as AgentRow) : getAgentProfile();
    await client
      .from("agents")
      .upsert(
        {
          id: WORKSPACE_AGENT_ID,
          name: seed.name,
          avatar_url: seed.avatarUrl || null,
          away_message: seed.awayMessage,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    const { data: settled } = await client
      .from("agents")
      .select("name, avatar_url, away_message")
      .eq("id", WORKSPACE_AGENT_ID)
      .maybeSingle();
    return store(settled ? rowToProfile(settled as AgentRow) : seed);
  })()
    .catch(() => getAgentProfile())
    .finally(() => {
      hydration = null;
    });
  return hydration;
}

export async function saveAgentProfile(update: Partial<AgentProfile>): Promise<boolean> {
  const current = getAgentProfile();
  const next: AgentProfile = {
    id: WORKSPACE_AGENT_ID,
    name: (update.name ?? current.name).trim().slice(0, 60) || "You",
    avatarUrl: (update.avatarUrl ?? current.avatarUrl).trim().slice(0, 500),
    awayMessage:
      (update.awayMessage ?? current.awayMessage).trim().slice(0, 200) || DEFAULT_AWAY,
  };
  store(next);
  const client = getSupabase();
  if (client) {
    const { error } = await client
      .from("agents")
      .upsert(
        {
          id: WORKSPACE_AGENT_ID,
          name: next.name,
          avatar_url: next.avatarUrl || null,
          away_message: next.awayMessage,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    return !error;
  }
  return true;
}

/** Dashboard heartbeat: drives the online dot and serves the agent's away line. */
export function heartbeatAgent(profile: AgentProfile): void {
  const client = getSupabase();
  if (!client) return;
  // Update only the heartbeat fields so a stale cached profile can never
  // overwrite a name/photo saved on another device.
  void client
    .from("agents")
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", WORKSPACE_AGENT_ID)
    .select("id")
    .maybeSingle()
    .then(({ data }) => {
      if (data) return undefined;
      return client.from("agents").upsert(
        {
          id: WORKSPACE_AGENT_ID,
          name: profile.name,
          avatar_url: profile.avatarUrl || null,
          away_message: profile.awayMessage,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    })
    .then(() => undefined);
}

function subscribeAgentProfile(notify: () => void) {
  listeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    cached = null;
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAgentProfile(): AgentProfile {
  return useSyncExternalStore(subscribeAgentProfile, getAgentProfile, () => serverProfile);
}
