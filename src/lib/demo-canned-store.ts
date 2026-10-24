"use client";

import { useCallback, useSyncExternalStore } from "react";
import { cannedResponses as seed, type CannedResponse } from "./mock-data";

/*
 * Demo-only canned responses. They live in module memory, so edits work across
 * demo pages during a visit but disappear on refresh. Nothing is persisted.
 */
let responses: CannedResponse[] = seed;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return responses;
}

function getServerSnapshot() {
  return seed;
}

export function useDemoCannedResponses() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDemoCannedStore() {
  const items = useDemoCannedResponses();
  const commit = useCallback((next: CannedResponse[]) => {
    responses = next;
    listeners.forEach((listener) => listener());
  }, []);
  return [items, commit] as const;
}
