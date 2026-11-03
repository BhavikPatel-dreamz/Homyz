import { NextRequest } from "next/server";
import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { resolutionOfferService } from "@/services/resolution-offer.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["ACCEPT", "REJECT", "WITHDRAW"]), expectedVersion: z.number().int().positive() });

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiAuth(req);
  const { id } = await context.params;
  return ok(await resolutionOfferService.actOnResolutionOffer(actor, id, schema.parse(await req.json())));
});
