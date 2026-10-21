import { useSyncExternalStore } from "react";
import { getSupabase } from "./supabase";

// Until authentication is available, agent identity belongs to this browser.

export type AgentProfile = {
  id: string;
  name: string;
  avatarUrl: string;
  awayMessage: string;
};

const KEY = "chat-platform:agent-profile";
const listeners = new Set<() => void>();
const DEFAULT_AWAY = "We'll reply as soon as possible";
const serverProfile: AgentProfile = {
  id: "server",
  name: "You",
  avatarUrl: "",
  awayMessage: DEFAULT_AWAY,
};
let cached: AgentProfile | null = null;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `agent-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function getAgentProfile(): AgentProfile {
  if (typeof window === "undefined") return serverProfile;
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AgentProfile>;
      if (parsed.id && parsed.name) {
        cached = {
          id: String(parsed.id),
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
  cached = { id: createId(), name: "You", avatarUrl: "", awayMessage: DEFAULT_AWAY };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // Identity still works for this tab.
  }
  return cached;
}

export async function saveAgentProfile(update: Partial<AgentProfile>): Promise<boolean> {
  const current = getAgentProfile();
  const next: AgentProfile = {
    id: current.id,
    name: (update.name ?? current.name).trim().slice(0, 60) || "You",
    avatarUrl: (update.avatarUrl ?? current.avatarUrl).trim().slice(0, 500),
    awayMessage:
      (update.awayMessage ?? current.awayMessage).trim().slice(0, 200) || DEFAULT_AWAY,
  };
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Profile is still available in memory.
  }
  listeners.forEach((notify) => notify());
  const client = getSupabase();
  if (client) {
    const { error } = await client
      .from("agents")
      .upsert(
        {
          id: next.id,
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
  void client
    .from("agents")
    .upsert(
      {
        id: profile.id,
        name: profile.name,
        avatar_url: profile.avatarUrl || null,
        away_message: profile.awayMessage,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
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
