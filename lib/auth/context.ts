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
    const claims = await verifyAccessToken(authHeader.slice(7).trim());
    if (!claims) return null;
    return { id: claims.sub, role: claims.role, email: null };
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (token?.id && token?.role) {
    return {
      id: token.id,
      role: token.role,
      email: typeof token.email === "string" ? token.email : null,
      status: token.status,
      adminRoleSlug: token.adminRoleSlug,
      permissions: token.permissions,
    };
  }
  return null;
}
