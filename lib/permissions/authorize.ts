import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { Role } from "@/generated/prisma/enums";

// Centralized authorization primitives. Services and guards call these; they
// throw AppError (401/403) which apiHandler / page guards translate. This is
// the ONE place role + ownership rules live.

/** Assert the user is authenticated AND holds one of the allowed roles. */
export function authorize(
  user: AuthUser | null,
  roles: readonly Role[],
): asserts user is AuthUser {
  if (!user) throw AppError.unauthorized();
  if (!roles.includes(user.role)) throw AppError.forbidden();
}

/** Alias of `authorize` with a name that reads well at call sites. */
export function assertRole(
  user: AuthUser | null,
  roles: readonly Role[],
): asserts user is AuthUser {
  authorize(user, roles);
}

/**
 * Assert the user owns the resource (by owner id). ADMIN bypasses ownership.
 * Enforces the spec rule: Host A cannot touch Host B's resource (403), Admin can.
 */
export function assertOwnership(
  user: AuthUser | null,
  ownerId: string,
): asserts user is AuthUser {
  if (!user) throw AppError.unauthorized();
  if (user.role === Role.ADMIN) return;
  if (user.id !== ownerId) {
    throw AppError.forbidden("You do not have access to this resource");
  }
}
