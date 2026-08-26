import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { createListingSchema } from "@/lib/validation/listing";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

// GET /api/v1/listings — public catalogue of published listings (paginated).
export const GET = apiHandler(async (req) => {
  const { page, limit, skip, take } = parsePagination(req.nextUrl.searchParams);
  const { items, total } = await listingService.list({ skip, take });
  return paginated(items, buildPagination(page, limit, total));
});

// POST /api/v1/listings — create a listing (HOST or ADMIN).
export const POST = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = createListingSchema.parse(await req.json());
  const listing = await listingService.create(actor, body);
  return created(listing);
});
