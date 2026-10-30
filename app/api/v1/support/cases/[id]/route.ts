import { NextRequest } from "next/server";

import { ok } from "@/lib/api/response";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { Role } from "@/generated/prisma/enums";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) {
    await requireApiPermission(req, PERMISSIONS.DISPUTES_VIEW);
  }
  const { id } = await context.params;
  return ok(await supportCaseService.getSupportCaseDetails(actor, id));
});
