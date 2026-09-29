import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { cache } from "react";
import { authOptions } from "./options";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "./types";
import type { Role } from "@/generated/prisma/enums";
import { getMissingProfileFields } from "./profile-completion";

// React scopes this memoization to the current server render/request. Root
// session hydration and protected page guards therefore share one NextAuth
// resolution instead of repeating the same cookie/database work.
export const getAuthSession = cache(async (): Promise<Session | null> => {
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    if (host) {
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      const isIp = /^\d+\.\d+\.\d+\.\d+/.test(host);
      const forwardedProto = headerList.get("x-forwarded-proto");
      const proto = forwardedProto || (isLocal || isIp ? "http" : "https");
      process.env.NEXTAUTH_URL = `${proto}://${host}`;
      process.env.APP_URL = `${proto}://${host}`;
      process.env.AUTH_TRUST_HOST = "true";
    }
  } catch {}

  const resolved = await getServerSession(authOptions);
  if (resolved?.user?.id) return resolved;

  // Preserve the existing secure/non-secure cookie recovery path, but expose
  // it to the root provider as well as page guards so both surfaces agree.
  try {
    const { cookies, headers } = await import("next/headers");
    const [cookieJar, headerList] = await Promise.all([cookies(), headers()]);
    const sessionToken =
      cookieJar.get("next-auth.session-token")?.value ||
      cookieJar.get("__Secure-next-auth.session-token")?.value ||
      (headerList.get("authorization")?.startsWith("Bearer ")
        ? headerList.get("authorization")?.slice(7).trim()
        : null);

    if (!sessionToken || !process.env.NEXTAUTH_SECRET) return null;

    const { decode } = await import("next-auth/jwt");
    const decoded = await decode({
      token: sessionToken,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!decoded?.id) return null;

    const dbUser = await authService.getSessionClaims(decoded.id as string).catch(() => null);
    const missingProfileFields = dbUser
      ? dbUser.role === "ADMIN" || dbUser.adminRole
        ? []
        : getMissingProfileFields(dbUser)
      : (decoded.missingProfileFields as AuthUser["missingProfileFields"] | undefined) ?? [];

    return {
      user: {
        id: decoded.id as string,
        role: dbUser?.role ?? (decoded.role as Role | undefined) ?? ("USER" as Role),
        email: dbUser?.email ?? (typeof decoded.email === "string" ? decoded.email : null),
        name: dbUser?.name ?? (typeof decoded.name === "string" ? decoded.name : null),
        image: dbUser?.image ?? (typeof decoded.picture === "string" ? decoded.picture : null),
        status: dbUser?.status ?? (decoded.status as string | undefined),
        adminRoleSlug: dbUser?.adminRole?.slug ?? (decoded.adminRoleSlug as string | null | undefined),
        permissions: (decoded.permissions as string[]) ?? [],
        tokenVersion: dbUser?.tokenVersion ?? (decoded.tokenVersion as number | undefined),
        profileComplete: missingProfileFields.length === 0,
        missingProfileFields,
      },
      expires: decoded.exp
        ? new Date((decoded.exp as number) * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch {
    return null;
  }
});

/**
 * Resolve the current web session into a normalized AuthUser, or null.
 * Enforces real-time database status checks so suspended accounts lose access immediately.
 */
export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getAuthSession();

  if (!session?.user?.id) return null;

  try {
    const liveUser = await authService.getLiveSessionUser(session.user.id);

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
      profileComplete: session.user.profileComplete,
      missingProfileFields: session.user.missingProfileFields,
    };
  } catch {
    return {
      id: session.user.id,
      role: session.user.role,
      email: session.user.email ?? null,
      status: session.user.status,
      adminRoleSlug: session.user.adminRoleSlug,
      permissions: session.user.permissions,
      profileComplete: session.user.profileComplete,
      missingProfileFields: session.user.missingProfileFields,
    };
  }
});
