import { NextRequest } from "next/server";
import { z } from "zod";

import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { resolutionOfferService } from "@/services/resolution-offer.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ expectedVersion: z.number().int().positive(), reason: z.string().min(1).max(2_000) });

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const { id } = await context.params;
  return ok(await resolutionOfferService.requestResolutionMediation(actor, id, schema.parse(await req.json())));
});
