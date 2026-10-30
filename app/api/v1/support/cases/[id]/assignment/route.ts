import { NextRequest } from "next/server";
import { z } from "zod";

import { ok } from "@/lib/api/response";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  assignedAdminId: z.string().min(1).nullable().optional(),
  expectedVersion: z.number().int().positive(),
  reason: z.string().max(2_000).optional(),
});

export const PATCH = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const input = schema.parse(await req.json());
  const { id } = await context.params;
  return ok(await supportCaseService.assignSupportCase(actor, id, input));
});
