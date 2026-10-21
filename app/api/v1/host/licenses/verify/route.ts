import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saudiLicenseService } from "@/services/saudi-license.service";

const verifySchema = z.object({
  listingId: z.string().cuid(),
  licenseNumber: z.string().trim().min(1).max(120),
});

// Server-only verification endpoint. It never returns provider secrets or raw
// responses and enforces both listing ownership and Saudi country eligibility.
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const input = verifySchema.parse(await req.json());
  return ok(await saudiLicenseService.verifyForListing(actor, input.listingId, input.licenseNumber));
});
