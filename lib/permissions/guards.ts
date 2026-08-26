import type { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { getAuthContext } from "@/lib/auth/context";
import type { AuthUser } from "@/lib/auth/types";
import { authorize } from "@/lib/permissions/authorize";
import type { Role } from "@/generated/prisma/enums";

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
