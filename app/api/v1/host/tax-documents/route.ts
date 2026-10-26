import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostTaxService } from "@/services/host-tax.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const { searchParams } = new URL(req.url);

  const yearParam = searchParams.get("year");
  const typeParam = searchParams.get("type");

  const taxYear = yearParam ? parseInt(yearParam, 10) : undefined;
  const documentType = typeParam || undefined;

  const documents = await hostTaxService.getHostTaxDocuments(actor, {
    taxYear,
    documentType,
  });

  return ok(documents);
});

