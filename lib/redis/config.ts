// Central Redis configuration, read once from the environment.
//
// Redis is an OPTIONAL performance layer. Every value here has a safe default,
// and when `REDIS_URL` is absent (or `REDIS_ENABLED=false`) the whole cache
// layer is disabled and the app falls back to the database. Nothing here throws.

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

export const redisConfig = {
  /** Connection string, e.g. redis://localhost:6379. Empty ⇒ Redis disabled. */
  url: process.env.REDIS_URL?.trim() || "",
  /** Explicit kill-switch: set REDIS_ENABLED=false to disable even if a URL exists. */
  enabled: process.env.REDIS_ENABLED !== "false",
  /** Default TTL (seconds) applied when a caller doesn't pass one. */
  defaultTtl: intFromEnv("REDIS_DEFAULT_TTL", 300),
  /** Connect timeout (ms). Also used as the per-operation timeout ceiling. */
  connectTimeout: intFromEnv("REDIS_CONNECT_TIMEOUT", 2000),
} as const;

/**
 * True only when Redis is both configured (URL present) and not explicitly
 * disabled. This is a static config check — it does NOT mean the server is
 * reachable (see isRedisAvailable() in ./client for live state).
 */
export function isRedisConfigured(): boolean {
  return (
    redisConfig.enabled &&
    redisConfig.url.length > 0 &&
    (redisConfig.url.startsWith("redis://") || redisConfig.url.startsWith("rediss://"))
  );
}
