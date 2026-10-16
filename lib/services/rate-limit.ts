import { AppError } from "@/lib/api/errors";
import { getRedisClient, isRedisAvailable } from "@/lib/redis/client";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function checkRateLimitAsync(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    const client = await getRedisClient();
    if (client && isRedisAvailable()) {
      const redisKey = `homyz:ratelimit:${key}`;
      const current = await client.incr(redisKey);
      if (current === 1) {
        await client.expire(redisKey, windowSeconds);
      }
      const ttl = await client.ttl(redisKey);
      if (current > max) {
        return { allowed: false, retryAfter: ttl > 0 ? ttl : windowSeconds };
      }
      return { allowed: true, retryAfter: 0 };
    }
  } catch (_err) {
    // Fail-open to in-memory rate limiting fallback
  }

  return checkRateLimit(key, max, windowSeconds);
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Throw 429 if too many login attempts for this identifier in the window. */
export function assertLoginRateLimit(identifier: string): void {
  const max = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10);
  const windowSeconds = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? 900);
  const { allowed, retryAfter } = checkRateLimit(
    `login:${identifier}`,
    max,
    windowSeconds,
  );
  if (!allowed) {
    throw AppError.rateLimited(
      `Too many login attempts. Try again in ${retryAfter}s.`,
    );
  }
}

export async function assertLoginRateLimitAsync(identifier: string): Promise<void> {
  const max = Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 10);
  const windowSeconds = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS ?? 900);
  const { allowed, retryAfter } = await checkRateLimitAsync(
    `login:${identifier}`,
    max,
    windowSeconds,
  );
  if (!allowed) {
    throw AppError.rateLimited(
      `Too many login attempts. Try again in ${retryAfter}s.`,
    );
  }
}
