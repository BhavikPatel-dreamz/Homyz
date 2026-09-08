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

  const hasFilters = Boolean(
    city || guests || propertyType || listingType || minPrice || maxPrice || checkIn || checkOut || amenities,
  );

  const { items, total } = hasFilters
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
        skip,
        take,
      })
    : await listingService.list({ skip, take });

  return paginated(items, buildPagination(page, limit, total));
});

// POST /api/v1/listings — create a listing draft (USER, HOST or ADMIN).
export const POST = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.USER, Role.HOST, Role.ADMIN]);
  const body = createListingSchema.parse(await req.json());
  const listing = await listingService.create(actor, body);
  return created(listing);
});
