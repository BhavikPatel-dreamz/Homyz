import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/listings/[id]/submit — submit listing for Admin review
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const listing = await listingService.submitForReview(actor, id);
  return ok(listing);
});
