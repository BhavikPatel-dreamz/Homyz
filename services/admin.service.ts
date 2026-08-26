import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { deleteCache, getOrSetCache } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import { Role } from "@/generated/prisma/enums";

import { toPublicUser, type PublicUser } from "./mappers";

// Dashboard counts change constantly and don't warrant explicit invalidation on
// every register/booking; a short TTL keeps them fresh enough (spec §14).
const STATS_TTL = 60;

// Admin-only operations. Callers MUST be gated by requireApiRole([ADMIN]) /
// requirePageRole([ADMIN]) at the route/page boundary; these functions assume
// the actor is already authorized as ADMIN.

async function listUsers(opts: {
  skip: number;
  take: number;
  role?: Role;
}): Promise<{ items: PublicUser[]; total: number }> {
  const where = opts.role ? { role: opts.role } : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map(toPublicUser), total };
}

/**
 * The ONE trusted path allowed to assign any role, including ADMIN. This is
 * never reachable from public signup — it is only invoked from an admin-guarded
 * route/action. Guards against removing the last remaining admin.
 */
async function setUserRole(
  targetUserId: string,
  role: Role,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw AppError.notFound("User not found");

  if (user.role === Role.ADMIN && role !== Role.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount <= 1) {
      throw AppError.conflict("Cannot demote the last remaining admin");
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
  });
  // A role change alters the profile DTO — drop the cached copy immediately
  // (after commit) so it can't serve a stale role (spec §10). Effective authz
  // is unaffected: it comes from JWT claims, not this cache.
  await deleteCache(keys.userProfile(targetUserId));
  return toPublicUser(updated);
}

async function stats(): Promise<{
  users: number;
  hosts: number;
  admins: number;
  listings: number;
  bookings: number;
}> {
  return getOrSetCache(
    keys.statsGlobal(),
    async () => {
      const [users, hosts, admins, listings, bookings] =
        await prisma.$transaction([
          prisma.user.count(),
          prisma.user.count({ where: { role: Role.HOST } }),
          prisma.user.count({ where: { role: Role.ADMIN } }),
          prisma.listing.count(),
          prisma.booking.count(),
        ]);
      return { users, hosts, admins, listings, bookings };
    },
    { ttl: STATS_TTL },
  );
}

export const adminService = {
  listUsers,
  setUserRole,
  stats,
};
