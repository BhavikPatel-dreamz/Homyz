/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma JSON DTO boundary retains deliberately generic structured content. */
import type { Booking, Listing, Prisma, User, Review } from "@/generated/prisma/client";

function getPublicCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  showExactLocation: boolean,
): { latitude: number | null; longitude: number | null } {
  // A public DTO must never turn an invalid stored value into a map pin. When
  // a host has opted out of sharing an exact location, only the coarse grid
  // point is sent to the browser; the underlying coordinates stay in the DB.
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return { latitude: null, longitude: null };
  }

  return showExactLocation
    ? { latitude, longitude }
    : {
        // Two decimal places is approximately a 1.1 km grid. This is the
        // value used for both the marker and external map URL, never the raw
        // listing coordinate.
        latitude: Math.round(latitude * 100) / 100,
        longitude: Math.round(longitude * 100) / 100,
      };
}

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
    publicProfile: (u.publicProfile as Record<string, unknown> | null) ?? null, // Include publicProfile object
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
    descriptionSections: (l as any).descriptionSections ?? null,
    price: l.price,
    smartPricing: (l as any).smartPricing ?? false,
    smartPricingMinPrice: (l as any).smartPricingMinPrice ?? null,
    smartPricingMaxPrice: (l as any).smartPricingMaxPrice ?? null,
    published: l.published,
    status: l.status,
    hostingType: l.hostingType,
    placeCategory: l.placeCategory,
    propertyType: l.propertyType,
    listingType: l.listingType,
    locationSearch: l.locationSearch,
    shortAddress: l.shortAddress,
    address: l.address,
    neighborhoodDescription: l.neighborhoodDescription ?? null,
    gettingAround: l.gettingAround ?? null,
    apartment: l.apartment,
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
    // Professional Property Details
    propertySize: l.propertySize,
    propertySizeUnit: l.propertySizeUnit,
    listingFloor: l.listingFloor,
    totalFloors: l.totalFloors,
    yearBuilt: l.yearBuilt,
    yearRenovated: l.yearRenovated,
    privateEntrance: l.privateEntrance,
    elevatorAvailable: l.elevatorAvailable,
    stairsRequired: l.stairsRequired,
    // Rooms & Sleeping Arrangements
    rooms: l.rooms,
    // Bathroom Breakdown
    fullBathrooms: l.fullBathrooms,
    halfBathrooms: l.halfBathrooms,
    privateBathrooms: l.privateBathrooms,
    sharedBathrooms: l.sharedBathrooms,
    // Parking Details
    parkingAvailable: l.parkingAvailable,
    parkingType: l.parkingType,
    parkingSpaces: l.parkingSpaces,
    parkingReservation: l.parkingReservation,
    // Guest Access, Equipment, Hazards, Accessibility, Views
    guestAccess: l.guestAccess || [],
    photos: l.photos,
    photoRoomAssignments: (l as any).photoRoomAssignments ?? [],
    highlights: l.highlights,
    amenities: l.amenities || [],
    safetyDisclosures: l.safetyDisclosures || [],
    safetyEquipment: l.safetyEquipment || [],
    safetyHazards: l.safetyHazards || [],
    accessibilityFeatures: l.accessibilityFeatures || [],
    accessibilityDetails: (l as any).accessibilityDetails ?? [],
    views: l.views || [],
    locationFeatures: l.locationFeatures || [],
    // Structured House Rules
    houseRules: l.houseRules || [],
    petsAllowed: l.petsAllowed,
    maxPets: l.maxPets,
    petFee: l.petFee,
    petRestrictions: l.petRestrictions,
    dogsAllowed: l.dogsAllowed,
    catsAllowed: l.catsAllowed,
    smokingAllowed: l.smokingAllowed,
    smokingLocation: l.smokingLocation,
    eventsAllowed: l.eventsAllowed,
    childrenAllowed: l.childrenAllowed,
    infantsAllowed: l.infantsAllowed,
    photographyAllowed: l.photographyAllowed,
    quietHours: l.quietHours,
    quietHoursStart: l.quietHoursStart,
    quietHoursEnd: l.quietHoursEnd,
    additionalRules: l.additionalRules,
    // Arrival & Access (including sensitive data for owner/admin)
    checkInMethod: l.checkInMethod || "SMART_LOCK",
    checkInStart: l.checkInStart || "15:00",
    checkInEnd: l.checkInEnd || "22:00",
    checkOutTime: l.checkOutTime || "11:00",
    directions: l.directions,
    parkingInstructions: l.parkingInstructions,
    checkInInstructions: l.checkInInstructions,
    checkOutInstructions: l.checkOutInstructions,
    houseManual: l.houseManual,
    wifiNetwork: l.wifiNetwork,
    wifiPassword: l.wifiPassword,
    doorCode: l.doorCode,
    lockboxCode: l.lockboxCode,
    cancellationPolicy: l.cancellationPolicy || "FLEXIBLE",
    longTermCancellationPolicy: l.longTermCancellationPolicy || "FIRM",
    bookingMessage: l.bookingMessage ?? null,
    requireProfilePhoto: l.requireProfilePhoto ?? false,
    requireGoodTrackRecord: l.requireGoodTrackRecord ?? false,
    bookingApprovalMode: l.bookingApprovalMode ?? (l.instantBook ? "INSTANT" : "MANUAL"),
    minNights: l.minNights ?? 1,
    maxNights: l.maxNights ?? 365,
    instantBook: l.instantBook ?? true,
    isPaused: l.isPaused ?? false,
    customSlug: (l as any).customSlug ?? null,
    blockedDates: l.blockedDates || [],
    cleaningFee: l.cleaningFee ?? 0,
    securityDeposit: l.securityDeposit ?? 0,
    weekdayBasePrice: (l as any).weekdayBasePrice ?? l.price,
    weekendPrice: l.weekendPrice,
    weekendPremium: l.weekendPremium,
    customPrices: ((l as any).customPrices as Record<string, number> | null) ?? {},
    extraGuestFee: (l as any).extraGuestFee ?? 0,
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
    deletedAt: l.deletedAt ?? null,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
export type ListingDTO = ReturnType<typeof toListingDTO>;

/**
 * Strips internal admin fields, hides apartment, and rounds coordinates
 * when exact location is not explicitly opted in by the host.
 * Also masks sensitive arrival/access secrets (wifi password, door codes, private instructions).
 */
export function toPublicListingDTO(l: Listing | ListingDTO) {
  const showExact = Boolean(l.showExactLocation);
  const publicCoordinates = getPublicCoordinates(l.latitude, l.longitude, showExact);
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    descriptionSections: (l as any).descriptionSections ?? null,
    price: l.price,
    smartPricing: (l as any).smartPricing ?? false,
    smartPricingMinPrice: (l as any).smartPricingMinPrice ?? null,
    smartPricingMaxPrice: (l as any).smartPricingMaxPrice ?? null,
    published: l.published,
    status: l.status,
    hostingType: l.hostingType,
    propertyType: l.propertyType,
    listingType: l.listingType,
    isFeatured: (l as any).isFeatured ?? false,
    rating: (l as any).rating ?? null,
    reviewsCount: (l as any).reviewsCount ?? 0,
    // When showExactLocation is false, mask exact street address and unit
    shortAddress: showExact
      ? l.shortAddress || (l.city ? `${l.city}${l.country ? `, ${l.country}` : ""}` : null)
      : l.city ? `${l.city}${l.country ? `, ${l.country}` : ""}` : null,
    address: showExact ? l.address : null,
    neighborhoodDescription: l.neighborhoodDescription ?? null,
    gettingAround: l.gettingAround ?? null,
    apartment: null as string | null, // Apartment/unit is NEVER exposed publicly
    city: l.city,
    district: l.district,
    postalCode: showExact ? l.postalCode : null,
    country: l.country,
    latitude: publicCoordinates.latitude,
    longitude: publicCoordinates.longitude,
    showExactLocation: showExact,
    guests: l.guests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    // Professional Property Details
    propertySize: l.propertySize ?? null,
    propertySizeUnit: l.propertySizeUnit ?? null,
    listingFloor: l.listingFloor ?? null,
    totalFloors: l.totalFloors ?? null,
    yearBuilt: l.yearBuilt ?? null,
    yearRenovated: l.yearRenovated ?? null,
    privateEntrance: l.privateEntrance ?? null,
    elevatorAvailable: l.elevatorAvailable ?? null,
    stairsRequired: l.stairsRequired ?? null,
    // Rooms & Sleeping Arrangements
    rooms: l.rooms ?? null,
    // Bathroom Breakdown
    fullBathrooms: l.fullBathrooms ?? null,
    halfBathrooms: l.halfBathrooms ?? null,
    privateBathrooms: l.privateBathrooms ?? null,
    sharedBathrooms: l.sharedBathrooms ?? null,
    // Parking Details
    parkingAvailable: l.parkingAvailable ?? null,
    parkingType: l.parkingType ?? null,
    parkingSpaces: l.parkingSpaces ?? null,
    parkingReservation: l.parkingReservation ?? null,
    // Guest Access, Equipment, Hazards, Accessibility, Views
    guestAccess: l.guestAccess || [],
    photos: l.photos,
    highlights: l.highlights,
    amenities: l.amenities || [],
    safetyDisclosures: l.safetyDisclosures || [],
    safetyEquipment: l.safetyEquipment || [],
    safetyHazards: l.safetyHazards || [],
    accessibilityFeatures: l.accessibilityFeatures || [],
    accessibilityDetails: (l as any).accessibilityDetails ?? [],
    views: l.views || [],
    locationFeatures: l.locationFeatures || [],
    // Structured House Rules
    houseRules: l.houseRules || [],
    petsAllowed: l.petsAllowed ?? null,
    maxPets: l.maxPets ?? null,
    petRestrictions: l.petRestrictions ?? null,
    dogsAllowed: l.dogsAllowed ?? null,
    catsAllowed: l.catsAllowed ?? null,
    smokingAllowed: l.smokingAllowed ?? null,
    smokingLocation: l.smokingLocation ?? null,
    eventsAllowed: l.eventsAllowed ?? null,
    childrenAllowed: l.childrenAllowed ?? null,
    infantsAllowed: l.infantsAllowed ?? null,
    photographyAllowed: l.photographyAllowed ?? null,
    quietHours: l.quietHours ?? null,
    quietHoursStart: l.quietHoursStart ?? null,
    quietHoursEnd: l.quietHoursEnd ?? null,
    additionalRules: l.additionalRules ?? null,
    // Check-in basics are public; sensitive codes and instructions are NOT public
    checkInMethod: l.checkInMethod || "SMART_LOCK",
    checkInStart: l.checkInStart || "15:00",
    checkInEnd: l.checkInEnd || "22:00",
    checkOutTime: l.checkOutTime || "11:00",
    // SENSITIVE ACCESS DATA IS EXPLICITLY OMITTED FROM PUBLIC DTO
    cancellationPolicy: l.cancellationPolicy || "FLEXIBLE",
    longTermCancellationPolicy: l.longTermCancellationPolicy || "FIRM",
    bookingMessage: l.bookingMessage ?? null,
    requireProfilePhoto: l.requireProfilePhoto ?? false,
    requireGoodTrackRecord: l.requireGoodTrackRecord ?? false,
    bookingApprovalMode: l.bookingApprovalMode ?? (l.instantBook ? "INSTANT" : "MANUAL"),
    minNights: l.minNights ?? 1,
    maxNights: l.maxNights ?? 365,
    instantBook: l.instantBook ?? true,
    customSlug: (l as any).customSlug ?? null,
    cleaningFee: l.cleaningFee ?? 0,
    securityDeposit: l.securityDeposit ?? 0,
    weekdayBasePrice: (l as any).weekdayBasePrice ?? l.price,
    weekendPrice: l.weekendPrice,
    weekendPremium: l.weekendPremium,
    customPrices: ((l as any).customPrices as Record<string, number> | null) ?? {},
    extraGuestFee: (l as any).extraGuestFee ?? 0,
    discounts: l.discounts,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    distanceKm: (l as any).distanceKm ?? null,
  };
}
export type PublicListingDTO = ReturnType<typeof toPublicListingDTO>;

// Search and catalogue cards do not need a listing's long-form description,
// availability configuration, or other structured content. Keep this selection
// deliberately narrow: it is used for every paginated discovery response.
export const publicListingCardSelect = {
  id: true,
  title: true,
  price: true,
  propertyType: true,
  listingType: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  showExactLocation: true,
  guests: true,
  bedrooms: true,
  beds: true,
  bathrooms: true,
  photos: true,
  isFeatured: true,
  petsAllowed: true,
  discounts: true,
  customSlug: true,
} satisfies Prisma.ListingSelect;

export type PublicListingCardRecord = Prisma.ListingGetPayload<{
  select: typeof publicListingCardSelect;
}>;

export type ListingReviewSummary = {
  averageRating: number | null;
  totalCount: number;
};

/** Lightweight, privacy-safe DTO for discovery cards and map markers. */
export function toPublicListingCardDTO(l: PublicListingCardRecord & { reviewSummary?: ListingReviewSummary }) {
  const showExact = Boolean(l.showExactLocation);
  const publicCoordinates = getPublicCoordinates(l.latitude, l.longitude, showExact);
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    propertyType: l.propertyType,
    listingType: l.listingType,
    city: l.city,
    country: l.country,
    latitude: publicCoordinates.latitude,
    longitude: publicCoordinates.longitude,
    guests: l.guests,
    bedrooms: l.bedrooms,
    beds: l.beds,
    bathrooms: l.bathrooms,
    photos: l.photos,
    isFeatured: l.isFeatured,
    petsAllowed: l.petsAllowed,
    discounts: l.discounts,
    customSlug: l.customSlug,
    rating: l.reviewSummary?.averageRating ?? null,
    reviewsCount: l.reviewSummary?.totalCount ?? 0,
    distanceKm: null as number | null,
  };
}
export type PublicListingCardDTO = ReturnType<typeof toPublicListingCardDTO>;

export function toOwnerListingDTO(l: Listing) {
  return toListingDTO(l);
}
export type OwnerListingDTO = ReturnType<typeof toOwnerListingDTO>;

export function toAdminListingDTO(l: Listing) {
  return toListingDTO(l);
}
export type AdminListingDTO = ReturnType<typeof toAdminListingDTO>;

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
    guests: b.guests,
    totalPrice: b.totalPrice,
    nightlyPrice: b.nightlyPrice,
    cleaningFee: b.cleaningFee,
    currency: b.currency,
    priceBreakdown: b.priceBreakdown,
    cancellationPolicy: b.cancellationPolicy,
    isNonRefundable: b.isNonRefundable,
    createdAt: b.createdAt,
    listing: b.listing
      ? {
          id: b.listing.id,
          customSlug: b.listing.customSlug,
          title: b.listing.title,
          photos: b.listing.photos,
          description: b.listing.description,
          price: b.listing.price,
          city: b.listing.city,
          country: b.listing.country,
          checkInStart: b.listing.checkInStart,
          checkOutTime: b.listing.checkOutTime,
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

export function revivePublicListingDTO(l: PublicListingDTO): PublicListingDTO {
  return {
    ...l,
    createdAt: new Date(l.createdAt),
    updatedAt: new Date(l.updatedAt),
  };
}

export function reviveBookingDTO(b: BookingDTO): BookingDTO {
  return {
    ...b,
    startDate: new Date(b.startDate),
    endDate: new Date(b.endDate),
    createdAt: new Date(b.createdAt),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Review DTOs
// ─────────────────────────────────────────────────────────────────────────────

export function toReviewDTO(
  r: Review & { author?: User | null },
) {
  return {
    id: r.id,
    listingId: r.listingId,
    bookingId: r.bookingId,
    authorId: r.authorId,
    rating: r.rating,
    cleanlinessRating: r.cleanlinessRating,
    accuracyRating: r.accuracyRating,
    checkInRating: r.checkInRating,
    communicationRating: r.communicationRating,
    locationRating: r.locationRating,
    valueRating: r.valueRating,
    comment: r.comment,
    topics: r.topics,
    status: r.status,
    moderatedAt: r.moderatedAt,
    moderatedById: r.moderatedById,
    rejectionReason: r.rejectionReason,
    author: r.author ? toPublicUser(r.author) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
export type ReviewDTO = ReturnType<typeof toReviewDTO>;

/**
 * Public review DTO for guest-facing API.
 * Only includes published reviews with public reviewer data.
 * Never includes moderation fields, rejection reasons, or non-public statuses.
 */
export function toPublicReviewDTO(
  r: Review & { author?: Pick<User, "id" | "name" | "image"> | null },
) {
  return {
    id: r.id,
    listingId: r.listingId,
    rating: r.rating,
    comment: r.comment,
    topics: r.topics,
    author: r.author ? {
      id: r.author.id,
      name: r.author.name,
      image: r.author.image,
    } : null,
    createdAt: r.createdAt,
  };
}
export type PublicReviewDTO = ReturnType<typeof toPublicReviewDTO>;

export function reviveReviewDTO(r: ReviewDTO): ReviewDTO {
  return {
    ...r,
    moderatedAt: r.moderatedAt ? new Date(r.moderatedAt) : null,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    author: r.author ? revivePublicUser(r.author) : null,
  };
}

export function revivePublicReviewDTO(r: PublicReviewDTO): PublicReviewDTO {
  return {
    ...r,
    createdAt: new Date(r.createdAt),
  };
}
