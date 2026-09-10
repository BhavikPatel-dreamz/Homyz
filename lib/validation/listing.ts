import { z } from "zod";
import { normalizeSlug, isReservedSlug } from "@/lib/utils/slug";

export const HOSTING_TYPES = ["HOME", "EXPERIENCE", "SERVICE"] as const;
export const LISTING_TYPES = ["ENTIRE_PLACE", "ROOM", "SHARED_ROOM"] as const;
export const MAX_ONBOARDING_STEP = 19;
export const LOCATION_FEATURE_IDS = [
  "near_public_transport",
  "near_landmarks",
  "resort_access",
  "beach_access",
  "lake_access",
  "quiet_neighborhood",
] as const;

const toCanonicalIdentifier = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizedPropertyType = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? toCanonicalIdentifier(value) : value),
  z.string().min(1).max(80).nullable().optional(),
);

const normalizedListingType = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = toCanonicalIdentifier(value);
    if (normalized === "PRIVATE_ROOM") return "ROOM";
    if (normalized === "ENTIRE_PLACE" || normalized === "SHARED_ROOM") return normalized;
    return value;
  },
  z.enum(LISTING_TYPES).nullable().optional(),
);

const percentageDiscountSchema = z.object({
  enabled: z.boolean(),
  percentage: z.number().finite().min(0).max(100),
}).strict();

const discountsSchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return value;
    return Object.fromEntries(value.map((discount) => [String(discount), true]));
  },
  z.object({
    weekly: z.union([z.boolean(), percentageDiscountSchema]).optional(),
    monthly: z.union([z.boolean(), percentageDiscountSchema]).optional(),
    last_minute: z.boolean().optional(),
    new_listing: z.boolean().optional(),
    orgStays: z.record(z.string(), z.unknown()).optional(),
  }).passthrough().optional().nullable(),
);

const listingPhotoUrl = z.string().trim().refine(
  (value) => {
    // Local development storage deliberately returns root-relative URLs. Restrict
    // those to the listing-media directory; production object storage uses HTTPS.
    if (/^\/uploads\/listing-photos\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|avif)$/i.test(value)) {
      return true;
    }
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  },
  { message: "Photo must be an uploaded listing-media URL." },
);

const customSlugSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const normalized = normalizeSlug(value);
      return normalized === "" ? null : normalized;
    }
    return value;
  },
  z
    .string()
    .min(3, "Custom link must be at least 3 characters")
    .max(100, "Custom link must be at most 100 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Custom link may only contain lowercase letters, numbers, and hyphens without consecutive hyphens")
    .refine((s) => !isReservedSlug(s), { message: "This name is reserved and cannot be used" })
    .nullable()
    .optional(),
);

export const DESCRIPTION_SECTIONS_SCHEMA = z.object({
  property: z.string().trim().max(1500).optional().nullable(),
  guestAccess: z.string().trim().max(1500).optional().nullable(),
  guestInteraction: z.string().trim().max(1500).optional().nullable(),
  otherDetails: z.string().trim().max(1500).optional().nullable(),
}).strict();

export const BED_TYPES = [
  "KING",
  "QUEEN",
  "DOUBLE",
  "SINGLE",
  "TWIN",
  "BUNK_BED",
  "SOFA_BED",
  "FLOOR_MATTRESS",
  "CRIB",
] as const;

export const ROOM_TYPES = [
  "BEDROOM",
  "LIVING_ROOM",
  "OTHER",
] as const;

export const bedItemSchema = z.object({
  type: z.enum(BED_TYPES),
  count: z.number().int().min(1).max(20),
});

export const roomSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  type: z.enum(ROOM_TYPES).default("BEDROOM"),
  beds: z.array(bedItemSchema).default([]),
});

export const roomsSchema = z.array(roomSchema).max(50);
export type RoomInput = z.infer<typeof roomSchema>;
export type BedItemInput = z.infer<typeof bedItemSchema>;

const accessibilityDetailSchema = z.object({
  featureId: z.string().trim().min(1).max(80),
  photos: z.array(listingPhotoUrl).min(1).max(10),
}).strict();

const listingFields = {
  title: z.string().trim().max(50).optional().default("Draft Listing"),
  description: z.string().trim().max(5000).optional().default(""),
  descriptionSections: DESCRIPTION_SECTIONS_SCHEMA.optional().nullable(),
  price: z.number().int().min(0).optional().default(10000), // minor units
  smartPricing: z.boolean().optional().default(false),
  smartPricingMinPrice: z.number().int().min(0).max(10000000).optional().nullable(),
  smartPricingMaxPrice: z.number().int().min(0).max(10000000).optional().nullable(),
  published: z.boolean().optional().default(false),
  hostingType: z.enum(HOSTING_TYPES).optional().default("HOME"),
  placeCategory: z.enum(["APARTMENT", "HOUSE", "SECONDARY_UNIT", "UNIQUE_SPACE", "BED_AND_BREAKFAST", "BOUTIQUE_HOTEL"]).optional().nullable(),
  propertyType: normalizedPropertyType,
  listingType: normalizedListingType,
  locationSearch: z.string().trim().max(500).optional().nullable(),
  shortAddress: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  neighborhoodDescription: z.string().trim().max(2000).optional().nullable(),
  gettingAround: z.string().trim().max(2000).optional().nullable(),
  apartment: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  district: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().max(32).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  latitude: z.number().finite().min(-90).max(90).optional().nullable(),
  longitude: z.number().finite().min(-180).max(180).optional().nullable(),
  showExactLocation: z.boolean().optional().default(false),
  guests: z.number().int().min(1).max(50).optional().default(1),
  bedrooms: z.number().int().min(0).max(30).optional().default(1),
  beds: z.number().int().min(1).max(50).optional().default(1),
  bathrooms: z.number().int().min(0).max(30).optional().default(1),

  // Professional Property Details
  propertySize: z.number().int().min(1).max(100000).optional().nullable(),
  propertySizeUnit: z.enum(["SQM", "SQFT"]).optional().nullable(),
  listingFloor: z.number().int().min(-5).max(200).optional().nullable(),
  totalFloors: z.number().int().min(1).max(200).optional().nullable(),
  yearBuilt: z.number().int().min(1800).max(2100).optional().nullable(),
  yearRenovated: z.number().int().min(1800).max(2100).optional().nullable(),
  privateEntrance: z.boolean().optional().nullable(),
  elevatorAvailable: z.boolean().optional().nullable(),
  stairsRequired: z.boolean().optional().nullable(),

  // Rooms & Sleeping Arrangements
  rooms: roomsSchema.optional().nullable(),

  // Bathroom Breakdown
  fullBathrooms: z.number().int().min(0).max(50).optional().nullable(),
  halfBathrooms: z.number().int().min(0).max(50).optional().nullable(),
  privateBathrooms: z.number().int().min(0).max(50).optional().nullable(),
  sharedBathrooms: z.number().int().min(0).max(50).optional().nullable(),

  // Parking Details
  parkingAvailable: z.boolean().optional().nullable(),
  parkingType: z.string().trim().max(50).optional().nullable(),
  parkingSpaces: z.number().int().min(0).max(100).optional().nullable(),
  parkingReservation: z.boolean().optional().nullable(),

  // Guest Access
  guestAccess: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]),
  languages: z.array(z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/)).max(20).optional().default([]),

  // Photos & Highlights & Features
  photos: z.array(listingPhotoUrl).max(100).optional().default([]),
  highlights: z.array(z.string().trim().min(1).max(80)).max(3).optional().default([]),
  amenities: z.array(z.string().trim().min(1).max(80)).max(200).optional().default([]),
  safetyDisclosures: z.array(z.string().trim().min(1).max(500)).max(50).optional().default([]),
  safetyEquipment: z.array(z.string().trim().min(1).max(500)).max(50).optional().default([]),
  safetyHazards: z.array(z.string().trim().min(1).max(500)).max(50).optional().default([]),
  accessibilityFeatures: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]),
  accessibilityDetails: z.array(accessibilityDetailSchema).max(50).optional().default([]),
  views: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]),
  locationFeatures: z.array(z.enum(LOCATION_FEATURE_IDS)).max(3).optional().default([]),

  // Structured House Rules
  houseRules: z.array(z.string().trim().min(1).max(200)).max(50).optional().default([]),
  petsAllowed: z.boolean().optional().nullable(),
  maxPets: z.number().int().min(0).max(20).optional().nullable(),
  petFee: z.number().int().min(0).optional().nullable(),
  petRestrictions: z.string().trim().max(500).optional().nullable(),
  dogsAllowed: z.boolean().optional().nullable(),
  catsAllowed: z.boolean().optional().nullable(),
  smokingAllowed: z.boolean().optional().nullable(),
  smokingLocation: z.enum(["INSIDE", "OUTSIDE_ONLY", "DESIGNATED_AREA"]).optional().nullable(),
  eventsAllowed: z.boolean().optional().nullable(),
  childrenAllowed: z.boolean().optional().nullable(),
  infantsAllowed: z.boolean().optional().nullable(),
  photographyAllowed: z.boolean().optional().nullable(),
  quietHours: z.boolean().optional().nullable(),
  quietHoursStart: z.string().trim().max(20).optional().nullable(),
  quietHoursEnd: z.string().trim().max(20).optional().nullable(),
  additionalRules: z.string().trim().max(5000).optional().nullable(),

  // Arrival & Access
  checkInMethod: z.string().trim().max(80).optional().default("SMART_LOCK"),
  checkInStart: z.string().trim().max(20).optional().default("15:00"),
  checkInEnd: z.string().trim().max(20).optional().default("22:00"),
  checkOutTime: z.string().trim().max(20).optional().default("11:00"),
  directions: z.string().trim().max(5000).optional().nullable(),
  parkingInstructions: z.string().trim().max(5000).optional().nullable(),
  checkInInstructions: z.string().trim().max(5000).optional().nullable(),
  houseManual: z.string().trim().max(10000).optional().nullable(),
  wifiNetwork: z.string().trim().max(120).optional().nullable(),
  wifiPassword: z.string().trim().max(120).optional().nullable(),
  doorCode: z.string().trim().max(120).optional().nullable(),
  lockboxCode: z.string().trim().max(120).optional().nullable(),

  cancellationPolicy: z.string().trim().max(80).optional().default("FLEXIBLE"),
  longTermCancellationPolicy: z.enum(["FIRM", "STRICT"]).optional().default("FIRM"),
  bookingMessage: z.string().trim().max(1000).optional().nullable(),
  requireGoodTrackRecord: z.boolean().optional().default(false),
  bookingApprovalMode: z.enum(["FIRST_THREE", "INSTANT", "MANUAL"]).optional().default("INSTANT"),
  minNights: z.number().int().min(1).max(365).optional().default(1),
  maxNights: z.number().int().min(1).max(365).optional().default(365),
  advanceNotice: z.enum(["Same day", "At least 1 day", "At least 2 days", "At least 3 days", "At least 7 days"]).optional().default("Same day"),
  sameDayCutoff: z.enum(["12:00 AM", "6:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"]).optional().default("12:00 AM"),
  allowSameDayRequests: z.boolean().optional().default(true),
  instantBook: z.boolean().optional().default(true),
  isPaused: z.boolean().optional().default(false),
  blockedDates: z.array(z.string().date()).max(730).optional().default([]),
  cleaningFee: z.number().int().min(0).optional().default(0),
  securityDeposit: z.number().int().min(0).optional().default(0),
  weekendPrice: z.number().int().min(0).optional().nullable(),
  weekendPremium: z.number().int().min(0).max(100).optional().nullable(),
  discounts: discountsSchema,
  currentStep: z.number().int().min(1).max(MAX_ONBOARDING_STEP).optional().default(1),
  customSlug: customSlugSchema,
};

export const createListingSchema = z
  .object(listingFields)
  .refine((value) => value.maxNights >= value.minNights, {
    path: ["maxNights"],
    message: "Maximum nights must be at least the minimum nights.",
  });
export type CreateListingInput = z.infer<typeof createListingSchema>;

// Defaults belong to creation only. Retaining them on a partial update silently
// overwrites unrelated listing settings whenever an editor saves one section.
const updateListingFields = Object.fromEntries(
  Object.entries(listingFields).map(([key, schema]) => {
    const withoutDefault = "removeDefault" in schema ? schema.removeDefault() : schema;
    return [key, withoutDefault.optional()];
  }),
) as z.ZodRawShape;

export const updateListingSchema = z
  .object(updateListingFields)
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields to update",
  })
  .refine(
    (value) =>
      value.minNights == null ||
      value.maxNights == null ||
      value.maxNights >= value.minNights,
    {
      path: ["maxNights"],
      message: "Maximum nights must be at least the minimum nights.",
    },
  );
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
