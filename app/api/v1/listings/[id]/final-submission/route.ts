import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saudiLicenseService } from "@/services/saudi-license.service";

type Ctx = { params: Promise<{ id: string }> };
const submitSchema = z.object({ method: z.enum(["automatic", "manual"]) });

export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { id } = await ctx.params;
  const { method } = submitSchema.parse(await req.json());
  return ok(await saudiLicenseService.submitFinal(actor, id, method));
});
