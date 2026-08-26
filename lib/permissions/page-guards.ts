import { forbidden, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";
import type { Role } from "@/generated/prisma/enums";

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
  if (!roles.includes(user.role)) {
    forbidden();
  }
  return user;
}
