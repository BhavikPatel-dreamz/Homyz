"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

let unreadCount: number | null = null;
let fetchedAt = 0;
let inFlight: Promise<number | null> | null = null;
let requestGeneration = 0;
const listeners = new Set<Listener>();
const FRESH_FOR_MS = 60_000;

function emit() {
  listeners.forEach((listener) => listener());
}

function setUnreadCount(nextCount: number | null) {
  unreadCount = nextCount;
  fetchedAt = nextCount === null ? 0 : Date.now();
  emit();
}

export function useUnreadNotificationCount() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unreadCount,
    () => null,
  );
}

export function publishUnreadNotificationCount(count: number) {
  setUnreadCount(Math.max(0, Math.trunc(count)));
}

export function invalidateUnreadNotificationCount() {
  fetchedAt = 0;
}

/** Clear process-local state on logout or an account change. */
export function resetUnreadNotificationCount() {
  requestGeneration += 1;
  unreadCount = null;
  fetchedAt = 0;
  inFlight = null;
  emit();
}

export async function refreshUnreadNotificationCount(options?: { force?: boolean }) {
  if (!options?.force && unreadCount !== null && Date.now() - fetchedAt < FRESH_FOR_MS) {
    return unreadCount;
  }
  if (inFlight) return inFlight;

  const generation = requestGeneration;
  const request = fetch("/api/v1/notifications?countOnly=true", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (generation !== requestGeneration) return null;
      if (!response.ok || !payload?.success || typeof payload.data?.unreadCount !== "number") {
        return null;
      }
      publishUnreadNotificationCount(payload.data.unreadCount);
      return unreadCount;
    })
    .catch(() => null)
    .finally(() => {
      if (inFlight === request) inFlight = null;
    });

  inFlight = request;
  return request;
}
