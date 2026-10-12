import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";

// GET /api/v1/host/listings — fetch current user's listings (paginated, filtered, searched)
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "12", 10) || 12));
  const tab = searchParams.get("tab") || searchParams.get("status") || "ALL";
  const search = searchParams.get("search") || searchParams.get("q") || "";

  const result = await listingService.listForHost(actor, {
    cardOnly: true,
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    tab,
    search,
  });

  return ok(result);
});
