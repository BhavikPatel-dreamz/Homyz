export const LOYALTY_METRIC_CATALOG = [
  { key: "membership_current", name: "Current memberships", source: "StayEliteMembership.currentTier", timeField: "current state", exact: true, limitation: "Not a historical membership snapshot." },
  { key: "tier_transitions", name: "Tier transitions", source: "StayEliteTierHistory.occurredAt", timeField: "occurredAt UTC", exact: true, limitation: "Includes only recorded history." },
  { key: "achievement_awards", name: "Achievement awards", source: "AchievementAward.awardedAt/status", timeField: "awardedAt UTC", exact: true, limitation: "Automatic awards are currently disabled." },
  { key: "policy_blocked_evaluations", name: "Policy-blocked tier evaluations", source: "StayEliteTierEvaluation.evaluatedAt", timeField: "evaluatedAt UTC", exact: true, limitation: "Reflects evaluator policy blockers, not delivery failures." },
  { key: "referral_reviews", name: "Referral review states", source: "ReferralReward.createdAt/status", timeField: "createdAt UTC", exact: true, limitation: "Approved referral rewards are not points-ledger credits." },
] as const;
