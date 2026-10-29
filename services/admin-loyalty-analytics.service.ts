import { ReferralRewardStatus, StayEliteQualificationStatus, StayEliteTierChangeDisposition } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { LOYALTY_CAPABILITY_BLOCKERS } from "@/lib/stayelite/admin-loyalty-catalog";
import { LOYALTY_METRIC_CATALOG } from "@/lib/stayelite/analytics-metrics";

function range(input: { from?: string | null; to?: string | null }) { const from = input.from ? new Date(input.from) : undefined; const to = input.to ? new Date(input.to) : undefined; if ((from && Number.isNaN(+from)) || (to && Number.isNaN(+to)) || (from && to && from > to)) throw AppError.validation("Use a valid inclusive UTC date range."); return { ...(from || to ? { gte: from, lte: to } : {}) }; }
export async function getAdminLoyaltyAnalytics(input: { from?: string | null; to?: string | null } = {}) {
  const createdAt = range(input); const occurredAt = range(input); const evaluatedAt = range(input); const awardedAt = range(input);
  const [memberships, transitions, blockedEvaluations, definitions, awards, referrals, topAwardRows] = await Promise.all([
    prisma.stayEliteMembership.groupBy({ by: ["currentTier"], _count: { _all: true } }),
    prisma.stayEliteTierHistory.count({ where: { occurredAt, disposition: StayEliteTierChangeDisposition.APPLIED } }),
    prisma.stayEliteTierEvaluation.count({ where: { evaluatedAt, qualificationStatus: StayEliteQualificationStatus.POLICY_BLOCKED } }),
    prisma.travelAchievement.groupBy({ by: ["definitionStatus", "isActive"], _count: { _all: true } }),
    prisma.achievementAward.count({ where: { awardedAt } }),
    prisma.referralReward.groupBy({ by: ["status"], where: { createdAt }, _count: { _all: true } }),
    prisma.achievementAward.groupBy({ by: ["achievementId"], where: { awardedAt }, _count: { _all: true }, orderBy: { _count: { achievementId: "desc" } }, take: 10 }),
  ]);
  const definitionsById = topAwardRows.length ? await prisma.travelAchievement.findMany({ where: { id: { in: topAwardRows.map((row) => row.achievementId) } }, select: { id: true, name: true, category: true } }) : [];
  const definitionMap = new Map(definitionsById.map((definition) => [definition.id, definition]));
  return { range: { from: input.from ?? null, to: input.to ?? null, timezone: "UTC" }, metrics: LOYALTY_METRIC_CATALOG, membershipDistribution: memberships, tierTransitions: transitions, policyBlockedEvaluations: blockedEvaluations, achievementDefinitions: definitions, achievementAwards: awards, topAchievements: topAwardRows.map((row) => ({ count: row._count._all, achievement: definitionMap.get(row.achievementId) ?? null })), referralReviews: referrals, unavailable: { points: LOYALTY_CAPABILITY_BLOCKERS.points, rewards: LOYALTY_CAPABILITY_BLOCKERS.rewards, campaigns: LOYALTY_CAPABILITY_BLOCKERS.campaigns } };
}
