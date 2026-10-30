import { NextRequest } from "next/server";
import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { resolutionOfferService } from "@/services/resolution-offer.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ refundId: z.string().min(1) });

export const POST = apiHandler(async (req: NextRequest, context: Context) => {
  const actor = await requireApiPermission(req, PERMISSIONS.DISPUTES_RESOLVE);
  const { id } = await context.params;
  return ok(await resolutionOfferService.linkResolutionOfferRefund(actor, id, schema.parse(await req.json()).refundId));
});
