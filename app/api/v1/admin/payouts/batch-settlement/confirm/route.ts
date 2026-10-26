import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { payoutRoutingService } from "@/services/payout-routing.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.ADMIN]);
  const body = await req.json();

  if (!body.batchReference || !body.status) {
    throw AppError.badRequest("batchReference and status (PAID or FAILED) are required.");
  }

  if (body.status !== "PAID" && body.status !== "FAILED") {
    throw AppError.badRequest("status must be either PAID or FAILED.");
  }

  const result = await payoutRoutingService.confirmBatchSettlement(
    actor,
    body.batchReference,
    body.status,
    body.reason,
  );

  return ok(result);
});

