import { NextRequest } from "next/server";
import { z } from "zod";

import { ResolutionOfferType, Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { resolutionOfferService } from "@/services/resolution-offer.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ offerType: z.nativeEnum(ResolutionOfferType), amount: z.number().int().positive().optional(), currency: z.string().length(3).optional(), description: z.string().min(1).max(4_000), expiresAt: z.coerce.date().optional(), recipientId: z.string().min(1).optional(), parentOfferId: z.string().min(1).optional(), idempotencyKey: z.string().min(8).max(200).optional() });

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  const { id } = await context.params;
  return created(await resolutionOfferService.createResolutionOffer(actor, id, schema.parse(await req.json())));
});
