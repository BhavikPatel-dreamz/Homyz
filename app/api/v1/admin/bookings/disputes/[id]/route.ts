import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.DISPUTES_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { id } = await params;
  const dispute = await disputeService.getDisputeDetailsForAdmin(actor, id);
  return ok(dispute);
});
