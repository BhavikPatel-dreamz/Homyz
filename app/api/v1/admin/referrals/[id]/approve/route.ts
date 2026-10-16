import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { referralService } from "@/services/referral.service";

// POST /api/v1/admin/referrals/:id/approve — permanently approve a pending credit.
export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.REFERRALS_REVIEW);
  const { id } = await params;
  return ok(await referralService.approveReward(actor, id));
});
