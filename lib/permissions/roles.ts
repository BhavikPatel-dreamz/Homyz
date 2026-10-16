import { Role } from "@/generated/prisma/enums";

// Re-export the canonical Role enum so callers import roles from one place.
export { Role };

export const ROLES = [Role.ADMIN, Role.HOST, Role.USER] as const;

// Higher rank = more privilege. Used for "at least this role" checks; explicit
// role-set checks (assertRole) remain the primary authorization mechanism.
export const ROLE_RANK: Record<Role, number> = {
  [Role.ADMIN]: 3,
  [Role.HOST]: 2,
  [Role.USER]: 1,
};

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}
