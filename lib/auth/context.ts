import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { AuthUser } from "./types";
import { verifyAccessToken } from "./tokens";
import { authService } from "@/services/auth.service";
import type { Role } from "@/generated/prisma/enums";

/**
 * A JWT proves who signed in, but is not authoritative for the current role,
 * account status, or permission set. Refresh those claims at the API boundary
 * so a suspension, role change, or session revocation takes effect immediately.
 */
async function resolveLiveAuthUser(candidate: AuthUser): Promise<AuthUser | null> {
  const liveUser = await authService.getLiveSessionUser(candidate.id).catch(() => null);
  if (!liveUser) return null;

  if (
    candidate.tokenVersion !== undefined &&
    candidate.tokenVersion < liveUser.tokenVersion
  ) {
    return null;
  }

  const permissions =
    liveUser.role === "ADMIN" || liveUser.adminRole
      ? await import("@/lib/permissions/admin-permission-service")
          .then(({ getEffectivePermissionsForUser }) =>
            getEffectivePermissionsForUser(
              candidate.id,
              liveUser.role,
              liveUser.adminRole?.slug,
            ),
          )
          .catch(() => [])
      : [];

  return {
    ...candidate,
    role: liveUser.role,
    status: liveUser.status,
    adminRoleSlug: liveUser.adminRole?.slug ?? null,
    permissions,
    tokenVersion: liveUser.tokenVersion,
  };
}

// Resolves the caller identity for ROUTE HANDLERS (the unified web + mobile
// entry point). Mobile sends `Authorization: Bearer <access token>` (our own
// HS256 token); web sends the NextAuth session cookie. We check the Bearer
// token first with our verifier so NextAuth never tries to decode it, then
// fall back to the NextAuth cookie via getToken().
export async function getAuthContext(
  req: NextRequest,
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const rawBearer = authHeader.slice(7).trim();
    const claims = await verifyAccessToken(rawBearer);
    if (claims) {
      return resolveLiveAuthUser({ id: claims.sub, role: claims.role, email: null });
    }

    // Also support passing NextAuth session tokens via Bearer header
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    if (nextAuthSecret) {
      try {
        const { decode } = await import("next-auth/jwt");
        const decoded = await decode({
          token: rawBearer,
          secret: nextAuthSecret,
        });
        if (decoded?.id && decoded?.role) {
          return resolveLiveAuthUser({
            id: decoded.id as string,
            role: decoded.role as Role,
            email: typeof decoded.email === "string" ? decoded.email : null,
            status: decoded.status as string | undefined,
            adminRoleSlug: decoded.adminRoleSlug as string | null | undefined,
            permissions: (decoded.permissions as string[]) || [],
            tokenVersion: decoded.tokenVersion as number | undefined,
          });
        }
      } catch {}
    }

    return null;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  let token = await getToken({ req, secret });

  // Fallback check for secure vs non-secure cookie name mismatch (e.g. curl/dev proxy)
  if (!token) {
    token = await getToken({ req, secret, secureCookie: false });
  }
  if (!token) {
    token = await getToken({ req, secret, secureCookie: true });
  }

  if (token?.id && token?.role) {
    return resolveLiveAuthUser({
      id: token.id,
      role: token.role,
      email: typeof token.email === "string" ? token.email : null,
      status: token.status,
      adminRoleSlug: token.adminRoleSlug,
      permissions: token.permissions || [],
      tokenVersion: token.tokenVersion as number | undefined,
    });
  }

  return null;
}
