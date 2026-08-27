import { getServerSession } from "next-auth/next";

import { authOptions } from "./options";
import type { AuthUser } from "./types";

/**
 * Resolve the current web session into a normalized AuthUser, or null.
 * For RSC and Server Actions only (reads the NextAuth cookie via
 * getServerSession). Route handlers use getAuthContext(req) instead.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? null,
    status: session.user.status,
    adminRoleSlug: session.user.adminRoleSlug,
    permissions: session.user.permissions,
  };
}
