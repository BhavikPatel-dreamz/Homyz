import { apiHandler } from "@/lib/api/handler";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { paginated } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";
import { Role } from "@/generated/prisma/enums";

// GET /api/v1/hosts/listings — the calling host's own listings (paginated).
// A host only ever sees resources they own.
export const GET = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const { page, limit, skip, take } = parsePagination(req.nextUrl.searchParams);
  const { items, total } = await listingService.listForHost(actor, {
    skip,
    take,
  });
  return paginated(items, buildPagination(page, limit, total));
});
