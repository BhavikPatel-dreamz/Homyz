import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.DISPUTES_MANAGE,
    PERMISSIONS.BOOKINGS_MANAGE,
  ]);

  const { id } = await params;
  const body = await req.json();

  const result = await disputeService.assignDispute(
    actor,
    id,
    body.assignedToId,
    body.assignedToEmail,
  );

  return ok(result);
});
