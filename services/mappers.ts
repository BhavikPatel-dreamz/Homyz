/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma JSON DTO boundary retains deliberately generic structured content. */
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
    published: l.published,
    status: l.status,
    hostingType: l.hostingType,
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
    highlights: l.highlights,
    amenities: l.amenities || [],
    safetyDisclosures: l.safetyDisclosures || [],
    safetyEquipment: l.safetyEquipment || [],
    safetyHazards: l.safetyHazards || [],
    accessibilityFeatures: l.accessibilityFeatures || [],
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
    houseManual: l.houseManual,
    wifiNetwork: l.wifiNetwork,
    wifiPassword: l.wifiPassword,
    doorCode: l.doorCode,
    lockboxCode: l.lockboxCode,
    cancellationPolicy: l.cancellationPolicy || "FLEXIBLE",
    longTermCancellationPolicy: l.longTermCancellationPolicy || "FIRM",
    bookingMessage: l.bookingMessage ?? null,
    minNights: l.minNights ?? 1,
    maxNights: l.maxNights ?? 365,
    instantBook: l.instantBook ?? true,
    isPaused: l.isPaused ?? false,
    customSlug: (l as any).customSlug ?? null,
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
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    descriptionSections: (l as any).descriptionSections ?? null,
    price: l.price,
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
    // Jitter/round coordinates to 2 decimal places (~1.1km) when exact location is disabled
    latitude:
      l.latitude !== null && l.latitude !== undefined
        ? showExact
          ? l.latitude
          : Math.round(l.latitude * 100) / 100
        : null,
    longitude:
      l.longitude !== null && l.longitude !== undefined
        ? showExact
          ? l.longitude
          : Math.round(l.longitude * 100) / 100
        : null,
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
    minNights: l.minNights ?? 1,
    maxNights: l.maxNights ?? 365,
    instantBook: l.instantBook ?? true,
    customSlug: (l as any).customSlug ?? null,
    cleaningFee: l.cleaningFee ?? 0,
    securityDeposit: l.securityDeposit ?? 0,
    weekendPrice: l.weekendPrice,
    weekendPremium: l.weekendPremium,
    discounts: l.discounts,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
export type PublicListingDTO = ReturnType<typeof toPublicListingDTO>;

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
    createdAt: b.createdAt,
    listing: b.listing
      ? {
          id: b.listing.id,
          title: b.listing.title,
          photos: b.listing.photos,
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

export function revivePublicListingDTO(l: PublicListingDTO): PublicListingDTO {
  return {
    ...l,
    createdAt: new Date(l.createdAt),
    updatedAt: new Date(l.updatedAt),
  };
}
