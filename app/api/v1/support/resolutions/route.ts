import { NextRequest } from "next/server";
import { z } from "zod";

import { ResolutionOfferType } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { resolutionOfferService } from "@/services/resolution-offer.service";

export const dynamic = "force-dynamic";
const schema = z.object({ bookingId: z.string().min(1), subject: z.string().min(1).max(160), category: z.string().max(80).optional(), issueType: z.string().max(120).optional(), offerType: z.nativeEnum(ResolutionOfferType), amount: z.number().int().positive().optional(), currency: z.string().length(3).optional(), description: z.string().min(1).max(4_000), expiresAt: z.coerce.date().optional(), idempotencyKey: z.string().min(8).max(200).optional() });

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiAuth(req);
  return created(await resolutionOfferService.createResolutionRequest(actor, schema.parse(await req.json())));
});
