import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; methodId: string }> },
  ) => {
    const actor = await requireApiPermission(req, [
      PERMISSIONS.HOSTS_VIEW,
      PERMISSIONS.PAYOUTS_VIEW,
    ]);

    const { id: hostId, methodId } = await params;
    const body = await req.json();
    const status = body.status === "REJECTED" ? "REJECTED" : "VERIFIED";
    const reason = body.reason;

    const result = await payoutService.verifyHostPayoutMethod(
      actor,
      hostId,
      methodId,
      status,
      reason,
    );

    return ok(result);
  },
);

