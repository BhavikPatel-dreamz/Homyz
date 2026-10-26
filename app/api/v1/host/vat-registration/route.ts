import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { saveVatRegistrationInputSchema } from "@/lib/validation/tax";
import { hostTaxService } from "@/services/host-tax.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const registrations = await hostTaxService.getHostVatRegistrations(actor);
  return ok(registrations);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const json = await req.json();
  const input = saveVatRegistrationInputSchema.parse(json);
  const result = await hostTaxService.saveHostVatRegistration(actor, input);
  return created(result);
});

