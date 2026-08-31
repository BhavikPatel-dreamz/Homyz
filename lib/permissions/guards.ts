import type { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { getAuthContext } from "@/lib/auth/context";
import type { AuthUser } from "@/lib/auth/types";
import { authorize } from "@/lib/permissions/authorize";
import type { Role } from "@/generated/prisma/enums";
import { isSuperAdmin, hasPermission } from "@/lib/permissions/permissions";

// Route-handler guards: resolve the caller (web cookie or mobile Bearer) and
// enforce auth / role. They throw AppError, which apiHandler maps to the JSON
// error envelope.

export async function requireApiAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthContext(req);
  if (!user) throw AppError.unauthorized();
  return user;
}

export async function requireApiRole(
  req: NextRequest,
  roles: readonly Role[],
): Promise<AuthUser> {
  const user = await getAuthContext(req);
  authorize(user, roles);
  return user;
}

export async function requireApiPermission(
  req: NextRequest,
  permission: string | string[],
): Promise<AuthUser> {
  const user = await requireApiAuth(req);
  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Account is suspended");
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
  throw AppError.forbidden(
    `Missing required permission: ${Array.isArray(permission) ? permission.join(", ") : permission}`
  );
}
