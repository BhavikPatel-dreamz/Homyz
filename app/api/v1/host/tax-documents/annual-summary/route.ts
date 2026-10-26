import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { hostTaxService } from "@/services/host-tax.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = await req.json();

  const taxYear = parseInt(body.taxYear, 10);
  if (!taxYear || isNaN(taxYear) || taxYear < 2020 || taxYear > 2035) {
    throw AppError.badRequest("A valid 4-digit tax year is required (e.g. 2025).");
  }

  const result = await hostTaxService.generateAnnualTaxSummary(actor, taxYear);
  return created(result.document);
});

