import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { referralService } from "@/services/referral.service";

// GET /api/v1/referrals/me — the authenticated guest's persistent referral
// link and configured reward rule. No caller-supplied user ID is accepted.
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const referral = await referralService.getDashboard(actor.id);
  const referralUrl = new URL(`/ref/${referral.referralCode}`, req.nextUrl.origin).toString();

  return ok({ ...referral, referralUrl });
});
