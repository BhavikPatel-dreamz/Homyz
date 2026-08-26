import { redisConfig } from "./config";
import { getRedisClient, isRedisAvailable } from "./client";

// The ONE cache abstraction the rest of the app uses. Services call these;
// nothing else touches the Redis client directly (spec §5).
//
// Every function is FAIL-OPEN: on any Redis error, timeout, or unavailability
// it logs a short warning and behaves as a cache miss / no-op, so the caller
// transparently falls back to the database. None of these ever throw — that
// property is load-bearing (apiHandler maps unknown throws to 500, and RSC
// pages call services with no try/catch).

function logOpFailure(op: string, err: unknown): void {
  const reason = err instanceof Error ? err.message : String(err);
  console.warn(`[redis] ${op} failed (${reason}) — using database`);
}

/**
 * Ceiling on any single Redis command so a hung/slow server can never stall a
 * request. The losing command settles in the background and is ignored. This
 * is belt-and-suspenders over enableOfflineQueue:false + maxRetriesPerRequest.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_resolve, reject) => {
      const t = setTimeout(() => reject(new Error("operation timed out")), ms);
      (t as { unref?: () => void }).unref?.();
    }),
  ]);
}

/** Get + JSON.parse a value. Returns null on miss, disabled, or any error. */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return null;
    const raw = await withTimeout(client.get(key), redisConfig.connectTimeout);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logOpFailure("get", err);
    return null;
  }
}

/** JSON.stringify + set with a TTL (seconds). No-op on disabled/any error. */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return;
    const ttl = Math.max(1, Math.trunc(ttlSeconds ?? redisConfig.defaultTtl));
    const payload = JSON.stringify(value);
    await withTimeout(client.set(key, payload, "EX", ttl), redisConfig.connectTimeout);
  } catch (err) {
    logOpFailure("set", err);
  }
}

/** Delete one or more keys. No-op on disabled/any error. */
export async function deleteCache(...cacheKeys: string[]): Promise<void> {
  if (cacheKeys.length === 0) return;
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return;
    await withTimeout(client.del(...cacheKeys), redisConfig.connectTimeout);
  } catch (err) {
    logOpFailure("del", err);
  }
}

/** True if the key exists. Returns false on disabled/any error. */
export async function hasCache(key: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return false;
    const n = await withTimeout(client.exists(key), redisConfig.connectTimeout);
    return n === 1;
  } catch (err) {
    logOpFailure("exists", err);
    return false;
  }
}

/**
 * Delete every key matching a glob pattern via a non-blocking SCAN. Provided
 * for ops / rare bulk invalidation — hot mutation paths use O(1) version-tag
 * bumps (incrCounter) instead, to avoid a keyspace scan on every write.
 */
export async function deleteCacheByPattern(pattern: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return;
    const stream = client.scanStream({ match: pattern, count: 100 });
    const deletes: Promise<unknown>[] = [];
    for await (const batch of stream as AsyncIterable<string[]>) {
      if (batch.length > 0) deletes.push(client.del(...batch));
    }
    await Promise.all(deletes);
  } catch (err) {
    logOpFailure("scan", err);
  }
}

/** Atomically increment a counter (used for version-tag invalidation). */
export async function incrCounter(key: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return;
    await withTimeout(client.incr(key), redisConfig.connectTimeout);
  } catch (err) {
    logOpFailure("incr", err);
  }
}

/** Read a counter's current value. Returns 0 when unset/disabled/any error. */
export async function getCounter(key: string): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client || !isRedisAvailable()) return 0;
    const raw = await withTimeout(client.get(key), redisConfig.connectTimeout);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch (err) {
    logOpFailure("get", err);
    return 0;
  }
}

// In-process de-duplication of concurrent misses for the same key. A burst of
// simultaneous requests that all miss will trigger a SINGLE database fetch;
// the rest await its result. Lightweight stampede protection within one Node
// process (spec §15) — not a distributed lock, which these endpoints don't warrant.
const inflight = new Map<string, Promise<unknown>>();

/**
 * Cache-aside wrapper (spec §6):
 *   hit  → return the cached value (revived to its declared type if `revive` given)
 *   miss → fetchFn() (the source of truth), populate the cache best-effort,
 *          and return the fresh value.
 *
 * `revive` restores types lost to JSON (e.g. Date) on a HIT; the MISS path
 * returns fetchFn's value untouched (already correctly typed). If Redis is
 * unavailable this degrades to calling fetchFn directly. Errors thrown by
 * fetchFn (e.g. AppError.notFound) propagate normally; only Redis errors are
 * swallowed.
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  opts?: { ttl?: number; revive?: (raw: T) => T },
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return opts?.revive ? opts.revive(cached) : cached;
  }

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    const fresh = await fetchFn();
    await setCache(key, fresh, opts?.ttl);
    return fresh;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
