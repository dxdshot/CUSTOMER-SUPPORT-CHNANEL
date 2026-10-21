"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cannedResponses as seed, type CannedResponse } from "./mock-data";

/*
 * Canned responses: one store shared by the editor page and the inbox composer.
 * It is mirrored to localStorage, so a response you create or edit survives a
 * reload — without that, leaving the page silently reverted the list to the seed.
 * Supabase replaces this module with a table (see decision.md D13 and D17).
 */
const STORAGE_KEY = "chat-platform:canned-responses";

const isCannedResponse = (value: unknown): value is CannedResponse => {
  const item = value as CannedResponse | null;
  return (
    !!item &&
    typeof item.id === "string" &&
    typeof item.shortcut === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.usedCount === "number"
  );
};

function readStored(): CannedResponse[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isCannedResponse);
  } catch {
    return null;
  }
}

// The server always starts from the seed so hydration matches; the client starts
// from whatever the agent saved last.
let responses: CannedResponse[] = typeof window === "undefined" ? seed : (readStored() ?? seed);

const listeners = new Set<() => void>();

export function getCannedResponses(): CannedResponse[] {
  return responses;
}

export function saveCannedResponses(next: CannedResponse[]) {
  responses = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked or full; the in-memory list still works for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Live read, for anything that shows canned responses. */
export function useCannedResponses(): CannedResponse[] {
  return useSyncExternalStore(subscribe, getCannedResponses, () => seed);
}

/** Read + commit, for the page that owns editing. */
export function useCannedResponseStore() {
  const items = useCannedResponses();
  const commit = useCallback((next: CannedResponse[]) => saveCannedResponses(next), []);
  return [items, commit] as const;
}
