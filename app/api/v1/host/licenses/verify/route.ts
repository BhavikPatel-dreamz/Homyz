import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { saudiLicenseService } from "@/services/saudi-license.service";

const verifySchema = z.object({
  listingId: z.string().trim().min(1),
  accommodationType: z.string().trim().min(1).max(80).optional(),
  licenseNumber: z.string().trim().min(1).max(120).optional(),
  nationalId: z.string().trim().min(1).max(32).optional(),
});

// Server-only verification endpoint. It never returns provider secrets or raw
// responses and enforces both listing ownership and Saudi country eligibility.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const input = verifySchema.parse(await req.json());
  if (input.accommodationType || input.licenseNumber || input.nationalId) {
    if (!input.accommodationType || !input.licenseNumber || !input.nationalId) {
      throw AppError.validation("Accommodation type, permit number, and national ID are required together.");
    }
    await saudiLicenseService.saveRegistrationDetails(actor, input.listingId, {
      accommodationType: input.accommodationType,
      licenseNumber: input.licenseNumber,
      nationalId: input.nationalId,
    });
  }
  return ok(await saudiLicenseService.reverifyForListing(actor, input.listingId));
});
