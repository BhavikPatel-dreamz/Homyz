import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/readiness — owner/admin-only publication checklist.
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const listing = await listingService.getForOwner(actor, id);
  return ok(listingService.getPublishReadiness(listing));
});
