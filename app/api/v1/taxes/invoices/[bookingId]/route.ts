import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { taxService } from "@/services/tax.service";

type Ctx = { params: Promise<{ bookingId: string }> };

// GET /api/v1/taxes/invoices/[bookingId] — generate tax invoice
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { bookingId } = await ctx.params;
  const invoice = await taxService.generateTaxInvoice(actor, bookingId);
  return ok(invoice);
});

