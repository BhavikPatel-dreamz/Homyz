import { ReferralRewardsTable } from "@/components/admin/referral-rewards-table";
import { ReferralRewardStatus } from "@/generated/prisma/enums";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { referralService } from "@/services/referral.service";

export default async function ReferralCreditsPage() {
  const actor = await requirePagePermission(PERMISSIONS.REFERRALS_VIEW);
  const { items, total } = await referralService.listRewards({
    take: 20,
    status: ReferralRewardStatus.PENDING,
  });
  return <ReferralRewardsTable initialItems={items} initialTotal={total} canReview={hasPermission(actor, PERMISSIONS.REFERRALS_REVIEW)} />;
}
