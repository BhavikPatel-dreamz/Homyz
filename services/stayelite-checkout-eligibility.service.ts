import { StayEliteMembershipStatus, StayEliteTierCode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export const STAYELITE_CHECKOUT_POLICY_VERSION = "stayelite-checkout-v1";

export type StayEliteCheckoutEligibility = {
  policyVersion: string;
  tier: StayEliteTierCode | null;
  tierDiscount: { percentage: number; amount: 0; status: "UNAVAILABLE" | "POLICY_BLOCKED"; reason: string };
  freeNight: { status: "UNAVAILABLE" | "POLICY_BLOCKED"; qualifyingNights: boolean; reason: string };
  operationalBenefits: { upgrade: "POLICY_BLOCKED"; lateCheckout: "POLICY_BLOCKED" };
};

/**
 * Phase 7 boundary: it may expose safe eligibility information, but never
 * changes the authoritative quote until DEC-010/011 and Phase 6 redemption
 * prerequisites are explicitly approved.
 */
export function evaluateStayEliteCheckoutEligibility(input: {
  currentTier: StayEliteTierCode | null;
  membershipActive: boolean;
  nights: number;
}): StayEliteCheckoutEligibility {
  const tier = input.membershipActive ? input.currentTier : null;
  const discount = tier === StayEliteTierCode.ICON ? 10 : tier === StayEliteTierCode.AMBASSADOR ? 5 : 0;
  return {
    policyVersion: STAYELITE_CHECKOUT_POLICY_VERSION,
    tier,
    tierDiscount: discount
      ? { percentage: discount, amount: 0, status: "POLICY_BLOCKED", reason: "DEC-010: discount base, stacking, funding, tax and refund policy are not approved." }
      : { percentage: 0, amount: 0, status: "UNAVAILABLE", reason: "No active Ambassador or Icon membership." },
    freeNight: tier === StayEliteTierCode.ICON
      ? { status: "POLICY_BLOCKED", qualifyingNights: input.nights >= 14, reason: "DEC-011: free-night fulfillment, funding, taxes and cancellation policy are not approved." }
      : { status: "UNAVAILABLE", qualifyingNights: input.nights >= 14, reason: "No active Icon membership." },
    operationalBenefits: { upgrade: "POLICY_BLOCKED", lateCheckout: "POLICY_BLOCKED" },
  };
}

export async function getStayEliteCheckoutEligibility(userId: string, nights: number) {
  const membership = await prisma.stayEliteMembership.findUnique({
    where: { userId }, select: { currentTier: true, status: true },
  });
  return evaluateStayEliteCheckoutEligibility({
    currentTier: membership?.currentTier ?? null,
    membershipActive: membership?.status === StayEliteMembershipStatus.ACTIVE,
    nights,
  });
}
