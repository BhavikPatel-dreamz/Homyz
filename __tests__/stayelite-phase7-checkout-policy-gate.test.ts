import assert from "node:assert/strict";
import test from "node:test";
import { StayEliteTierCode } from "@/generated/prisma/enums";
import { evaluateStayEliteCheckoutEligibility } from "@/lib/stayelite/checkout-eligibility";

test("Phase 7 never changes a quote total while financial policy is blocked", () => {
  const ambassador = evaluateStayEliteCheckoutEligibility({ currentTier: StayEliteTierCode.AMBASSADOR, membershipActive: true, nights: 3 });
  const icon = evaluateStayEliteCheckoutEligibility({ currentTier: StayEliteTierCode.ICON, membershipActive: true, nights: 14 });
  assert.deepEqual(ambassador.tierDiscount, { percentage: 5, amount: 0, status: "POLICY_BLOCKED", reason: "DEC-010: discount base, stacking, funding, tax and refund policy are not approved." });
  assert.equal(icon.tierDiscount.percentage, 10);
  assert.equal(icon.tierDiscount.amount, 0);
  assert.equal(icon.freeNight.qualifyingNights, true);
  assert.equal(icon.freeNight.status, "POLICY_BLOCKED");
});

test("inactive memberships and short stays cannot surface an active benefit", () => {
  const inactive = evaluateStayEliteCheckoutEligibility({ currentTier: StayEliteTierCode.ICON, membershipActive: false, nights: 3 });
  assert.equal(inactive.tier, null);
  assert.equal(inactive.tierDiscount.status, "UNAVAILABLE");
  assert.equal(inactive.freeNight.qualifyingNights, false);
});
