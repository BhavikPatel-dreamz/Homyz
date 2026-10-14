import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const PUT = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const { id } = await params;

  const methods = await payoutService.setDefaultPayoutMethod(actor.id, id);
  return ok(methods);
});

