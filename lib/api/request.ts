import type { NextRequest } from "next/server";

/**
 * Extracts request metadata for audit fields on issued refresh tokens.
 * Best-effort: proxies vary, so treat both values as optional.
 */
export function getRequestMeta(req: NextRequest): {
  userAgent: string | null;
  ip: string | null;
} {
  const userAgent = req.headers.get("user-agent");
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? (forwarded.split(",")[0]?.trim() ?? null)
    : (req.headers.get("x-real-ip") ?? null);
  return { userAgent: userAgent ?? null, ip };
}
