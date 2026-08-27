import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership, authorize } from "@/lib/permissions/authorize";
import { assertHostPermission } from "@/lib/permissions/host-permissions-server";
import { prisma } from "@/lib/db/prisma";
import { deleteCache, getCounter, getOrSetCache, incrCounter } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import type {
  CreateListingInput,
  UpdateListingInput,
} from "@/lib/validation/listing";
import { Role } from "@/generated/prisma/enums";

import { reviveListingDTO, toListingDTO, type ListingDTO } from "./mappers";

// Cache TTLs (seconds). Deliberately distinct — a single listing changes rarely,
// the paginated catalogue turns over faster (spec §13/§14).
const LISTING_TTL = 300;
const LISTINGS_LIST_TTL = 120;
// Only shallow pages of the public catalogue are cached; deep pagination is rare
// and would bloat the keyspace, so it falls straight through to the DB.
const MAX_CACHED_LIST_SKIP = 200;

async function queryList(opts: {
  skip: number;
  take: number;
  publishedOnly?: boolean;
}): Promise<{ items: ListingDTO[]; total: number }> {
  const where = opts.publishedOnly === false ? {} : { published: true };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.listing.count({ where }),
  ]);
  return { items: items.map(toListingDTO), total };
}

// Public catalogue — published listings only by default.
async function list(opts: {
  skip: number;
  take: number;
  publishedOnly?: boolean;
}): Promise<{ items: ListingDTO[]; total: number }> {
  // Cache only the public (published) view and only shallow pages. The admin
  // "all" view (publishedOnly === false) and deep pages bypass the cache.
  const isPublicView = opts.publishedOnly !== false;
  if (!isPublicView || opts.skip > MAX_CACHED_LIST_SKIP) {
    return queryList(opts);
  }
  // Version-tagged key: a mutation bumps the version (O(1) INCR) and every
  // cached page is invalidated at once; the stale keys simply expire.
  const version = await getCounter(keys.listingsPublicVersion());
  return getOrSetCache(
    keys.listingsPublic(version, opts.skip, opts.take),
    () => queryList(opts),
    {
      ttl: LISTINGS_LIST_TTL,
      revive: (cached) => ({
        items: cached.items.map(reviveListingDTO),
        total: cached.total,
      }),
    },
  );
}

async function getById(id: string): Promise<ListingDTO> {
  return getOrSetCache(
    keys.listing(id),
    async () => {
      const listing = await prisma.listing.findUnique({ where: { id } });
      if (!listing) throw AppError.notFound("Listing not found");
      return toListingDTO(listing);
    },
    { ttl: LISTING_TTL, revive: reviveListingDTO },
  );
}

// A host's own listings.
async function listForHost(
  actor: AuthUser,
  opts: { skip: number; take: number },
): Promise<{ items: ListingDTO[]; total: number }> {
  authorize(actor, [Role.HOST, Role.ADMIN]);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.view");
  }
  const where = { hostId: actor.id };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.listing.count({ where }),
  ]);
  return { items: items.map(toListingDTO), total };
}

async function create(
  actor: AuthUser,
  input: CreateListingInput,
): Promise<ListingDTO> {
  authorize(actor, [Role.HOST, Role.ADMIN]);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.create");
    if (input.published) {
      await assertHostPermission(actor.id, "listing.publish");
    }
  }

  const listing = await prisma.listing.create({
    data: {
      hostId: actor.id,
      title: input.title,
      description: input.description,
      price: input.price,
      published: input.published ?? false,
    },
  });
  // Only a published listing changes the public catalogue.
  if (listing.published) {
    await incrCounter(keys.listingsPublicVersion());
  }
  return toListingDTO(listing);
}

async function update(
  actor: AuthUser,
  id: string,
  input: UpdateListingInput,
): Promise<ListingDTO> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  // Host must own it; ADMIN bypasses ownership.
  assertOwnership(actor, existing.hostId);

  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.edit");
    if (input.published !== undefined && input.published !== existing.published) {
      const permSlug = input.published ? "listing.publish" : "listing.unpublish";
      await assertHostPermission(actor.id, permSlug);
    }
  }

  const listing = await prisma.listing.update({ where: { id }, data: input });
  // After commit: drop the detail entry and invalidate every catalogue page
  // (title/price/published may have changed). Both are best-effort (fail-open).
  await Promise.all([
    deleteCache(keys.listing(id)),
    incrCounter(keys.listingsPublicVersion()),
  ]);
  return toListingDTO(listing);
}

async function remove(actor: AuthUser, id: string): Promise<{ success: true }> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);

  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.delete");
  }

  await prisma.listing.delete({ where: { id } });
  await Promise.all([
    deleteCache(keys.listing(id)),
    incrCounter(keys.listingsPublicVersion()),
  ]);
  return { success: true };
}

export const listingService = {
  list,
  getById,
  listForHost,
  create,
  update,
  remove,
};
