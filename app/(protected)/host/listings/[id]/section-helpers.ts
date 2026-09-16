import type { AccessibilityFeatureDetail } from "@/lib/constants/listing-enums";
import type { PhotoRoomAssignment } from "@/lib/listing/photo-room-assignments";

export type SectionKey =
  | "title"
  | "propertyType"
  | "pricing"
  | "availability"
  | "guests"
  | "sleeping-arrangements"
  | "parking"
  | "safety-equipment"
  | "description"
  | "amenities"
  | "add-amenities"
  | "photos"
  | "accessibility"
  | "location"
  | "arrival-guide"
  | "about-host"
  | "co-host"
  | "booking-settings"
  | "house-rules"
  | "guests-safety"
  | "cancellation-policy"
  | "custom-link"
  | "directions"
  | "check-in-out"
  | "check-in-method"
  | "wifi-details"
  | "house-manual"
  | "checkout-instructions"
  | "check-out-instructions"
  | "checkout"
  | "check-out"
  | "checkout-page"
  | "check-out-page"
  | "checkoutpage"
  | "guidebooks"
  | "guidebook"
  | "interaction-preferences"
  | "interactionpreferences"
  | "listing-status"
  | "listingstatus"
  | "language"
  | "languages"
  | "guest-requirements"
  | "guestrequirements"
  | "local-laws"
  | "locallaws"
  | "regulations"
  | "taxes"
  | "homyz-stays"
  | "homyzstays"
  | "homyz-org-stays"
  | "airbnb-org-stays"
  | "airbnb-stays"
  | "remove-listing"
  | "removelisting"
  | "admin-review"
  | "audit-history";

export const SECTION_SLUG_MAP: Record<string, SectionKey> = {
  "property-type": "propertyType",
  "propertytype": "propertyType",
  "propertyType": "propertyType",
  "title": "title",
  "description": "description",
  "pricing": "pricing",
  "availability": "availability",
  "guests": "guests",
  "sleeping-arrangements": "sleeping-arrangements",
  "sleepingarrangements": "sleeping-arrangements",
  "rooms": "sleeping-arrangements",
  "parking": "parking",
  "safety-equipment": "safety-equipment",
  "safetyequipment": "safety-equipment",
  "amenities": "amenities",
  "add-amenities": "add-amenities",
  "photos": "photos",
  "accessibility": "accessibility",
  "location": "location",
  "arrival-guide": "arrival-guide",
  "arrival": "arrival-guide",
  "about-host": "about-host",
  "abouthost": "about-host",
  "co-host": "co-host",
  "cohost": "co-host",
  "booking-settings": "booking-settings",
  "bookingsettings": "booking-settings",
  "house-rules": "house-rules",
  "houserules": "house-rules",
  "guests-safety": "guests-safety",
  "guestssafety": "guests-safety",
  "safety": "guests-safety",
  "cancellation-policy": "cancellation-policy",
  "cancellationpolicy": "cancellation-policy",
  "custom-link": "custom-link",
  "customlink": "custom-link",
  "directions": "directions",
  "check-in-out": "check-in-out",
  "check-in-method": "check-in-method",
  "checkinmethod": "check-in-method",
  "wifi-details": "wifi-details",
  "wifidetails": "wifi-details",
  "house-manual": "house-manual",
  "housemanual": "house-manual",
  "checkout-instructions": "checkout-instructions",
  "check-out-instructions": "checkout-instructions",
  "checkoutinstructions": "checkout-instructions",
  "checkout": "checkout-instructions",
  "check-out": "checkout-instructions",
  "checkout-page": "checkout-instructions",
  "check-out-page": "checkout-instructions",
  "checkoutpage": "checkout-instructions",
  "guidebooks": "guidebooks",
  "guidebook": "guidebooks",
  "interaction-preferences": "interaction-preferences",
  "interactionpreferences": "interaction-preferences",
  "listing-status": "listing-status",
  "listingstatus": "listing-status",
  "language": "language",
  "guest-requirements": "guest-requirements",
  "guestrequirements": "guest-requirements",
  "local-laws": "local-laws",
  "locallaws": "local-laws",
  "regulations": "regulations",
  "taxes": "taxes",
  "homyz-stays": "homyz-stays",
  "homyzstays": "homyz-stays",
  "homyz-org-stays": "homyz-org-stays",
  "homyzorgstays": "homyz-org-stays",
  "airbnb-org-stays": "airbnb-org-stays",
  "airbnb-stays": "airbnb-org-stays",
  "airbnborgstays": "airbnb-org-stays",
  "airbnbstays": "airbnb-org-stays",
  "remove-listing": "remove-listing",
  "removelisting": "remove-listing",
  "admin-review": "admin-review",
  "adminreview": "admin-review",
  "audit-history": "audit-history",
  "audithistory": "audit-history",
};

export function sectionToSlug(section: SectionKey): string {
  if (section === "propertyType") return "property-type";
  return section;
}

export function slugToSection(slug?: string): SectionKey {
  if (!slug) return "propertyType";
  const normalized = slug.toLowerCase();
  return SECTION_SLUG_MAP[normalized] || SECTION_SLUG_MAP[slug] || "propertyType";
}

export function formatTimeDisplay(time: string | null | undefined, defaultVal = ""): string {
  if (!time) return defaultVal;
  const trimmed = time.trim();
  if (!trimmed) return defaultVal;
  if (/flexible/i.test(trimmed)) return "Flexible";

  // Check 12-hour format: e.g. "3:00 PM", "3:00 pm", "11:00pm", "11 pm"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    const hour = parseInt(match12[1], 10);
    const min = match12[2] || "00";
    const period = match12[3].toLowerCase();
    return `${hour}:${min} ${period}`;
  }

  // Check 24-hour format: e.g. "15:00", "07:00", "22:30", "9:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hour = parseInt(match24[1], 10);
    const min = match24[2];
    const period = hour >= 12 ? "pm" : "am";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${period}`;
  }

  return trimmed;
}

export const ALL_HOURS_OPTIONS = [
  "12:00 am",
  "1:00 am",
  "2:00 am",
  "3:00 am",
  "4:00 am",
  "5:00 am",
  "6:00 am",
  "7:00 am",
  "8:00 am",
  "9:00 am",
  "10:00 am",
  "11:00 am",
  "12:00 pm",
  "1:00 pm",
  "2:00 pm",
  "3:00 pm",
  "4:00 pm",
  "5:00 pm",
  "6:00 pm",
  "7:00 pm",
  "8:00 pm",
  "9:00 pm",
  "10:00 pm",
  "11:00 pm",
];

export const QUIET_HOURS_START_OPTIONS = ALL_HOURS_OPTIONS;
export const QUIET_HOURS_END_OPTIONS = ALL_HOURS_OPTIONS;
export const CHECK_IN_TIMES = ALL_HOURS_OPTIONS;
export const CHECK_OUT_TIMES = ALL_HOURS_OPTIONS;

export interface HostListingData {
  id: string;
  title: string;
  description: string;
  descriptionSections?: Record<string, unknown> | null;
  price: number; // in cents
  weekdayBasePrice?: number | null;
  smartPricing?: boolean;
  smartPricingMinPrice?: number | null;
  smartPricingMaxPrice?: number | null;
  published: boolean;
  status: string;
  hostingType: string;
  placeCategory?: string | null;
  propertyType: string;
  listingType: string;
  latitude?: number | null;
  longitude?: number | null;
  showExactLocation?: boolean;
  locationSearch?: string | null;
  shortAddress?: string | null;
  apartment?: string | null;
  neighborhoodDescription?: string | null;
  gettingAround?: string | null;
  highlights?: string[];
  discounts?: Record<string, unknown> | null;
  safetyDisclosures?: string[];
  address: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  // Professional Property Details
  propertySize?: number | null;
  propertySizeUnit?: string | null;
  listingFloor?: number | null;
  totalFloors?: number | null;
  yearBuilt?: number | null;
  yearRenovated?: number | null;
  privateEntrance?: boolean | null;
  elevatorAvailable?: boolean | null;
  stairsRequired?: boolean | null;
  rooms?: Array<{
    id: string;
    name: string;
    type: "BEDROOM" | "LIVING_ROOM" | "OTHER";
    beds: Array<{ type: string; count: number }>;
  }> | null;
  fullBathrooms?: number | null;
  halfBathrooms?: number | null;
  privateBathrooms?: number | null;
  sharedBathrooms?: number | null;
  parkingAvailable?: boolean | null;
  parkingType?: string | null;
  parkingSpaces?: number | null;
  parkingReservation?: boolean | null;
  guestAccess?: string[];
  languages?: string[];
  safetyEquipment?: string[];
  safetyHazards?: string[];
  accessibilityFeatures?: string[];
  accessibilityDetails?: AccessibilityFeatureDetail[];
  views?: string[];
  locationFeatures?: string[];
  petsAllowed?: boolean | null;
  maxPets?: number | null;
  petFee?: number | null;
  petRestrictions?: string | null;
  dogsAllowed?: boolean | null;
  catsAllowed?: boolean | null;
  smokingAllowed?: boolean | null;
  smokingLocation?: string | null;
  eventsAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
  infantsAllowed?: boolean | null;
  photographyAllowed?: boolean | null;
  quietHours?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  additionalRules?: string | null;
  directions?: string | null;
  parkingInstructions?: string | null;
  checkInInstructions?: string | null;
  checkOutInstructions?: string | null;
  houseManual?: string | null;
  wifiNetwork?: string | null;
  wifiPassword?: string | null;
  doorCode?: string | null;
  lockboxCode?: string | null;
  photos: string[];
  photoRoomAssignments?: PhotoRoomAssignment[];
  amenities: string[];
  houseRules: string[];
  checkInMethod: string;
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  cancellationPolicy: string;
  longTermCancellationPolicy?: string | null;
  nonRefundableDiscountPercentage?: number | null;
  bookingMessage?: string | null;
  requireProfilePhoto?: boolean;
  requireGoodTrackRecord?: boolean;
  bookingApprovalMode?: "FIRST_THREE" | "INSTANT" | "MANUAL";
  approvedBookingCount?: number;
  instantBook: boolean;
  minNights: number;
  maxNights: number;
  advanceNotice?: string | null;
  sameDayCutoff?: string | null;
  allowSameDayRequests?: boolean | null;
  blockedDates: string[];
  cleaningFee: number;
  securityDeposit: number;
  weekendPrice: number | null;
  weekendPremium?: number | null;
  isPaused: boolean;
  isFeatured: boolean;
  customSlug?: string | null;
  requestedChanges: any;
  rejectionReason: string | null;
  submittedAt?: Date | string | null;
  resubmittedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  reapprovalRequired?: boolean;
  reapprovalReason?: string | null;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone?: string | null;
    createdAt: Date | string;
    publicProfile: Record<string, unknown> | null;
  };
  hostVerification?: {
    status: string;
    complianceStatus?: string | null;
    documents?: any[];
  } | null;
  coHosts?: Array<{
    id: string;
    email: string | null;
    phone: string | null;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";
    invitedAt: Date | string;
    expiresAt: Date | string | null;
    acceptedAt: Date | string | null;
    user: { id: string; name: string | null; image: string | null } | null;
  }>;
  reviewer?: { id: string; name: string | null; email: string | null } | null;
  approvedBy?: { id: string; name: string | null; email: string | null } | null;
  bookingCount?: number;
  reviewCount?: number;
}

export function serializeListingForEditor(
  listing: any,
  options?: {
    nonRefundableDiscountPercentage?: number | null;
    reviewer?: any;
    approvedBy?: any;
  },
): HostListingData {
  const nonRefundableEntry =
    listing.discounts && typeof listing.discounts === "object"
      ? (listing.discounts as Record<string, unknown>).non_refundable
      : null;
  const listingNonRefundablePercentage =
    typeof nonRefundableEntry === "object" &&
    nonRefundableEntry !== null &&
    typeof (nonRefundableEntry as Record<string, unknown>).percentage === "number"
      ? (nonRefundableEntry as Record<string, number>).percentage
      : null;
  const nonRefundableDiscountPercentage =
    options?.nonRefundableDiscountPercentage ?? listingNonRefundablePercentage ?? 10;

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    descriptionSections: typeof listing.descriptionSections === "string"
      ? (() => { try { return JSON.parse(listing.descriptionSections); } catch { return null; } })()
      : listing.descriptionSections
      ? JSON.parse(JSON.stringify(listing.descriptionSections))
      : null,
    price: listing.price,
    weekdayBasePrice: listing.weekdayBasePrice ?? listing.price,
    smartPricing: listing.smartPricing ?? false,
    smartPricingMinPrice: listing.smartPricingMinPrice ?? null,
    smartPricingMaxPrice: listing.smartPricingMaxPrice ?? null,
    published: listing.published,
    status: listing.status,
    hostingType: listing.hostingType,
    placeCategory: listing.placeCategory ?? null,
    propertyType: listing.propertyType ?? "APARTMENT",
    listingType: listing.listingType ?? "ENTIRE_PLACE",
    locationSearch: listing.locationSearch ?? "",
    shortAddress: listing.shortAddress ?? "",
    address: listing.address ?? "",
    neighborhoodDescription: listing.neighborhoodDescription ?? null,
    gettingAround: listing.gettingAround ?? null,
    apartment: listing.apartment ?? "",
    city: listing.city ?? "",
    district: listing.district ?? "",
    postalCode: listing.postalCode ?? "",
    country: listing.country ?? "",
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    showExactLocation: listing.showExactLocation ?? true,
    guests: listing.guests,
    bedrooms: listing.bedrooms,
    beds: listing.beds,
    bathrooms: listing.bathrooms,
    photos: listing.photos || [],
    photoRoomAssignments: typeof listing.photoRoomAssignments === "string"
      ? (() => { try { return JSON.parse(listing.photoRoomAssignments); } catch { return []; } })()
      : listing.photoRoomAssignments
      ? JSON.parse(JSON.stringify(listing.photoRoomAssignments))
      : [],
    languages: listing.languages || [],
    amenities: listing.amenities || [],
    highlights: listing.highlights || [],
    discounts: (listing.discounts as Record<string, unknown>) ?? {},
    houseRules: listing.houseRules || [],
    checkInMethod: listing.checkInMethod || "SMART_LOCK",
    checkInStart: listing.checkInStart || "15:00",
    checkInEnd: listing.checkInEnd || "22:00",
    checkOutTime: listing.checkOutTime || "11:00",
    cancellationPolicy: listing.cancellationPolicy || "FLEXIBLE",
    longTermCancellationPolicy: listing.longTermCancellationPolicy || "FIRM",
    nonRefundableDiscountPercentage,
    bookingMessage: listing.bookingMessage ?? null,
    requireProfilePhoto: listing.requireProfilePhoto ?? false,
    requireGoodTrackRecord: listing.requireGoodTrackRecord ?? false,
    bookingApprovalMode:
      listing.bookingApprovalMode ?? (listing.instantBook ? "INSTANT" : "MANUAL"),
    approvedBookingCount: Array.isArray(listing.bookings)
      ? listing.bookings.length
      : (listing._count?.bookings ?? 0),
    instantBook: listing.instantBook ?? true,
    minNights: listing.minNights ?? 1,
    maxNights: listing.maxNights ?? 365,
    advanceNotice: listing.advanceNotice ?? "Same day",
    sameDayCutoff: listing.sameDayCutoff ?? "12:00 AM",
    allowSameDayRequests: listing.allowSameDayRequests ?? true,
    blockedDates: listing.blockedDates || [],
    cleaningFee: listing.cleaningFee ?? 0,
    securityDeposit: listing.securityDeposit ?? 0,
    weekendPrice: listing.weekendPrice ?? null,
    weekendPremium: listing.weekendPremium ?? null,
    isPaused: listing.isPaused ?? false,
    isFeatured: listing.isFeatured ?? false,
    customSlug: listing.customSlug ?? null,
    requestedChanges: listing.requestedChanges || null,
    rejectionReason: listing.rejectionReason || null,
    submittedAt: listing.submittedAt
      ? typeof listing.submittedAt === "string"
        ? listing.submittedAt
        : listing.submittedAt.toISOString()
      : null,
    resubmittedAt: listing.resubmittedAt
      ? typeof listing.resubmittedAt === "string"
        ? listing.resubmittedAt
        : listing.resubmittedAt.toISOString()
      : null,
    approvedAt: listing.approvedAt
      ? typeof listing.approvedAt === "string"
        ? listing.approvedAt
        : listing.approvedAt.toISOString()
      : null,
    reapprovalRequired: listing.reapprovalRequired ?? false,
    reapprovalReason: listing.reapprovalReason ?? null,
    propertySize: listing.propertySize ?? null,
    propertySizeUnit: listing.propertySizeUnit ?? "SQM",
    listingFloor: listing.listingFloor ?? null,
    totalFloors: listing.totalFloors ?? null,
    yearBuilt: listing.yearBuilt ?? null,
    yearRenovated: listing.yearRenovated ?? null,
    privateEntrance: listing.privateEntrance ?? null,
    elevatorAvailable: listing.elevatorAvailable ?? null,
    stairsRequired: listing.stairsRequired ?? null,
    rooms: listing.rooms ?? null,
    fullBathrooms: listing.fullBathrooms ?? null,
    halfBathrooms: listing.halfBathrooms ?? null,
    privateBathrooms: listing.privateBathrooms ?? null,
    sharedBathrooms: listing.sharedBathrooms ?? null,
    parkingAvailable: listing.parkingAvailable ?? null,
    parkingType: listing.parkingType ?? null,
    parkingSpaces: listing.parkingSpaces ?? null,
    parkingReservation: listing.parkingReservation ?? null,
    guestAccess: listing.guestAccess || [],
    safetyDisclosures: listing.safetyDisclosures || [],
    safetyEquipment: listing.safetyEquipment || [],
    safetyHazards: listing.safetyHazards || [],
    accessibilityFeatures: listing.accessibilityFeatures || [],
    accessibilityDetails: typeof listing.accessibilityDetails === "string"
      ? (() => { try { return JSON.parse(listing.accessibilityDetails); } catch { return []; } })()
      : listing.accessibilityDetails
      ? JSON.parse(JSON.stringify(listing.accessibilityDetails))
      : [],
    views: listing.views || [],
    locationFeatures: listing.locationFeatures || [],
    petsAllowed: listing.petsAllowed ?? null,
    maxPets: listing.maxPets ?? null,
    petFee: listing.petFee ?? null,
    petRestrictions: listing.petRestrictions ?? null,
    dogsAllowed: listing.dogsAllowed ?? null,
    catsAllowed: listing.catsAllowed ?? null,
    smokingAllowed: listing.smokingAllowed ?? null,
    smokingLocation: listing.smokingLocation ?? null,
    eventsAllowed: listing.eventsAllowed ?? null,
    childrenAllowed: listing.childrenAllowed ?? null,
    infantsAllowed: listing.infantsAllowed ?? null,
    photographyAllowed: listing.photographyAllowed ?? null,
    quietHours: listing.quietHours ?? null,
    quietHoursStart: listing.quietHoursStart ?? null,
    quietHoursEnd: listing.quietHoursEnd ?? null,
    additionalRules: listing.additionalRules ?? null,
    directions: listing.directions ?? (listing as any).arrivalGuide?.directions ?? null,
    parkingInstructions: listing.parkingInstructions ?? (listing as any).arrivalGuide?.parkingInstructions ?? null,
    checkInInstructions: listing.checkInInstructions ?? (listing as any).arrivalGuide?.checkInInstructions ?? null,
    checkOutInstructions: listing.checkOutInstructions ?? (listing as any).arrivalGuide?.checkOutInstructions ?? null,
    houseManual: listing.houseManual ?? (listing as any).arrivalGuide?.houseManual ?? null,
    wifiNetwork: listing.wifiNetwork ?? (listing as any).arrivalGuide?.wifiNetwork ?? null,
    wifiPassword: listing.wifiPassword ?? (listing as any).arrivalGuide?.wifiPassword ?? null,
    doorCode: listing.doorCode ?? (listing as any).arrivalGuide?.doorCode ?? null,
    lockboxCode: listing.lockboxCode ?? (listing as any).arrivalGuide?.lockboxCode ?? null,
    host: {
      id: listing.host?.id ?? "",
      name: listing.host?.name ?? null,
      email: listing.host?.email ?? null,
      image: listing.host?.image ?? null,
      phone: listing.host?.phone ?? null,
      createdAt:
        typeof listing.host?.createdAt === "string"
          ? listing.host.createdAt
          : listing.host?.createdAt?.toISOString?.() ?? new Date().toISOString(),
      publicProfile:
        (listing.host?.publicProfile as Record<string, unknown> | null) ?? null,
    },
    hostVerification: listing.host?.hostRegistrations?.[0]
      ? {
          status: listing.host.hostRegistrations[0].status,
          complianceStatus: listing.host.hostRegistrations[0].complianceStatus,
          documents: listing.host.hostRegistrations[0].documents,
        }
      : listing.hostVerification ?? null,
    coHosts: Array.isArray(listing.coHosts)
      ? listing.coHosts.map((coHost: any) => ({
          id: coHost.id,
          email: coHost.email,
          phone: coHost.phone,
          status: coHost.status,
          invitedAt:
            typeof coHost.invitedAt === "string"
              ? coHost.invitedAt
              : coHost.invitedAt?.toISOString?.() ?? coHost.invitedAt,
          expiresAt:
            typeof coHost.expiresAt === "string"
              ? coHost.expiresAt
              : coHost.expiresAt?.toISOString?.() ?? coHost.expiresAt,
          acceptedAt:
            typeof coHost.acceptedAt === "string"
              ? coHost.acceptedAt
              : coHost.acceptedAt?.toISOString?.() ?? coHost.acceptedAt,
          user: coHost.user,
        }))
      : [],
    reviewer: options?.reviewer ?? listing.reviewer ?? null,
    approvedBy: options?.approvedBy ?? listing.approvedBy ?? null,
    bookingCount:
      listing._count?.bookings ??
      (Array.isArray(listing.bookings) ? listing.bookings.length : 0),
    reviewCount: 0,
  };
}

