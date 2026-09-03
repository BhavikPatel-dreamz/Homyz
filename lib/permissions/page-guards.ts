import { forbidden, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";
import { isSuperAdmin, hasPermission } from "@/lib/permissions/permissions";
import { getSafeCallbackUrl } from "@/lib/auth/redirect";

/**
 * Page/RSC guard: require an authenticated user or redirect to /login.
 * `redirect()` returns `never`, so the return value is a non-null AuthUser.
 */
export async function requirePageUser(callbackUrl?: string): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    const safeUrl = callbackUrl ? getSafeCallbackUrl(callbackUrl) : null;
    const suffix = safeUrl ? `?callbackUrl=${encodeURIComponent(safeUrl)}` : "";
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
 * Page/RSC guard: require a specific granular permission or any of multiple permissions.
 * Super Admin or an Admin with explicit permission / wildcard holds access.
 */
export async function requirePagePermission(
  permission: string | string[],
  callbackUrl?: string,
): Promise<AuthUser> {
  const user = await requirePageUser(callbackUrl);
  if (user.status === "SUSPENDED") {
    forbidden();
  }

  if (isSuperAdmin(user)) {
    return user;
  }

  if (Array.isArray(permission)) {
    if (permission.some((p) => hasPermission(user, p))) {
      return user;
    }
  } else if (hasPermission(user, permission)) {
    return user;
  }

  forbidden();
}
