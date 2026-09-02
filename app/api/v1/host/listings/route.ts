import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";

// GET /api/v1/host/listings — fetch current user's listings
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const result = await listingService.listForHost(actor);
  return ok(result);
});
