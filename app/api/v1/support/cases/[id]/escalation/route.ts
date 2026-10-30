import { NextRequest } from "next/server";
import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ expectedVersion: z.number().int().positive(), level: z.number().int().min(1).max(4), reason: z.string().min(1).max(2_000), escalationOwnerId: z.string().min(1).nullable().optional() });

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const { id } = await context.params;
  return ok(await supportCaseService.escalateSupportCase(actor, id, schema.parse(await req.json())));
});
