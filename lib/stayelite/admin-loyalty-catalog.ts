import { STAYELITE_TIER_DEFINITIONS } from "@/services/stayelite-tier.service";
import { QUALITY_BEHAVIOR_DEFINITIONS } from "@/services/stayelite-quality-behavior.service";

/** Read-only benefit metadata. It deliberately has no redemption or pricing side effect. */
export function buildAdminBenefitCatalog() {
  return [
    ...STAYELITE_TIER_DEFINITIONS.flatMap((tier) => tier.benefits.map((benefit) => ({
      id: `tier:${tier.code}:${benefit.key}`, sourceType: "TIER" as const, sourceKey: tier.code,
      name: benefit.key, eligibility: tier.qualification, active: benefit.active,
      fulfillment: benefit.key === "VIP_PROFILE" ? "PROFILE_ENTITLEMENT" : "POLICY_BLOCKED",
      policyBlocker: "reason" in benefit ? benefit.reason ?? null : null,
    }))),
    ...QUALITY_BEHAVIOR_DEFINITIONS.filter((definition) => definition.inactiveBenefit).map((definition) => ({
      id: `achievement:${definition.key}`, sourceType: "ACHIEVEMENT" as const, sourceKey: definition.key,
      name: definition.inactiveBenefit!, eligibility: { threshold: definition.threshold, rule: definition.key }, active: false,
      fulfillment: "POLICY_BLOCKED", policyBlocker: definition.blockers.join(", ") || "FULFILLMENT_NOT_IMPLEMENTED",
    })),
  ];
}

export const LOYALTY_CAPABILITY_BLOCKERS = {
  points: "No authoritative Phase 6 points-account or append-only ledger model/service is present.",
  rewards: "No reward-catalog, redemption, or fulfillment-handler model/service is present.",
  campaigns: "No durable campaign model, scheduler, or approved promotion handler is present.",
} as const;
