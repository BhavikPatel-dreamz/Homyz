import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest, context: { params: Promise<{ transactionId: string }> }) => {
  const actor = await requireApiRole(request, [Role.HOST, Role.ADMIN]);
  const { transactionId } = await context.params;
  return ok(await payoutService.getHostEarningsTransactionDetails(actor.id, transactionId));
});
