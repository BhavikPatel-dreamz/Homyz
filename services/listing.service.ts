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
import {
  reviveListingDTO,
  revivePublicListingDTO,
  toListingDTO,
  toPublicListingDTO,
  type ListingDTO,
  type PublicListingDTO,
} from "./mappers";
import { normalizeAmenities } from "@/lib/constants/amenities";

// Cache TTLs (seconds). Deliberately distinct — a single listing changes rarely,
// the paginated catalogue turns over faster (spec §13/§14). Freshly compiled with generated Prisma client.
const LISTING_TTL = 300;
const LISTINGS_LIST_TTL = 120;
// Only shallow pages of the public catalogue are cached; deep pagination is rare
// and would bloat the keyspace, so it falls straight through to the DB.
const MAX_CACHED_LIST_SKIP = 200;
const REQUIRED_SAFETY_RESPONSES = [
  "SECURITY_CAMERA",
  "NOISE_MONITOR",
  "WEAPONS",
] as const;

export type ListingPublishReadiness = {
  publishable: boolean;
  missing: string[];
};

function getPublishReadiness(listing: {
  propertyType: string | null;
  listingType: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  price: number;
  weekendPrice: number | null;
  photos: string[];
  title: string;
  description: string;
  highlights: string[];
  safetyDisclosures: string[];
}): ListingPublishReadiness {
  const missing: string[] = [];
  if (!listing.propertyType) missing.push("propertyType");
  if (!listing.listingType) missing.push("listingType");
  if (!listing.address || !listing.city || !listing.country) missing.push("address");
  if (listing.latitude === null || listing.longitude === null) missing.push("coordinates");
  if (listing.guests < 1 || listing.bedrooms < 0 || listing.beds < 1 || listing.bathrooms < 0) {
    missing.push("capacity");
  }
  if (listing.price <= 0) missing.push("weekdayPrice");
  if (!listing.weekendPrice || listing.weekendPrice <= 0) missing.push("weekendPrice");
  if (listing.photos.length < 5) missing.push("photos");
  if (listing.title.trim().length < 3 || listing.title.length > 50) missing.push("title");
  if (listing.description.trim().length < 10 || listing.description.length > 5000) missing.push("description");
  if (listing.highlights.length > 3) missing.push("highlights");

  const safetyAnswers = new Map(
    listing.safetyDisclosures.map((value) => {
      const [key, answer] = value.split(":");
      return [key, answer];
    }),
  );
  if (
    REQUIRED_SAFETY_RESPONSES.some(
      (key) => safetyAnswers.get(key) !== "YES" && safetyAnswers.get(key) !== "NO",
    )
  ) {
    missing.push("safetyDisclosures");
  }

  return { publishable: missing.length === 0, missing };
}

async function queryList(opts: {
  skip: number;
  take: number;
  publishedOnly?: boolean;
}): Promise<{ items: PublicListingDTO[]; total: number }> {
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
  return { items: items.map(toPublicListingDTO), total };
}

// Public catalogue — published & active listings only by default.
async function list(opts: {
  skip: number;
  take: number;
  publishedOnly?: boolean;
}): Promise<{ items: PublicListingDTO[]; total: number }> {
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
        items: cached.items.map(revivePublicListingDTO),
        total: cached.total,
      }),
    },
  );
}

export type PublicSearchFilters = {
  city?: string;
  country?: string;
  checkIn?: Date | string;
  checkOut?: Date | string;
  guests?: number;
  propertyType?: string;
  listingType?: string;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[];
  skip?: number;
  take?: number;
};

async function searchPublicListings(
  filters: PublicSearchFilters,
): Promise<{ items: PublicListingDTO[]; total: number }> {
  const skip = filters.skip ?? 0;
  const take = filters.take ?? 20;

  const andClauses: Prisma.ListingWhereInput[] = [
    { published: true },
    { status: ListingStatus.ACTIVE },
    { isPaused: false },
  ];

  if (filters.city && filters.city.trim()) {
    const term = filters.city.trim();
    andClauses.push({
      OR: [
        { city: { contains: term, mode: "insensitive" } },
        { district: { contains: term, mode: "insensitive" } },
        { address: { contains: term, mode: "insensitive" } },
        { country: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (filters.country && filters.country.trim()) {
    andClauses.push({
      country: { contains: filters.country.trim(), mode: "insensitive" },
    });
  }

  if (filters.guests && filters.guests > 0) {
    andClauses.push({
      guests: { gte: filters.guests },
    });
  }

  if (filters.propertyType && filters.propertyType.trim()) {
    andClauses.push({
      propertyType: { equals: filters.propertyType.trim(), mode: "insensitive" },
    });
  }

  if (filters.listingType && filters.listingType.trim()) {
    andClauses.push({
      listingType: { equals: filters.listingType.trim(), mode: "insensitive" },
    });
  }

  if (typeof filters.minPrice === "number") {
    andClauses.push({
      price: { gte: filters.minPrice },
    });
  }

  if (typeof filters.maxPrice === "number") {
    andClauses.push({
      price: { lte: filters.maxPrice },
    });
  }

  if (filters.amenities && filters.amenities.length > 0) {
    const canonicalAmenityIds = normalizeAmenities(filters.amenities);
    if (canonicalAmenityIds.length > 0) {
      andClauses.push({
        amenities: { hasEvery: canonicalAmenityIds },
      });
    }
  }

  // If checkIn and checkOut provided, exclude booked listings and blocked calendar dates
  if (filters.checkIn && filters.checkOut) {
    const cIn = new Date(filters.checkIn);
    const cOut = new Date(filters.checkOut);
    if (!isNaN(cIn.getTime()) && !isNaN(cOut.getTime()) && cOut > cIn) {
      const conflicts = await prisma.booking.findMany({
        where: {
          status: { in: ["PENDING", "CONFIRMED"] },
          startDate: { lt: cOut },
          endDate: { gt: cIn },
        },
        select: { listingId: true },
        distinct: ["listingId"],
      });

      if (conflicts.length > 0) {
        const bookedListingIds = conflicts.map((c: { listingId: string }) => c.listingId);
        andClauses.push({
          id: { notIn: bookedListingIds },
        });
      }
    }
  }

  const where: Prisma.ListingWhereInput = { AND: andClauses };

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      skip,
      take,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    items: items.map(toPublicListingDTO),
    total,
  };
}

async function getPublicListingById(id: string): Promise<
  PublicListingDTO & {
    host?: {
      id: string;
      name: string | null;
      image: string | null;
      createdAt: Date;
    };
  }
> {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          image: true,
          createdAt: true,
        },
      },
    },
  });

  if (!listing || !listing.published || listing.status !== ListingStatus.ACTIVE || listing.isPaused) {
    throw AppError.notFound("Listing is not available or does not exist");
  }

  const publicDTO = toPublicListingDTO(listing);
  return {
    ...publicDTO,
    host: listing.host
      ? {
          id: listing.host.id,
          name: listing.host.name,
          image: listing.host.image,
          createdAt: listing.host.createdAt,
        }
      : undefined,
  };
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

async function getForOwner(actor: AuthUser, id: string): Promise<ListingDTO> {
  const listing = await getById(id);
  assertOwnership(actor, listing.hostId);
  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.view");
  }
  return listing;
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
      locationSearch: input.locationSearch || null,
      shortAddress: input.shortAddress || null,
      address: input.address || null,
      apartment: input.apartment || null,
      city: input.city || null,
      district: input.district || null,
      postalCode: input.postalCode || null,
      country: input.country || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      showExactLocation: input.showExactLocation ?? false,
      guests: input.guests ?? 1,
      bedrooms: input.bedrooms ?? 1,
      beds: input.beds ?? 1,
      bathrooms: input.bathrooms ?? 1,
      // Professional Property Details
      propertySize: input.propertySize ?? null,
      propertySizeUnit: input.propertySizeUnit ?? null,
      listingFloor: input.listingFloor ?? null,
      totalFloors: input.totalFloors ?? null,
      yearBuilt: input.yearBuilt ?? null,
      yearRenovated: input.yearRenovated ?? null,
      privateEntrance: input.privateEntrance ?? null,
      elevatorAvailable: input.elevatorAvailable ?? null,
      stairsRequired: input.stairsRequired ?? null,
      rooms: input.rooms ? JSON.parse(JSON.stringify(input.rooms)) : null,
      fullBathrooms: input.fullBathrooms ?? null,
      halfBathrooms: input.halfBathrooms ?? null,
      privateBathrooms: input.privateBathrooms ?? null,
      sharedBathrooms: input.sharedBathrooms ?? null,
      parkingAvailable: input.parkingAvailable ?? null,
      parkingType: input.parkingType ?? null,
      parkingSpaces: input.parkingSpaces ?? null,
      parkingReservation: input.parkingReservation ?? null,
      guestAccess: input.guestAccess || [],
      photos: input.photos || [],
      highlights: input.highlights || [],
      amenities: input.amenities ? normalizeAmenities(input.amenities) : [],
      safetyDisclosures: input.safetyDisclosures || [],
      safetyEquipment: input.safetyEquipment || [],
      safetyHazards: input.safetyHazards || [],
      accessibilityFeatures: input.accessibilityFeatures || [],
      views: input.views || [],
      houseRules: input.houseRules || [],
      petsAllowed: input.petsAllowed ?? null,
      maxPets: input.maxPets ?? null,
      petFee: input.petFee ?? null,
      petRestrictions: input.petRestrictions ?? null,
      dogsAllowed: input.dogsAllowed ?? null,
      catsAllowed: input.catsAllowed ?? null,
      smokingAllowed: input.smokingAllowed ?? null,
      smokingLocation: input.smokingLocation ?? null,
      eventsAllowed: input.eventsAllowed ?? null,
      childrenAllowed: input.childrenAllowed ?? null,
      infantsAllowed: input.infantsAllowed ?? null,
      photographyAllowed: input.photographyAllowed ?? null,
      quietHours: input.quietHours ?? null,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      additionalRules: input.additionalRules ?? null,
      checkInMethod: input.checkInMethod || "SMART_LOCK",
      checkInStart: input.checkInStart || "15:00",
      checkInEnd: input.checkInEnd || "22:00",
      checkOutTime: input.checkOutTime || "11:00",
      directions: input.directions ?? null,
      parkingInstructions: input.parkingInstructions ?? null,
      checkInInstructions: input.checkInInstructions ?? null,
      houseManual: input.houseManual ?? null,
      wifiNetwork: input.wifiNetwork ?? null,
      wifiPassword: input.wifiPassword ?? null,
      doorCode: input.doorCode ?? null,
      lockboxCode: input.lockboxCode ?? null,
      cancellationPolicy: input.cancellationPolicy || "FLEXIBLE",
      minNights: input.minNights ?? 1,
      maxNights: input.maxNights ?? 365,
      instantBook: input.instantBook ?? true,
      isPaused: input.isPaused ?? false,
      blockedDates: input.blockedDates || [],
      cleaningFee: input.cleaningFee ?? 0,
      securityDeposit: input.securityDeposit ?? 0,
      weekendPrice: input.weekendPrice ?? null,
      weekendPremium: input.weekendPremium ?? null,
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
  const dataToUpdate = { ...input };
  if (actor.role !== Role.ADMIN) {
    delete dataToUpdate.published;
  }
  if (dataToUpdate.amenities) {
    dataToUpdate.amenities = normalizeAmenities(dataToUpdate.amenities);
  }
  if (dataToUpdate.rooms !== undefined) {
    dataToUpdate.rooms = dataToUpdate.rooms ? JSON.parse(JSON.stringify(dataToUpdate.rooms)) : null;
  }
  if (dataToUpdate.discounts !== undefined) {
    dataToUpdate.discounts = dataToUpdate.discounts ? JSON.parse(JSON.stringify(dataToUpdate.discounts)) : null;
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

  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.edit");
  }

  const readiness = getPublishReadiness(existing);
  if (!readiness.publishable) {
    throw AppError.badRequest(
      `Cannot submit listing for review. Complete: ${readiness.missing.join(", ")}.`,
      readiness.missing.map((field) => ({ path: field, message: "Required before submission" })),
    );
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

  if (actor.role === Role.HOST) {
    await assertHostPermission(actor.id, "listing.edit");
  }

  const readiness = getPublishReadiness(existing);
  if (!readiness.publishable) {
    throw AppError.badRequest(
      `Cannot resubmit listing for review. Complete: ${readiness.missing.join(", ")}.`,
      readiness.missing.map((field) => ({ path: field, message: "Required before submission" })),
    );
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

  const readiness = getPublishReadiness(existing);
  if (!readiness.publishable) {
    throw AppError.badRequest(
      `Listing cannot be approved. Complete: ${readiness.missing.join(", ")}.`,
      readiness.missing.map((field) => ({ path: field, message: "Required before approval" })),
    );
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
  requestedChanges: unknown,
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

  // Safety check: Never delete a listing that has associated bookings
  const bookingCount = await prisma.booking.count({ where: { listingId: id } });
  if (bookingCount > 0) {
    throw AppError.badRequest(
      "Cannot delete a listing that has associated bookings. Please unpublish or pause the listing instead.",
    );
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
      locationSearch: existing.locationSearch,
      shortAddress: existing.shortAddress,
      address: existing.address,
      apartment: existing.apartment,
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
  searchPublicListings,
  getPublicListingById,
  getById,
  getForOwner,
  getPublishReadiness,
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
  toPublic: toPublicListingDTO,
};
