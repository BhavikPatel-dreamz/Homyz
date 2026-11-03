import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { saudiLicenseService } from "@/services/saudi-license.service";
import { z } from "zod";

type Ctx = { params: Promise<{ listingId: string }> };

/** Returns only the caller's permitted licence links and audit-safe history. */
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  return ok(await saudiLicenseService.getLicenseManagement(actor, listingId));
});

/** Reuses the stored number, records a new verification history row, and returns full management state. */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  const result = await saudiLicenseService.reverifyForListing(actor, listingId);
  const management = await saudiLicenseService.getLicenseManagement(actor, listingId);
  return ok(management ?? result);
});

/**
 * Saves a replacement number only. It intentionally never performs provider
 * verification, so the UI can give Save and Verify independent loading states.
 */
export const PUT = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiAuth(req);
  const { listingId } = await ctx.params;
  const input = z.object({
    licenseNumber: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(500).optional(),
  }).parse(await req.json());
  return ok(await saudiLicenseService.saveLicenseForListing(actor, listingId, input.licenseNumber, input.reason));
});
