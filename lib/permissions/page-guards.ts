import { forbidden, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";

/**
 * Page/RSC guard: require an authenticated user or redirect to /login.
 * `redirect()` returns `never`, so the return value is a non-null AuthUser.
 */
export async function requirePageUser(callbackUrl?: string): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    const suffix = callbackUrl
      ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "";
    redirect(`/login${suffix}`);
  }
  if (user.status === "SUSPENDED") {
    redirect("/login?error=account_suspended");
  }
  return user;
}

/**
 * Page/RSC guard: require one of `roles`. Unauthenticated → /login;
 * authenticated but wrong role → forbidden() (renders forbidden.tsx / 403).
 * This is the real server-side boundary — proxy.ts redirects are only
 * optimistic.
 */
export async function requirePageRole(
  roles: Role[],
  callbackUrl?: string,
): Promise<AuthUser> {
  const user = await requirePageUser(callbackUrl);
  if (user.status === "SUSPENDED" || !roles.includes(user.role)) {
    forbidden();
  }
  return user;
}

/**
 * Page/RSC guard: require a specific granular permission.
 * Super Admin or unrestricted ADMIN holds all permissions.
 */
export async function requirePagePermission(
  permission: string,
  callbackUrl?: string,
): Promise<AuthUser> {
  const user = await requirePageUser(callbackUrl);
  if (user.status === "SUSPENDED") {
    forbidden();
  }

  // Super Admin / unrestricted ADMIN has all permissions
  if (user.role === Role.ADMIN && (!user.permissions || user.permissions.length === 0 || user.adminRoleSlug === "super_admin")) {
    return user;
  }

  if (user.permissions?.includes("*") || user.permissions?.includes(permission)) {
    return user;
  }

  forbidden();
}
