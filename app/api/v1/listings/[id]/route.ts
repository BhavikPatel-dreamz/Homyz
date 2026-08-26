import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { updateListingSchema } from "@/lib/validation/listing";
import { listingService } from "@/services/listing.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id] — public read of a single listing.
export const GET = apiHandler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const listing = await listingService.getById(id);
  return ok(listing);
});

// PATCH /api/v1/listings/[id] — update (owner host, or ADMIN). Ownership is
// enforced in the service; a non-owner receives 403.
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const body = updateListingSchema.parse(await req.json());
  const listing = await listingService.update(actor, id, body);
  return ok(listing);
});

// DELETE /api/v1/listings/[id] — delete (owner host, or ADMIN).
export const DELETE = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const result = await listingService.remove(actor, id);
  return ok(result);
});
