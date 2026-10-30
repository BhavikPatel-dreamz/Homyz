import { NextRequest } from "next/server";
import { z } from "zod";

import { created } from "@/lib/api/response";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { Role, SupportCaseContentVisibility } from "@/generated/prisma/enums";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  content: z.string().min(1).max(10_000),
  visibility: z.nativeEnum(SupportCaseContentVisibility).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const input = schema.parse(await req.json());
  const { id } = await context.params;
  return created(await supportCaseService.addSupportCaseMessage(actor, id, input));
});
