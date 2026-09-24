import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { rejectReferralRewardSchema } from "@/lib/validation/referral";
import { referralService } from "@/services/referral.service";

// POST /api/v1/admin/referrals/:id/reject — reject a pending credit with an auditable reason.
export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.REFERRALS_REVIEW);
  const { id } = await params;
  const { reason } = rejectReferralRewardSchema.parse(await req.json());
  return ok(await referralService.rejectReward(actor, id, reason));
});
