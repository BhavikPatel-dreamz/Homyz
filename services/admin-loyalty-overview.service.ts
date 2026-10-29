import { ReferralRewardStatus, StayEliteQualificationStatus, StayEliteTierCode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { buildAdminBenefitCatalog, LOYALTY_CAPABILITY_BLOCKERS } from "@/lib/stayelite/admin-loyalty-catalog";

function dateBounds(from?: string | null, to?: string | null) {
  const start = from ? new Date(from) : undefined;
  const end = to ? new Date(to) : undefined;
  if (start && Number.isNaN(start.valueOf())) throw new Error("Invalid from date");
  if (end && Number.isNaN(end.valueOf())) throw new Error("Invalid to date");
  if (start && end && start > end) throw new Error("from must be before to");
  return { ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}) };
}

export async function getAdminLoyaltyOverview(input: { from?: string | null; to?: string | null } = {}) {
  const range = dateBounds(input.from, input.to);
  const [memberships, tiers, awaitingEvaluation, pendingReferrals, recentChanges] = await Promise.all([
    prisma.stayEliteMembership.groupBy({ by: ["currentTier"], where: range, _count: { _all: true } }),
    prisma.stayEliteTierDefinition.findMany({ select: { code: true, displayName: true, enabled: true, qualificationConfig: true, policyVersion: true, benefitMetadata: true }, orderBy: { displayOrder: "asc" } }),
    prisma.stayEliteMembership.count({ where: { ...range, OR: [{ lastEvaluatedAt: null }, { qualificationStatus: StayEliteQualificationStatus.IN_PROGRESS }] } }),
    prisma.referralReward.count({ where: { ...range, status: ReferralRewardStatus.PENDING } }),
    prisma.auditLog.findMany({ where: { action: { startsWith: "ACHIEVEMENT_" } }, select: { id: true, action: true, resourceType: true, resourceId: true, description: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const count = (tier: StayEliteTierCode) => memberships.find((row) => row.currentTier === tier)?._count._all ?? 0;
  return {
    range: { from: input.from ?? null, to: input.to ?? null },
    metrics: {
      totalRegisteredLoyaltyMembers: memberships.reduce((sum, row) => sum + row._count._all, 0), traveler: count(StayEliteTierCode.TRAVELER), ambassador: count(StayEliteTierCode.AMBASSADOR), icon: count(StayEliteTierCode.ICON),
      awaitingEligibilityEvaluation: awaitingEvaluation, pendingReferralConversions: pendingReferrals,
      availableBenefitDefinitions: buildAdminBenefitCatalog().length,
      rewardDefinitions: { available: false, reason: LOYALTY_CAPABILITY_BLOCKERS.rewards },
      pendingRewardRedemptions: { available: false, reason: LOYALTY_CAPABILITY_BLOCKERS.rewards },
      pointsIssuedAndRedeemed: { available: false, reason: LOYALTY_CAPABILITY_BLOCKERS.points },
      activeCampaigns: { available: false, reason: LOYALTY_CAPABILITY_BLOCKERS.campaigns },
    },
    tiers, benefits: buildAdminBenefitCatalog(), recentChanges,
    capabilityBlockers: LOYALTY_CAPABILITY_BLOCKERS,
  };
}
