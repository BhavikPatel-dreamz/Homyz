import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { saudiLicenseService } from "@/services/saudi-license.service";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const listingId = req.nextUrl.searchParams.get("listingId");
  if (!listingId) throw AppError.validation("listingId is required.");
  return ok(await saudiLicenseService.getListingLicense(actor, listingId));
});
