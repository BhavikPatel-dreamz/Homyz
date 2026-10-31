import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saudiLicenseService } from "@/services/saudi-license.service";

type Ctx = { params: Promise<{ listingId: string }> };

const saveRegistrationSchema = z.object({
  accommodationType: z.string().trim().min(1, "Accommodation type is required."),
  licenseNumber: z.string().trim().min(1, "License number is required.").max(120),
  nationalId: z.string().trim().min(1, "National ID is required.").max(32),
});

/**
 * Returns registration details (accommodation type, license number, decrypted national ID)
 * solely to the authorized host for the listing creation / edit wizard.
 */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  const details = await saudiLicenseService.getRegistrationDetails(actor, listingId);
  return ok(details);
});

/**
 * Persists the Saudi registration details for the listing.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  const input = saveRegistrationSchema.parse(await req.json());
  const result = await saudiLicenseService.saveRegistrationDetails(actor, listingId, input);
  return ok(result);
});

