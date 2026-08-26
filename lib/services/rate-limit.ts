import { AppError } from "@/lib/api/errors";

// In-memory sliding-window rate limiter for login attempts.
//
// NOTE: process-local — fine for a single instance / dev. For multi-instance
// production, back this with Redis (same interface). OTP rate limiting is
// enforced separately and durably in auth.service via the OtpCode table
// (resend cooldown + per-code attempt cap).

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
