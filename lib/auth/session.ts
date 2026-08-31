import { getServerSession } from "next-auth/next";
import { authOptions } from "./options";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "./types";

/**
 * Resolve the current web session into a normalized AuthUser, or null.
 * Enforces real-time database status checks so suspended accounts lose access immediately.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  try {
    const liveUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        status: true,
        role: true,
        tokenVersion: true,
        adminRole: { select: { slug: true } },
      },
    });

    if (!liveUser) return null;

    // If session tokenVersion is older than database, sessions were revoked!
    if (
      session.user.tokenVersion !== undefined &&
      session.user.tokenVersion < liveUser.tokenVersion
    ) {
      return null;
    }

    return {
      id: session.user.id,
      role: liveUser.role,
      email: session.user.email ?? null,
      status: liveUser.status,
      adminRoleSlug: liveUser.adminRole?.slug ?? session.user.adminRoleSlug,
      permissions: session.user.permissions,
      tokenVersion: liveUser.tokenVersion,
    };
  } catch {
    return {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email ?? null,
      status: session.user.status,
      adminRoleSlug: session.user.adminRoleSlug,
      permissions: session.user.permissions,
    };
  }
}
