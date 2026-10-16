import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { listingService } from "@/services/listing.service";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/listings/[id]/unpublish — host unpublishes listing
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const listing = await listingService.unpublish(actor, id);
  return ok(listing);
});

