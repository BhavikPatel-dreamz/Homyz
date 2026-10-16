import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { updateHostTaxSchema } from "@/lib/validation/tax";
import { taxService } from "@/services/tax.service";

type Ctx = { params: Promise<{ id: string; taxId: string }> };

// PATCH /api/v1/listings/[id]/taxes/[taxId] — update host tax
export const PATCH = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id, taxId } = await ctx.params;
  const json = await req.json();
  const input = updateHostTaxSchema.parse(json);
  const updated = await taxService.updateHostTax(actor, id, taxId, input);
  return ok(updated);
});

// DELETE /api/v1/listings/[id]/taxes/[taxId] — delete host tax
export const DELETE = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id, taxId } = await ctx.params;
  const result = await taxService.deleteHostTax(actor, id, taxId);
  return ok(result);
});

