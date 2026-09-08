import { z } from "zod";

export const HOSTING_TYPES = ["HOME", "EXPERIENCE", "SERVICE"] as const;
export const LISTING_TYPES = ["ENTIRE_PLACE", "ROOM", "SHARED_ROOM"] as const;
export const MAX_ONBOARDING_STEP = 19;

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

const discountsSchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return value;
    return Object.fromEntries(value.map((discount) => [String(discount), true]));
  },
  z.record(z.string(), z.boolean()).optional().nullable(),
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

const listingFields = {
  title: z.string().trim().max(50).optional().default("Draft Listing"),
  description: z.string().trim().max(5000).optional().default(""),
  price: z.number().int().min(0).optional().default(10000), // minor units
  published: z.boolean().optional().default(false),
  hostingType: z.enum(HOSTING_TYPES).optional().default("HOME"),
  propertyType: normalizedPropertyType,
  listingType: normalizedListingType,
  locationSearch: z.string().trim().max(500).optional().nullable(),
  shortAddress: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
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
  photos: z.array(listingPhotoUrl).max(100).optional().default([]),
  highlights: z.array(z.string().trim().min(1).max(80)).max(3).optional().default([]),
  amenities: z.array(z.string().trim().min(1).max(80)).max(100).optional().default([]),
  // Explicit KEY:YES / KEY:NO values preserve the difference between No and unanswered.
  safetyDisclosures: z.array(z.string().trim().min(1).max(80)).max(3).optional().default([]),
  houseRules: z.array(z.string().trim().min(1).max(200)).max(50).optional().default([]),
  checkInMethod: z.string().trim().max(80).optional().default("SMART_LOCK"),
  checkInStart: z.string().trim().max(20).optional().default("15:00"),
  checkInEnd: z.string().trim().max(20).optional().default("22:00"),
  checkOutTime: z.string().trim().max(20).optional().default("11:00"),
  cancellationPolicy: z.string().trim().max(80).optional().default("FLEXIBLE"),
  minNights: z.number().int().min(1).max(365).optional().default(1),
  maxNights: z.number().int().min(1).max(365).optional().default(365),
  instantBook: z.boolean().optional().default(true),
  isPaused: z.boolean().optional().default(false),
  blockedDates: z.array(z.string().date()).max(730).optional().default([]),
  cleaningFee: z.number().int().min(0).optional().default(0),
  securityDeposit: z.number().int().min(0).optional().default(0),
  weekendPrice: z.number().int().min(0).optional().nullable(),
  weekendPremium: z.number().int().min(0).max(100).optional().nullable(),
  discounts: discountsSchema,
  currentStep: z.number().int().min(1).max(MAX_ONBOARDING_STEP).optional().default(1),
};

export const createListingSchema = z
  .object(listingFields)
  .refine((value) => value.maxNights >= value.minNights, {
    path: ["maxNights"],
    message: "Maximum nights must be at least the minimum nights.",
  });
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = z
  .object(listingFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields to update",
  })
  .refine(
    (value) =>
      value.minNights === undefined ||
      value.maxNights === undefined ||
      value.maxNights >= value.minNights,
    {
      path: ["maxNights"],
      message: "Maximum nights must be at least the minimum nights.",
    },
  );
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
