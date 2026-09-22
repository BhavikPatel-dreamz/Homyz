import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { createListingSchema } from "@/lib/validation/listing";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

// GET /api/v1/listings — public catalogue & search of published listings (paginated).
export const GET = apiHandler(async (req) => {
  const sp = req.nextUrl.searchParams;
  const { page, limit, skip, take } = parsePagination(sp);
  const countOnly = sp.get("countOnly") === "true";

  const city = sp.get("city") || sp.get("destination") || undefined;
  const destination = sp.get("destination") || undefined;
  const placeName = sp.get("placeName") || destination || city || undefined;
  const lat = sp.get("lat") ? parseFloat(sp.get("lat")!) : undefined;
  const lng = sp.get("lng") ? parseFloat(sp.get("lng")!) : undefined;
  const radiusKm = sp.get("radius") ? parseFloat(sp.get("radius")!) : undefined;
  const placeId = sp.get("placeId") || undefined;
  const locationType = sp.get("locationType") || undefined;
  const guests = sp.get("guests") ? parseInt(sp.get("guests")!, 10) : undefined;
  const adults = sp.get("adults") ? parseInt(sp.get("adults")!, 10) : undefined;
  const children = sp.get("children") ? parseInt(sp.get("children")!, 10) : undefined;
  const infants = sp.get("infants") ? parseInt(sp.get("infants")!, 10) : undefined;
  const propertyType = sp.get("propertyType") || undefined;
  const propertyTypesParam = sp.get("propertyTypes");
  const propertyTypes = propertyTypesParam
    ? propertyTypesParam.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;
  const listingType = sp.get("listingType") || undefined;
  const minPrice = sp.get("minPrice") ? parseInt(sp.get("minPrice")!, 10) : undefined;
  const maxPrice = sp.get("maxPrice") ? parseInt(sp.get("maxPrice")!, 10) : undefined;
  const checkIn = sp.get("checkIn") || sp.get("startDate") || undefined;
  const checkOut = sp.get("checkOut") || sp.get("endDate") || undefined;
  const amenitiesParam = sp.get("amenities");
  const amenities = amenitiesParam ? amenitiesParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  // Extended filters
  const bedrooms = sp.get("bedrooms") ? parseInt(sp.get("bedrooms")!, 10) : undefined;
  const bathrooms = sp.get("bathrooms") ? parseInt(sp.get("bathrooms")!, 10) : undefined;
  const beds = sp.get("beds") ? parseInt(sp.get("beds")!, 10) : undefined;
  const instantBook = sp.get("instantBook") === "true" ? true : undefined;
  const featured = sp.get("featured") === "true" ? true : undefined;
  const pets = sp.get("pets") ? parseInt(sp.get("pets")!, 10) : undefined;
  const accessibilityParam = sp.get("accessibility");
  const accessibilityFeatures = accessibilityParam
    ? accessibilityParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const languagesParam = sp.get("languages");
  const languages = languagesParam
    ? languagesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const sortBy = (sp.get("sortBy") as import("@/services/listing.service").SortBy) || undefined;
  // Map bounds (supports both neLat/neLng/swLat/swLng and north/east/south/west)
  const rawNorth = sp.get("neLat") || sp.get("north");
  const rawEast = sp.get("neLng") || sp.get("east");
  const rawSouth = sp.get("swLat") || sp.get("south");
  const rawWest = sp.get("swLng") || sp.get("west");
  const neLat = rawNorth ? parseFloat(rawNorth) : undefined;
  const neLng = rawEast ? parseFloat(rawEast) : undefined;
  const swLat = rawSouth ? parseFloat(rawSouth) : undefined;
  const swLng = rawWest ? parseFloat(rawWest) : undefined;
  const mapBounds = neLat !== undefined && neLng !== undefined && swLat !== undefined && swLng !== undefined
    ? { neLat, neLng, swLat, swLng }
    : undefined;

  const hasFilters = Boolean(
    countOnly || city || destination || placeName || lat !== undefined || lng !== undefined || guests || adults || children || infants || propertyType || propertyTypes?.length || listingType || minPrice || maxPrice ||
    checkIn || checkOut || amenities || bedrooms || bathrooms || beds ||
    instantBook || featured || pets || accessibilityFeatures || languages ||
    sortBy || mapBounds,
  );

  const result = hasFilters
    ? await listingService.searchPublicListings({
        city,
        destination,
        placeName,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
        placeId,
        locationType,
        guests,
        adults,
        children,
        infants,
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
        pets,
        sortBy,
        mapBounds,
        countOnly,
        skip,
        take,
      })
    : await listingService.list({ skip, take });

  const total = result.total;
  const items = result.items;
  return paginated(items, buildPagination(page, limit, total));
});

// POST /api/v1/listings — create a listing draft (USER, HOST or ADMIN).
export const POST = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.USER, Role.HOST, Role.ADMIN]);
  const body = createListingSchema.parse(await req.json());
  const listing = await listingService.create(actor, body);
  return created(listing);
});
