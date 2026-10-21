import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saudiLicenseService } from "@/services/saudi-license.service";

type Ctx = { params: Promise<{ listingId: string }> };

/** Returns only the caller's permitted licence links and audit-safe history. */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  return ok(await saudiLicenseService.getLicenseManagement(actor, listingId));
});

/** Reuses the stored number, records a new verification history row, and is idempotent. */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  return ok(await saudiLicenseService.reverifyForListing(actor, listingId));
});
