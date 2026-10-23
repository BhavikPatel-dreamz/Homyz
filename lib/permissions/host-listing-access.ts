import "server-only";

import { ListingCoHostStatus, Role } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Shared reporting scope for host-owned and accepted co-host listings.
 * Dashboard Plus belongs to the signed-in account, so a co-host needs their
 * own Plus entitlement before reading Plus data for an assigned listing.
 */
export function accessibleHostListingWhere(
  actor: Pick<AuthUser, "id" | "role">,
  extra: Prisma.ListingWhereInput = {},
): Prisma.ListingWhereInput {
  if (actor.role === Role.ADMIN) return { deletedAt: null, ...extra };

  return {
    deletedAt: null,
    ...extra,
    OR: [
      { hostId: actor.id },
      { coHosts: { some: { userId: actor.id, status: ListingCoHostStatus.ACCEPTED } } },
    ],
  };
}
