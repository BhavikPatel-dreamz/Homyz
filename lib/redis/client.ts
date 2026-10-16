import type { Redis, RedisOptions } from "ioredis";

import { isRedisConfigured, redisConfig } from "./config";

// Reusable, server-safe Redis connection for the Next.js Node runtime.
//
// Design goals (all in service of "Redis is OPTIONAL"):
//   - ONE connection is created and reused across requests and dev hot-reloads
//     (stashed on globalThis, in every environment — connection reuse matters
//     in production too, unlike the prisma singleton which is dev-only).
//   - The ioredis package is loaded via a memoized dynamic import wrapped in
//     try/catch, so if the package isn't installed we return null and bypass
//     the cache rather than crashing at import time (spec §1, §4).
//   - Connections fail fast (short connect timeout, no offline queue, one retry
//     per command) so a down/slow Redis never stalls a request; a background
//     retry strategy lets the client recover on its own.
//   - `available` tracks LIVE health and is reset to true on reconnect, so a
//     single transient blip doesn't disable the cache for the whole process.

type RedisCtor = new (url: string, options: RedisOptions) => Redis;

interface RedisState {
  client: Redis | null;
  /** Live connection health (distinct from "configured"). */
  available: boolean;
  /** In-flight initialization, so concurrent callers share one connect. */
  initPromise: Promise<Redis | null> | null;
  /** The dynamic import failed (package absent) — don't retry it every call. */
  importFailed: boolean;
  /** Whether we've already logged the current "down" state (log once). */
  loggedDown: boolean;
}

const globalForRedis = globalThis as unknown as {
  __homyzRedis?: RedisState;
};

const state: RedisState = (globalForRedis.__homyzRedis ??= {
  client: null,
  available: false,
  initPromise: null,
  importFailed: false,
  loggedDown: false,
});

function log(message: string): void {
  // Follows the app's `[api]`/`[action]` console convention. Never logs the
  // URL/credentials or any cached value.
  console.warn(`[redis] ${message}`);
}

async function loadRedisCtor(): Promise<RedisCtor | null> {
  try {
    const mod = (await import("ioredis")) as unknown as {
      default?: RedisCtor;
      Redis?: RedisCtor;
    };
    const ctor = mod.default ?? mod.Redis;
    return ctor ?? null;
  } catch {
    return null;
  }
}

async function init(): Promise<Redis | null> {
  const RedisCtor = await loadRedisCtor();
  if (!RedisCtor) {
    state.importFailed = true;
    log("ioredis package not installed — cache disabled, using database only");
    return null;
  }

  const client = new RedisCtor(redisConfig.url, {
    lazyConnect: true, // connect on first command, not at construction
    connectTimeout: redisConfig.connectTimeout,
    maxRetriesPerRequest: 1, // fail a command fast rather than hang
    enableOfflineQueue: false, // don't buffer commands while disconnected
    // Keep trying to reconnect in the background (bounded backoff) so the
    // cache can recover after an outage without a process restart.
    retryStrategy: (times: number) => Math.min(times * 200, 2000),
  });

  // An 'error' listener is mandatory — without it ioredis throws an unhandled
  // error event and crashes the process. We swallow it and fall back to the DB.
  client.on("error", () => {
    state.available = false;
    if (!state.loggedDown) {
      state.loggedDown = true;
      log("connection error — falling back to database");
    }
  });
  client.on("end", () => {
    state.available = false;
  });
  const markUp = () => {
    state.available = true;
    if (state.loggedDown) {
      state.loggedDown = false;
      log("connection restored");
    }
  };
  client.on("ready", markUp);
  client.on("connect", markUp);

  try {
    await client.connect();
    state.available = true;
  } catch {
    // Unreachable at startup: keep the client (its retryStrategy will keep
    // trying) but stay unavailable so callers bypass to the DB meanwhile.
    state.available = false;
    if (!state.loggedDown) {
      state.loggedDown = true;
      log("initial connection failed — falling back to database");
    }
  }

  state.client = client;
  return client;
}

/**
 * Returns the shared Redis client, or null when Redis is unconfigured, the
 * package is missing, or initialization failed. Callers must treat null as
 * "cache disabled" and go straight to the database. Never throws.
 */
export async function getRedisClient(): Promise<Redis | null> {
  if (!isRedisConfigured() || state.importFailed) return null;
  if (state.client) return state.client;
  state.initPromise ??= init().finally(() => {
    state.initPromise = null;
  });
  return state.initPromise;
}

/** Live connection health. False when disabled, unreachable, or degraded. */
export function isRedisAvailable(): boolean {
  return state.available;
}

/**
 * Active health probe for the /health endpoint. Never throws:
 *   "disabled"    — Redis not configured, or the package isn't installed
 *   "healthy"     — PING returned PONG within the timeout
 *   "unavailable" — configured but the PING failed or timed out
 */
export async function pingRedis(): Promise<
  "disabled" | "healthy" | "unavailable"
> {
  if (!isRedisConfigured()) return "disabled";
  try {
    const client = await getRedisClient();
    if (!client) return "disabled";
    const pong = await Promise.race([
      client.ping(),
      new Promise<string>((_resolve, reject) => {
        const t = setTimeout(
          () => reject(new Error("ping timed out")),
          redisConfig.connectTimeout,
        );
        (t as { unref?: () => void }).unref?.();
      }),
    ]);
    return pong === "PONG" ? "healthy" : "unavailable";
  } catch {
    return "unavailable";
  }
}

/** Close the connection (tests / graceful shutdown). Safe to call anytime. */
export async function closeRedis(): Promise<void> {
  const client = state.client;
  state.client = null;
  state.available = false;
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}
