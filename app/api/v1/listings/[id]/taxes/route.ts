import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { createHostTaxSchema } from "@/lib/validation/tax";
import { taxService } from "@/services/tax.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/taxes — listing tax overview
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const overview = await taxService.getListingTaxOverview(actor, id);
  return ok(overview);
});

// POST /api/v1/listings/[id]/taxes — create a host-managed tax
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const json = await req.json();
  const input = createHostTaxSchema.parse({ ...json, listingId: id });
  const tax = await taxService.createHostTax(actor, input);
  return created(tax);
});

