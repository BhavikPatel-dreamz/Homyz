import { z } from "zod";
import {
  bookingDateKey,
  differenceInBookingNights,
  isBookingDatePast,
  parseBookingDate,
} from "@/lib/booking/booking-date";

export const MAX_PUBLIC_SEARCH_PAGE = 10_000;
export const MAX_PUBLIC_SEARCH_LIMIT = 100;
export const MAX_PUBLIC_SEARCH_SKIP = 1_000_000;
export const MAX_PUBLIC_SEARCH_RADIUS_KM = 500;
export const MAX_PUBLIC_SEARCH_STAY_NIGHTS = 366;

const optionalText = z.string().trim().min(1).max(160).optional();
const optionalNonNegativeInteger = z.number().finite().int().min(0).optional();

/**
 * Validates the public search shape after a route/page has parsed query strings.
 * Keeping this beside booking-date utilities makes date-only search rules use the
 * exact same calendar representation as availability and quotes.
 */
export const publicListingSearchFiltersSchema = z
  .object({
    city: optionalText,
    country: optionalText,
    destination: optionalText,
    placeName: optionalText,
    placeId: z.string().trim().min(1).max(300).optional(),
    locationType: z.string().trim().min(1).max(80).optional(),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
    radiusKm: z.number().finite().positive().max(MAX_PUBLIC_SEARCH_RADIUS_KM).optional(),
    checkIn: z.union([z.string().trim().min(1).max(32), z.date()]).optional(),
    checkOut: z.union([z.string().trim().min(1).max(32), z.date()]).optional(),
    guests: z.number().finite().int().min(1).max(50).optional(),
    adults: z.number().finite().int().min(0).max(50).optional(),
    children: optionalNonNegativeInteger,
    infants: z.number().finite().int().min(0).max(20).optional(),
    pets: z.number().finite().int().min(0).max(20).optional(),
    minPrice: z.number().finite().nonnegative().optional(),
    maxPrice: z.number().finite().nonnegative().optional(),
    bedrooms: optionalNonNegativeInteger,
    bathrooms: optionalNonNegativeInteger,
    beds: optionalNonNegativeInteger,
    page: z.number().finite().int().min(1).max(MAX_PUBLIC_SEARCH_PAGE).optional(),
    limit: z.number().finite().int().min(1).max(MAX_PUBLIC_SEARCH_LIMIT).optional(),
    skip: z.number().finite().int().min(0).max(MAX_PUBLIC_SEARCH_SKIP).optional(),
    take: z.number().finite().int().min(1).max(MAX_PUBLIC_SEARCH_LIMIT).optional(),
    mapBounds: z
      .object({
        neLat: z.number().finite().min(-90).max(90),
        neLng: z.number().finite().min(-180).max(180),
        swLat: z.number().finite().min(-90).max(90),
        swLng: z.number().finite().min(-180).max(180),
      })
      .optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const hasCheckIn = value.checkIn !== undefined;
    const hasCheckOut = value.checkOut !== undefined;

    if (hasCheckIn !== hasCheckOut) {
      ctx.addIssue({
        code: "custom",
        path: [hasCheckIn ? "checkOut" : "checkIn"],
        message: "Check-in and check-out must be provided together.",
      });
      return;
    }

    if (hasCheckIn && hasCheckOut) {
      const checkIn = parseBookingDate(value.checkIn!);
      const checkOut = parseBookingDate(value.checkOut!);
      if (Number.isNaN(checkIn.getTime())) {
        ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Check-in must be a valid YYYY-MM-DD date." });
      }
      if (Number.isNaN(checkOut.getTime())) {
        ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be a valid YYYY-MM-DD date." });
      }
      if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return;
      if (checkOut <= checkIn) {
        ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in." });
      }
      if (isBookingDatePast(checkIn)) {
        ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Check-in cannot be in the past." });
      }
      if (differenceInBookingNights(checkIn, checkOut) > MAX_PUBLIC_SEARCH_STAY_NIGHTS) {
        ctx.addIssue({
          code: "custom",
          path: ["checkOut"],
          message: `Stays cannot exceed ${MAX_PUBLIC_SEARCH_STAY_NIGHTS} nights.`,
        });
      }
    }

    if ((value.lat === undefined) !== (value.lng === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [value.lat === undefined ? "lat" : "lng"],
        message: "Latitude and longitude must be provided together.",
      });
    }

    if (value.minPrice !== undefined && value.maxPrice !== undefined && value.maxPrice < value.minPrice) {
      ctx.addIssue({ code: "custom", path: ["maxPrice"], message: "Maximum price must be greater than or equal to minimum price." });
    }

    if (value.mapBounds && (value.mapBounds.swLat > value.mapBounds.neLat || value.mapBounds.swLng > value.mapBounds.neLng)) {
      ctx.addIssue({ code: "custom", path: ["mapBounds"], message: "Map bounds are invalid." });
    }
  });

export type ValidatedPublicListingSearchFilters = z.infer<typeof publicListingSearchFiltersSchema>;

export function validatePublicListingSearchFilters<T extends object>(
  filters: T,
): T & ValidatedPublicListingSearchFilters {
  const parsed = publicListingSearchFiltersSchema.parse(filters as Record<string, unknown>);
  const canonicalCheckIn = parsed.checkIn ? bookingDateKey(parsed.checkIn) : undefined;
  const canonicalCheckOut = parsed.checkOut ? bookingDateKey(parsed.checkOut) : undefined;
  return {
    ...parsed,
    ...(canonicalCheckIn ? { checkIn: canonicalCheckIn } : {}),
    ...(canonicalCheckOut ? { checkOut: canonicalCheckOut } : {}),
  } as T & ValidatedPublicListingSearchFilters;
}
