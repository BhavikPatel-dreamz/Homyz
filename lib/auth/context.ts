import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import type { AuthUser } from "./types";
import { verifyAccessToken } from "./tokens";

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
      return { id: claims.sub, role: claims.role, email: null };
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
          return {
            id: decoded.id as string,
            role: decoded.role as any,
            email: typeof decoded.email === "string" ? decoded.email : null,
            status: decoded.status as string | undefined,
            adminRoleSlug: decoded.adminRoleSlug as string | null | undefined,
            permissions: (decoded.permissions as string[]) || ["*"],
          };
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
    return {
      id: token.id,
      role: token.role,
      email: typeof token.email === "string" ? token.email : null,
      status: token.status,
      adminRoleSlug: token.adminRoleSlug,
      permissions: token.permissions || ["*"],
    };
  }

  // Development mode fallback: auto-resolve active Admin user if session token is missing/expired in dev
  if (process.env.NODE_ENV !== "production") {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const devAdmin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          adminRole: { select: { slug: true } },
        },
      });

      if (devAdmin) {
        return {
          id: devAdmin.id,
          role: devAdmin.role,
          email: devAdmin.email,
          status: devAdmin.status || "ACTIVE",
          adminRoleSlug: devAdmin.adminRole?.slug || "super_admin",
          permissions: ["*"],
        };
      }
    } catch (err) {
      console.error("[getAuthContext] Dev auth fallback error:", err);
    }
  }

  return null;
}
