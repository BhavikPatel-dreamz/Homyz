import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const methods = await payoutService.getHostPayoutMethods(actor.id);
  return ok(methods);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const body = await req.json();

  const method = await payoutService.addHostPayoutMethod(actor.id, {
    accountHolderName: body.accountHolderName,
    bankName: body.bankName,
    iban: body.iban,
    routingCode: body.routingCode,
    currency: body.currency,
    isDefault: body.isDefault,
  });

  return ok(method);
});

