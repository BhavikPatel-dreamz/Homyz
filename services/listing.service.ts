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
import { ListingStatus, Role } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

import { auditService } from "./audit.service";
import { reviveListingDTO, toListingDTO, type ListingDTO } from "./mappers";

// Cache TTLs (seconds). Deliberately distinct — a single listing changes rarely,
// the paginated catalogue turns over faster (spec §13/§14). Freshly compiled with generated Prisma client.
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
  const where = opts.publishedOnly === false ? {} : { published: true, status: ListingStatus.ACTIVE };
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

// Public catalogue — published & active listings only by default.
async function list(opts: {
  skip: number;
  take: number;
  publishedOnly?: boolean;
}): Promise<{ items: ListingDTO[]; total: number }> {
  const isPublicView = opts.publishedOnly !== false;
  if (!isPublicView || opts.skip > MAX_CACHED_LIST_SKIP) {
    return queryList(opts);
  }
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
  opts?: { skip?: number; take?: number },
): Promise<{ items: ListingDTO[]; total: number }> {
  authorize(actor, [Role.HOST, Role.USER, Role.ADMIN]);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.view");
  }
  const skip = opts?.skip ?? 0;
  const take = opts?.take ?? 50;
  const where = { hostId: actor.id };
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take,
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
  authorize(actor, [Role.HOST, Role.USER, Role.ADMIN]);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.create");
  }

  // Automatically promote regular USER to HOST role upon starting/creating a listing
  if (actor.role === Role.USER) {
    await prisma.user.update({
      where: { id: actor.id },
      data: { role: Role.HOST },
    });
  }

  // Ensure published is strictly false on creation unless Admin approves
  const listing = await prisma.listing.create({
    data: {
      hostId: actor.id,
      title: input.title || "Draft Listing",
      description: input.description || "",
      price: input.price ?? 10000,
      published: false, // Strictly enforced: Host submission requires Admin approval before activation
      hostingType: input.hostingType || "HOME",
      propertyType: input.propertyType || null,
      listingType: input.listingType || null,
      address: input.address || null,
      city: input.city || null,
      district: input.district || null,
      postalCode: input.postalCode || null,
      country: input.country || null,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      showExactLocation: input.showExactLocation ?? true,
      guests: input.guests ?? 1,
      bedrooms: input.bedrooms ?? 1,
      beds: input.beds ?? 1,
      bathrooms: input.bathrooms ?? 1,
      photos: input.photos || [],
      highlights: input.highlights || [],
      amenities: input.amenities || [],
      safetyDisclosures: input.safetyDisclosures || [],
      houseRules: input.houseRules || [],
      checkInMethod: input.checkInMethod || "SMART_LOCK",
      checkInStart: input.checkInStart || "15:00",
      checkInEnd: input.checkInEnd || "22:00",
      checkOutTime: input.checkOutTime || "11:00",
      cancellationPolicy: input.cancellationPolicy || "FLEXIBLE",
      minNights: input.minNights ?? 1,
      maxNights: input.maxNights ?? 365,
      instantBook: input.instantBook ?? true,
      isPaused: input.isPaused ?? false,
      blockedDates: input.blockedDates || [],
      cleaningFee: input.cleaningFee ?? 0,
      securityDeposit: input.securityDeposit ?? 0,
      weekendPrice: input.weekendPrice || null,
      weekendPremium: input.weekendPremium || null,
      discounts: input.discounts ? JSON.parse(JSON.stringify(input.discounts)) : null,
      currentStep: input.currentStep ?? 1,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_CREATED",
    resourceType: "Listing",
    resourceId: listing.id,
    description: `Created new listing draft "${listing.title}"`,
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
  assertOwnership(actor, existing.hostId);

  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.edit");
  }

  // Automatically promote regular USER to HOST role upon updating a listing
  if (actor.role === Role.USER) {
    await prisma.user.update({
      where: { id: actor.id },
      data: { role: Role.HOST },
    });
  }

  // Hosts cannot directly change status to ACTIVE or published to true
  const dataToUpdate: any = { ...input };
  if (actor.role !== Role.ADMIN) {
    delete dataToUpdate.published;
    if (dataToUpdate.status === ListingStatus.ACTIVE || dataToUpdate.status === ListingStatus.APPROVED) {
      delete dataToUpdate.status;
    }
  }

  const listing = await prisma.listing.update({ where: { id }, data: dataToUpdate });
  await Promise.all([
    deleteCache(keys.listing(id)),
    incrCounter(keys.listingsPublicVersion()),
  ]);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_UPDATED",
    resourceType: "Listing",
    resourceId: id,
    description: `Updated listing "${listing.title}" details`,
  });

  return toListingDTO(listing);
}

async function submitForReview(actor: AuthUser, id: string): Promise<ListingDTO> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);

  // Enforce backend validation rules for listing submission
  const errors: string[] = [];
  if (!existing.title || existing.title.trim().length < 3) errors.push("Listing title must be at least 3 characters.");
  if (!existing.description || existing.description.trim().length < 10) errors.push("Listing description must be at least 10 characters.");
  if (!existing.price || existing.price <= 0) errors.push("Price per night must be greater than 0.");
  if (!existing.photos || existing.photos.length < 5) errors.push(`Minimum 5 property photos are required (currently ${existing.photos?.length || 0}).`);
  if (!existing.address && !existing.city) errors.push("Property location address/city is required.");

  if (errors.length > 0) {
    throw AppError.badRequest(`Cannot submit listing for review: ${errors.join(" ")}`);
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status: ListingStatus.PENDING_REVIEW,
      published: false, // Stays false until Admin approval
      submittedAt: new Date(),
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_SUBMITTED",
    resourceType: "Listing",
    resourceId: id,
    description: `Submitted listing "${updated.title}" for Admin review`,
  });

  return toListingDTO(updated);
}

async function resubmitForReview(actor: AuthUser, id: string): Promise<ListingDTO> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);

  if (existing.photos.length < 5) {
    throw AppError.badRequest(`Minimum 5 property photos are required (currently ${existing.photos.length}).`);
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status: ListingStatus.PENDING_REVIEW,
      published: false,
      resubmittedAt: new Date(),
      requestedChanges: Prisma.DbNull,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_RESUBMITTED",
    resourceType: "Listing",
    resourceId: id,
    description: `Resubmitted listing "${updated.title}" for Admin review after updating details`,
  });

  return toListingDTO(updated);
}

async function approveListingByAdmin(actor: AuthUser, id: string): Promise<ListingDTO> {
  authorize(actor, [Role.ADMIN]);

  const existing = await prisma.listing.findUnique({
    where: { id },
    include: { host: true },
  });
  if (!existing) throw AppError.notFound("Listing not found");

  // Validate listing eligibility
  if (existing.photos.length < 5) {
    throw AppError.badRequest(`Listing cannot be approved: Minimum 5 photos required (has ${existing.photos.length}).`);
  }
  if (!existing.title || !existing.description || !existing.price) {
    throw AppError.badRequest("Listing cannot be approved: Incomplete title, description, or price.");
  }

  // Update listing to APPROVED & ACTIVE
  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status: ListingStatus.ACTIVE,
      published: true,
      approvedAt: new Date(),
      approvedById: actor.id,
      rejectionReason: null,
      requestedChanges: Prisma.DbNull,
    },
  });

  // Ensure Host User account is promoted to Role.HOST & UserStatus.ACTIVE if pending
  if (existing.host.role !== Role.HOST) {
    await prisma.user.update({
      where: { id: existing.hostId },
      data: { role: Role.HOST, status: "ACTIVE" },
    });
  }

  // Invalidate caches
  await Promise.all([
    deleteCache(keys.listing(id)),
    incrCounter(keys.listingsPublicVersion()),
    deleteCache(keys.userProfile(existing.hostId)),
  ]);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_APPROVED",
    resourceType: "Listing",
    resourceId: id,
    description: `Approved listing "${updated.title}" (${updated.id}). Status is now ACTIVE.`,
  });

  return toListingDTO(updated);
}

async function requestChangesByAdmin(
  actor: AuthUser,
  id: string,
  requestedChanges: any,
): Promise<ListingDTO> {
  authorize(actor, [Role.ADMIN]);

  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status: ListingStatus.CHANGES_REQUESTED,
      published: false,
      requestedChanges: JSON.parse(JSON.stringify(requestedChanges)),
    },
  });

  await deleteCache(keys.listing(id));

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_CHANGES_REQUESTED",
    resourceType: "Listing",
    resourceId: id,
    description: `Requested changes on listing "${updated.title}" (${updated.id})`,
    metadata: { requestedChanges },
  });

  return toListingDTO(updated);
}

async function rejectListingByAdmin(
  actor: AuthUser,
  id: string,
  rejectionReason: string,
): Promise<ListingDTO> {
  authorize(actor, [Role.ADMIN]);

  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      status: ListingStatus.REJECTED,
      published: false,
      rejectionReason,
    },
  });

  await deleteCache(keys.listing(id));

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_REJECTED",
    resourceType: "Listing",
    resourceId: id,
    description: `Rejected listing "${updated.title}" (${updated.id}): ${rejectionReason}`,
    metadata: { rejectionReason },
  });

  return toListingDTO(updated);
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

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_DELETED",
    resourceType: "Listing",
    resourceId: id,
    description: `Deleted listing "${existing.title}"`,
  });

  return { success: true };
}

async function duplicate(actor: AuthUser, id: string): Promise<ListingDTO> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);

  const duplicated = await prisma.listing.create({
    data: {
      hostId: existing.hostId,
      title: `${existing.title} (Copy)`,
      description: existing.description,
      price: existing.price,
      published: false,
      status: ListingStatus.DRAFT,
      hostingType: existing.hostingType,
      propertyType: existing.propertyType,
      listingType: existing.listingType,
      address: existing.address,
      city: existing.city,
      district: existing.district,
      postalCode: existing.postalCode,
      country: existing.country,
      latitude: existing.latitude,
      longitude: existing.longitude,
      showExactLocation: existing.showExactLocation,
      guests: existing.guests,
      bedrooms: existing.bedrooms,
      beds: existing.beds,
      bathrooms: existing.bathrooms,
      photos: existing.photos,
      highlights: existing.highlights,
      amenities: existing.amenities,
      safetyDisclosures: existing.safetyDisclosures,
      houseRules: existing.houseRules,
      checkInMethod: existing.checkInMethod,
      checkInStart: existing.checkInStart,
      checkInEnd: existing.checkInEnd,
      checkOutTime: existing.checkOutTime,
      cancellationPolicy: existing.cancellationPolicy,
      minNights: existing.minNights,
      maxNights: existing.maxNights,
      instantBook: existing.instantBook,
      isPaused: false,
      blockedDates: existing.blockedDates,
      cleaningFee: existing.cleaningFee,
      securityDeposit: existing.securityDeposit,
      weekendPrice: existing.weekendPrice,
      weekendPremium: existing.weekendPremium,
      discounts: existing.discounts ? JSON.parse(JSON.stringify(existing.discounts)) : null,
      currentStep: 1,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_DUPLICATED",
    resourceType: "Listing",
    resourceId: duplicated.id,
    description: `Duplicated listing "${existing.title}" to new draft "${duplicated.title}"`,
  });

  return toListingDTO(duplicated);
}

async function togglePause(actor: AuthUser, id: string, isPaused: boolean): Promise<ListingDTO> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);

  const updated = await prisma.listing.update({
    where: { id },
    data: {
      isPaused,
      published: isPaused ? false : (existing.status === ListingStatus.ACTIVE || existing.status === ListingStatus.APPROVED),
    },
  });

  await Promise.all([
    deleteCache(keys.listing(id)),
    incrCounter(keys.listingsPublicVersion()),
  ]);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: isPaused ? "LISTING_PAUSED" : "LISTING_RESUMED",
    resourceType: "Listing",
    resourceId: id,
    description: `${isPaused ? "Paused" : "Resumed"} listing "${updated.title}"`,
  });

  return toListingDTO(updated);
}

async function updateAvailability(actor: AuthUser, id: string, blockedDates: string[]): Promise<ListingDTO> {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Listing not found");
  assertOwnership(actor, existing.hostId);

  const updated = await prisma.listing.update({
    where: { id },
    data: { blockedDates },
  });

  await deleteCache(keys.listing(id));

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "LISTING_AVAILABILITY_UPDATED",
    resourceType: "Listing",
    resourceId: id,
    description: `Updated blocked calendar dates for "${updated.title}"`,
  });

  return toListingDTO(updated);
}

export const listingService = {
  list,
  getById,
  listForHost,
  create,
  update,
  duplicate,
  togglePause,
  updateAvailability,
  submitForReview,
  resubmitForReview,
  approveListingByAdmin,
  requestChangesByAdmin,
  rejectListingByAdmin,
  remove,
};

