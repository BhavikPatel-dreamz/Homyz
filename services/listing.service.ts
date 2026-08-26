import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertOwnership, authorize } from "@/lib/permissions/authorize";
import { prisma } from "@/lib/db/prisma";
import type {
  CreateListingInput,
  UpdateListingInput,
} from "@/lib/validation/listing";
import { Role } from "@/generated/prisma/enums";

import { toListingDTO, type ListingDTO } from "./mappers";

// Public catalogue — published listings only by default.
async function list(opts: {
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

async function getById(id: string): Promise<ListingDTO> {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) throw AppError.notFound("Listing not found");
  return toListingDTO(listing);
}

// A host's own listings.
async function listForHost(
  actor: AuthUser,
  opts: { skip: number; take: number },
): Promise<{ items: ListingDTO[]; total: number }> {
  authorize(actor, [Role.HOST, Role.ADMIN]);
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
  const listing = await prisma.listing.create({
    data: {
      hostId: actor.id,
      title: input.title,
      description: input.description,
      price: input.price,
      published: input.published ?? false,
    },
  });
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
  const listing = await prisma.listing.update({ where: { id }, data: input });
  return toListingDTO(listing);
}

async function remove(actor: AuthUser, id: string): Promise<{ success: true }> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);
  await prisma.listing.delete({ where: { id } });
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
