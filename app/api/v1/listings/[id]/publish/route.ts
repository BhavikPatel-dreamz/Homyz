import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/listings/[id]/publish — legacy compatibility endpoint. A host
// request is queued for Admin review; it never makes a listing public.
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const listing = await listingService.submitForReview(actor, id);
  return ok(listing);
});
