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
  const { searchParams } = req.nextUrl;
  const { page, limit, skip, take } = parsePagination(searchParams);
  const tab = searchParams.get("tab") || searchParams.get("status") || "ALL";
  const search = searchParams.get("search") || searchParams.get("q") || "";

  const { items, total, totalCount } = await listingService.listForHost(actor, {
    skip,
    take,
    page,
    limit,
    tab,
    search,
  });
  return paginated(items, buildPagination(page, limit, totalCount ?? total));
});
