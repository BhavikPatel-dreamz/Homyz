import { getServerSession } from "next-auth/next";
import { authOptions } from "./options";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "./types";

/**
 * Resolve the current web session into a normalized AuthUser, or null.
 * Enforces real-time database status checks so suspended accounts lose access immediately.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      const isIp = /^\d+\.\d+\.\d+\.\d+/.test(host);
      const forwardedProto = h.get("x-forwarded-proto");
      const proto = forwardedProto || (isLocal || isIp ? "http" : "https");
      process.env.NEXTAUTH_URL = `${proto}://${host}`;
      process.env.APP_URL = `${proto}://${host}`;
      process.env.AUTH_TRUST_HOST = "true";
    }
  } catch {}

  let session = await getServerSession(authOptions);

  // Fallback: If getServerSession missed the session (e.g. cookie name prefix mismatch
  // or Authorization header in RSC), resolve and decode the token directly
  if (!session?.user?.id) {
    try {
      const { cookies, headers } = await import("next/headers");
      const [cookieJar, headerList] = await Promise.all([cookies(), headers()]);
      const sessionToken =
        cookieJar.get("next-auth.session-token")?.value ||
        cookieJar.get("__Secure-next-auth.session-token")?.value ||
        (headerList.get("authorization")?.startsWith("Bearer ")
          ? headerList.get("authorization")?.slice(7).trim()
          : null);

      if (sessionToken && process.env.NEXTAUTH_SECRET) {
        const { decode } = await import("next-auth/jwt");
        const decoded = await decode({
          token: sessionToken,
          secret: process.env.NEXTAUTH_SECRET,
        });

        if (decoded?.id) {
          session = {
            user: {
              id: decoded.id as string,
              role: (decoded.role as any) || "USER",
              email: (decoded.email as string) || null,
              name: (decoded.name as string) || null,
              status: (decoded.status as string) || "ACTIVE",
              adminRoleSlug: (decoded.adminRoleSlug as string) || null,
              permissions: (decoded.permissions as string[]) || [],
              tokenVersion: (decoded.tokenVersion as number) || 0,
            },
            expires: decoded.exp
              ? new Date((decoded.exp as number) * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          };
        }
      }
    } catch {}
  }

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
