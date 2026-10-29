import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { getStayEliteTierProjection } from "@/services/stayelite-tier.service";

// Owner-only projection. It intentionally returns no booking/review/referral
// identifiers and has no mutation method, so a guest cannot self-promote.
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  return ok(await getStayEliteTierProjection(actor.id));
});
