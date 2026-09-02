import { z } from "zod";

export const createListingSchema = z.object({
  title: z.string().trim().max(200).optional().default("Draft Listing"),
  description: z.string().trim().max(5000).optional().default(""),
  price: z.number().int().min(0).optional().default(10000), // minor units (cents)
  published: z.boolean().optional().default(false),
  hostingType: z.enum(["HOME", "EXPERIENCE", "SERVICE"]).optional().default("HOME"),
  propertyType: z.string().optional().nullable(),
  listingType: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  showExactLocation: z.boolean().optional().default(true),
  guests: z.number().int().min(1).optional().default(1),
  bedrooms: z.number().int().min(0).optional().default(1),
  beds: z.number().int().min(0).optional().default(1),
  bathrooms: z.number().int().min(0).optional().default(1),
  photos: z.array(z.string()).optional().default([]),
  highlights: z.array(z.string()).optional().default([]),
  amenities: z.array(z.string()).optional().default([]),
  safetyDisclosures: z.array(z.string()).optional().default([]),
  houseRules: z.array(z.string()).optional().default([]),
  checkInMethod: z.string().optional().default("SMART_LOCK"),
  checkInStart: z.string().optional().default("15:00"),
  checkInEnd: z.string().optional().default("22:00"),
  checkOutTime: z.string().optional().default("11:00"),
  cancellationPolicy: z.string().optional().default("FLEXIBLE"),
  minNights: z.number().int().min(1).optional().default(1),
  maxNights: z.number().int().min(1).optional().default(365),
  instantBook: z.boolean().optional().default(true),
  isPaused: z.boolean().optional().default(false),
  blockedDates: z.array(z.string()).optional().default([]),
  cleaningFee: z.number().int().min(0).optional().default(0),
  securityDeposit: z.number().int().min(0).optional().default(0),
  weekendPrice: z.number().int().min(0).optional().nullable(),
  weekendPremium: z.number().int().min(0).optional().nullable(),
  discounts: z.any().optional().nullable(),
  currentStep: z.number().int().min(1).max(5).optional().default(1),
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingSchema = createListingSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No fields to update",
  });
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

