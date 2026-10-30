import { NextRequest } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_VIEW);
  return ok(await supportCaseService.getSupportCaseAdminDashboard(actor));
});
