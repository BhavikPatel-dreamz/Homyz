import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getAuthContext } from "@/lib/auth/context";
import { requireApiAuth } from "@/lib/permissions/guards";
import { updateListingSchema } from "@/lib/validation/listing";
import { listingService } from "@/services/listing.service";
import { toPublicListingDTO } from "@/services/mappers";
import { ListingStatus, Role } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id] — public only for active listings. Drafts and all
// other non-public states are available exclusively to their owner or an admin.
// For public callers, privacy masking is enforced (exact address/apartment/unrounded coords hidden).
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const listing = await listingService.getById(id);
  if (!listing.published || listing.status !== ListingStatus.ACTIVE) {
    const actor = await requireApiAuth(req);
    return ok(await listingService.getForOwner(actor, id));
  }
  const caller = await getAuthContext(req);
  if (caller && (caller.role === Role.ADMIN || caller.id === listing.hostId)) {
    return ok(listing);
  }
  return ok(toPublicListingDTO(listing));
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
