import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { communicationAdminService } from "@/services/communication-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.COMMUNICATIONS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const summary = await communicationAdminService.getCommunicationSummaryForAdmin(actor);
  return ok(summary);
});

