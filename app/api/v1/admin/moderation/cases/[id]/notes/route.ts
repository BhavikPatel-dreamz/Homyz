import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

const noteSchema = z.object({ note: z.string().trim().min(1).max(5_000) });

export const POST = apiHandler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_DECISION_CREATE);
  const { id } = await ctx.params;
  return created(await moderationService.addModerationNote(actor, id, noteSchema.parse(await req.json()).note));
});
