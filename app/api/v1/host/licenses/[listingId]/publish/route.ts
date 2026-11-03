import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saudiLicenseService } from "@/services/saudi-license.service";

type Ctx = { params: Promise<{ listingId: string }> };

const publishSchema = z.object({
  method: z.enum(["automatic", "manual"]).default("automatic"),
});

/**
 * Handles final approval submission and publication for a listing.
 * Strictly verifies Saudi license eligibility before permitting publication.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { method } = publishSchema.parse(body);
  const listing = await saudiLicenseService.submitFinal(actor, listingId, method);
  return ok(listing);
});

