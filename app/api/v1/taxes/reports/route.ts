import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { taxReportFilterSchema } from "@/lib/validation/tax";
import { taxService } from "@/services/tax.service";

// GET /api/v1/taxes/reports — tax history and summary report
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const searchParams = req.nextUrl.searchParams;

  const filters = taxReportFilterSchema.parse({
    listingId: searchParams.get("listingId") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    taxType: searchParams.get("taxType") || undefined,
    remittanceResponsibility: searchParams.get("remittanceResponsibility") || undefined,
  });

  const report = await taxService.getTaxReport(actor, filters);
  return ok(report);
});

