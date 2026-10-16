import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { createListingSchema } from "@/lib/validation/listing";
import { listingService } from "@/services/listing.service";
import { moderationService } from "@/services/moderation.service";
import { Role } from "@/generated/prisma/enums";
import { parsePublicListingSort } from "@/lib/listings/public-sort";
import { validatePublicListingSearchFilters } from "@/lib/validation/public-listing-search";
import { AppError } from "@/lib/api/errors";

// GET /api/v1/listings — public catalogue & search of published listings (paginated).
export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl.searchParams;
  const firstQueryValue = (...keys: string[]): string | null => {
    for (const key of keys) {
      if (sp.has(key)) return sp.get(key);
    }
    return null;
  };
  const numberParam = (key: string): number | undefined => {
    if (!sp.has(key)) return undefined;
    const value = sp.get(key)?.trim();
    return value ? Number(value) : Number.NaN;
  };
  const { page, limit, skip, take } = parsePagination(sp);
  const countOnly = sp.get("countOnly") === "true";

  const destination = firstQueryValue("destination", "location") || undefined;
  const city = firstQueryValue("city") || destination;
  const country = sp.has("country") ? sp.get("country") ?? "" : undefined;
  const placeName = firstQueryValue("placeName") || destination || city || undefined;
  const lat = numberParam("lat");
  const lng = numberParam("lng");
  const radiusKm = numberParam("radius");
  const placeId = sp.get("placeId") || undefined;
  const locationType = sp.get("locationType") || undefined;
  const guests = numberParam("guests");
  const adults = numberParam("adults");
  const children = numberParam("children");
  const infants = numberParam("infants");
  const propertyType = sp.get("propertyType") || undefined;
  const propertyTypesParam = sp.get("propertyTypes");
  const propertyTypes = propertyTypesParam
    ? propertyTypesParam.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;
  const listingType = sp.get("listingType") || undefined;
  const minPrice = numberParam("minPrice");
  const maxPrice = numberParam("maxPrice");
  const checkIn = firstQueryValue("checkIn", "checkin", "startDate") ?? undefined;
  const checkOut = firstQueryValue("checkOut", "checkout", "endDate") ?? undefined;
  const amenitiesParam = sp.get("amenities");
  const amenities = amenitiesParam ? amenitiesParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  // Extended filters
  const bedrooms = numberParam("bedrooms");
  const bathrooms = numberParam("bathrooms");
  const beds = numberParam("beds");
  const instantBook = sp.get("instantBook") === "true" ? true : undefined;
  const featured = sp.get("featured") === "true" ? true : undefined;
  const pets = numberParam("pets");
  const accessibilityParam = sp.get("accessibility");
  const accessibilityFeatures = accessibilityParam
    ? accessibilityParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const languagesParam = sp.get("languages");
  const languages = languagesParam
    ? languagesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const sortBy = parsePublicListingSort(sp.get("sortBy"));
  // Map bounds (supports both neLat/neLng/swLat/swLng and north/east/south/west)
  const rawNorth = firstQueryValue("neLat", "north");
  const rawEast = firstQueryValue("neLng", "east");
  const rawSouth = firstQueryValue("swLat", "south");
  const rawWest = firstQueryValue("swLng", "west");
  const hasSomeMapBounds = [rawNorth, rawEast, rawSouth, rawWest].some((value) => value !== null);
  const hasAllMapBounds = [rawNorth, rawEast, rawSouth, rawWest].every((value) => value !== null);
  if (hasSomeMapBounds && !hasAllMapBounds) {
    throw AppError.validation("All four map bounds must be provided together.");
  }
  const neLat = rawNorth !== null ? Number(rawNorth) : undefined;
  const neLng = rawEast !== null ? Number(rawEast) : undefined;
  const swLat = rawSouth !== null ? Number(rawSouth) : undefined;
  const swLng = rawWest !== null ? Number(rawWest) : undefined;
  const mapBounds = neLat !== undefined && neLng !== undefined && swLat !== undefined && swLng !== undefined
    ? { neLat, neLng, swLat, swLng }
    : undefined;

  const validated = validatePublicListingSearchFilters({
    city,
    country,
    destination,
    placeName,
    lat,
    lng,
    radiusKm,
    placeId,
    locationType,
    guests,
    adults,
    children,
    infants,
    pets,
    propertyType,
    propertyTypes,
    listingType,
    minPrice,
    maxPrice,
    checkIn,
    checkOut,
    amenities,
    accessibilityFeatures,
    languages,
    bedrooms,
    bathrooms,
    beds,
    instantBook,
    featured,
    sortBy,
    mapBounds,
    page: numberParam("page"),
    limit: numberParam("limit"),
  });

  const hasFilters = Boolean(
    countOnly || validated.city || validated.country || destination || placeName || lat !== undefined || lng !== undefined || guests || adults || children || infants || propertyType || propertyTypes?.length || listingType || minPrice || maxPrice ||
    checkIn || checkOut || amenities || bedrooms || bathrooms || beds ||
    instantBook || featured || pets || accessibilityFeatures || languages ||
    sortBy || mapBounds,
  );

  const result = hasFilters
    ? await listingService.searchPublicListings({
        ...validated,
        destination,
        countOnly,
        // This endpoint exposes pagination only; slider bounds are produced by
        // the server-rendered listings page, so skip the extra aggregate here.
        includePriceRange: false,
        skip,
        take,
      })
    : await listingService.list({ skip, take });

  const total = result.total;
  const items = result.items;
  const pagination = buildPagination(page, limit, total);
  return NextResponse.json({
    success: true,
    data: items,
    items,
    pagination,
    total,
    totalPages: pagination.totalPages,
    priceRange: (result as any).priceRange,
    locationContextName: (result as any).locationContextName,
    targetCoords: (result as any).targetCoords,
    appliedRadiusKm: (result as any).appliedRadiusKm,
    isRadiusExpanded: (result as any).isRadiusExpanded,
  });
});

// POST /api/v1/listings — create a listing draft (USER, HOST or ADMIN).
export const POST = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.USER, Role.HOST, Role.ADMIN]);
  await moderationService.assertUserNotRestricted(actor.id, "RESTRICT_LISTING_CREATION");
  const body = createListingSchema.parse(await req.json());
  const listing = await listingService.create(actor, body);
  return created(listing);
});
