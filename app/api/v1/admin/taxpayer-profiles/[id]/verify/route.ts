import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { hostTaxService } from "@/services/host-tax.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const actor = await requireApiRole(req, [Role.ADMIN]);
    const { id } = await params;
    const body = await req.json();

    if (!body.status || (body.status !== "VERIFIED" && body.status !== "REJECTED")) {
      throw AppError.badRequest("status must be either VERIFIED or REJECTED.");
    }

    const updated = await hostTaxService.verifyTaxpayerProfile(
      actor,
      id,
      body.status,
      body.reason,
    );

    return ok(updated);
  },
);

