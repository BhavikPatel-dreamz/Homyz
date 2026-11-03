import { NextRequest } from "next/server";
import { z } from "zod";

import { SupportCasePriority } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ priority: z.nativeEnum(SupportCasePriority), expectedVersion: z.number().int().positive(), reason: z.string().max(2_000).optional() });

export const PATCH = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const { id } = await context.params;
  return ok(await supportCaseService.updateSupportCasePriority(actor, id, schema.parse(await req.json())));
});
