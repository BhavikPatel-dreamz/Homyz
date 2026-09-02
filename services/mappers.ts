import type { Booking, Listing, User } from "@/generated/prisma/client";

// DTO mappers. The ONLY shape of a user/listing/booking that leaves the service
// layer. `passwordHash` (and any future secret column) is never included here,
// so it can never appear in an API response or Server Action result.

export function toPublicUser(
  u: User & { adminRole?: { name: string; slug: string } | null },
) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    adminRoleId: u.adminRoleId,
    adminRole: u.adminRole ? { name: u.adminRole.name, slug: u.adminRole.slug } : null,
    phone: u.phone,
    image: u.image,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    createdAt: u.createdAt,
  };
}
export type PublicUser = ReturnType<typeof toPublicUser>;

export function toListingDTO(l: Listing) {
  return {
    id: l.id,
    hostId: l.hostId,
    title: l.title,
    description: l.description,
    price: l.price,
    published: l.published,
    status: l.status,
    hostingType: l.hostingType,
    propertyType: l.propertyType,
    listingType: l.listingType,
    address: l.address,
    city: l.city,
    district: l.district,
    postalCode: l.postalCode,
    country: l.country,
    latitude: l.latitude,
    longitude: l.longitude,
    showExactLocation: l.showExactLocation,
    guests: l.guests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    photos: l.photos,
    highlights: l.highlights,
    amenities: l.amenities || [],
    safetyDisclosures: l.safetyDisclosures,
    houseRules: l.houseRules || [],
    checkInMethod: l.checkInMethod || "SMART_LOCK",
    checkInStart: l.checkInStart || "15:00",
    checkInEnd: l.checkInEnd || "22:00",
    checkOutTime: l.checkOutTime || "11:00",
    cancellationPolicy: l.cancellationPolicy || "FLEXIBLE",
    minNights: l.minNights ?? 1,
    maxNights: l.maxNights ?? 365,
    instantBook: l.instantBook ?? true,
    isPaused: l.isPaused ?? false,
    blockedDates: l.blockedDates || [],
    cleaningFee: l.cleaningFee ?? 0,
    securityDeposit: l.securityDeposit ?? 0,
    weekendPrice: l.weekendPrice,
    weekendPremium: l.weekendPremium,
    discounts: l.discounts,
    currentStep: l.currentStep,
    submittedAt: l.submittedAt,
    resubmittedAt: l.resubmittedAt,
    reviewStartedAt: l.reviewStartedAt,
    reviewerId: l.reviewerId,
    rejectionReason: l.rejectionReason,
    requestedChanges: l.requestedChanges,
    approvedAt: l.approvedAt,
    approvedById: l.approvedById,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
export type ListingDTO = ReturnType<typeof toListingDTO>;

export function toBookingDTO(
  b: Booking & { listing?: Listing | null; user?: User | null },
) {
  return {
    id: b.id,
    userId: b.userId,
    listingId: b.listingId,
    status: b.status,
    startDate: b.startDate,
    endDate: b.endDate,
    createdAt: b.createdAt,
    listing: b.listing
      ? {
          id: b.listing.id,
          title: b.listing.title,
          description: b.listing.description,
          price: b.listing.price,
        }
      : null,
    user: b.user
      ? {
          id: b.user.id,
          name: b.user.name,
          email: b.user.email,
        }
      : null,
  };
}
export type BookingDTO = ReturnType<typeof toBookingDTO>;

// ── Cache revivers ───────────────────────────────────────────────────────────
// JSON has no Date type, so a DTO read back from the Redis cache has its Date
// fields as ISO strings. These restore the declared types on a cache HIT (the
// DB miss-path already returns real Dates). Idempotent and null-safe — matters
// at the Server-Action→client boundary, where React preserves real Dates.

export function revivePublicUser(u: PublicUser): PublicUser {
  return {
    ...u,
    emailVerified: u.emailVerified ? new Date(u.emailVerified) : u.emailVerified,
    phoneVerified: u.phoneVerified ? new Date(u.phoneVerified) : u.phoneVerified,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
    createdAt: new Date(u.createdAt),
  };
}

export function reviveListingDTO(l: ListingDTO): ListingDTO {
  return {
    ...l,
    submittedAt: l.submittedAt ? new Date(l.submittedAt) : null,
    resubmittedAt: l.resubmittedAt ? new Date(l.resubmittedAt) : null,
    reviewStartedAt: l.reviewStartedAt ? new Date(l.reviewStartedAt) : null,
    approvedAt: l.approvedAt ? new Date(l.approvedAt) : null,
    createdAt: new Date(l.createdAt),
    updatedAt: new Date(l.updatedAt),
  };
}
