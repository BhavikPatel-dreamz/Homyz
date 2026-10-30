import { NextRequest } from "next/server";
import { z } from "zod";

import { created } from "@/lib/api/response";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupportCaseParticipantRole } from "@/generated/prisma/enums";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(SupportCaseParticipantRole),
  canPost: z.boolean().optional(),
  expectedVersion: z.number().int().positive(),
});

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const input = schema.parse(await req.json());
  const { id } = await context.params;
  return created(await supportCaseService.addSupportCaseParticipant(actor, id, input));
});
