import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { saveTaxpayerProfileSchema } from "@/lib/validation/tax";
import { hostTaxService } from "@/services/host-tax.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const profile = await hostTaxService.getHostTaxpayerProfile(actor);
  return ok(profile);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const json = await req.json();
  const input = saveTaxpayerProfileSchema.parse(json);
  const profile = await hostTaxService.saveHostTaxpayerProfile(actor, input);
  return created(profile);
});

