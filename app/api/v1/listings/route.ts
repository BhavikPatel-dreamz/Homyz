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

  const city = sp.get("city") || sp.get("destination") || undefined;
  const guests = sp.get("guests") ? parseInt(sp.get("guests")!, 10) : undefined;
  const propertyType = sp.get("propertyType") || undefined;
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
  const sortBy = (sp.get("sortBy") as import("@/services/listing.service").SortBy) || undefined;
  // Map bounds
  const neLat = sp.get("neLat") ? parseFloat(sp.get("neLat")!) : undefined;
  const neLng = sp.get("neLng") ? parseFloat(sp.get("neLng")!) : undefined;
  const swLat = sp.get("swLat") ? parseFloat(sp.get("swLat")!) : undefined;
  const swLng = sp.get("swLng") ? parseFloat(sp.get("swLng")!) : undefined;
  const mapBounds = neLat !== undefined && neLng !== undefined && swLat !== undefined && swLng !== undefined
    ? { neLat, neLng, swLat, swLng }
    : undefined;

  const hasFilters = Boolean(
    city || guests || propertyType || listingType || minPrice || maxPrice ||
    checkIn || checkOut || amenities || bedrooms || bathrooms || beds ||
    instantBook || sortBy || mapBounds,
  );

  const result = hasFilters
    ? await listingService.searchPublicListings({
        city,
        guests,
        propertyType,
        listingType,
        minPrice,
        maxPrice,
        checkIn,
        checkOut,
        amenities,
        bedrooms,
        bathrooms,
        beds,
        instantBook,
        sortBy,
        mapBounds,
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
