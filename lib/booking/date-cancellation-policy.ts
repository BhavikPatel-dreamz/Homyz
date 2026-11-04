import { bookingDateKey, type BookingDateInput } from "@/lib/booking/booking-date";
import { REFUND_POLICY_REGISTRY } from "@/lib/refund/policy-engine";

export const DATE_SCOPED_CANCELLATION_POLICIES = ["FLEXIBLE", "MODERATE", "FIRM"] as const;
export type DateScopedCancellationPolicy = (typeof DATE_SCOPED_CANCELLATION_POLICIES)[number];

const supportedPolicies = new Set<string>(DATE_SCOPED_CANCELLATION_POLICIES);

export const dateScopedCancellationPolicyOptions = DATE_SCOPED_CANCELLATION_POLICIES.map((policyId) =>
  REFUND_POLICY_REGISTRY[`${policyId}:v1`],
).filter((policy) => policy?.category === "SHORT_TERM" && policy.isApproved && policy.milestones.length > 0);

export function getCancellationPolicyForCheckIn(
  listing: { cancellationPolicy?: string | null; discounts?: unknown },
  checkIn: BookingDateInput,
): string {
  const dateKey = bookingDateKey(checkIn);
  const discounts = listing.discounts && typeof listing.discounts === "object" && !Array.isArray(listing.discounts)
    ? listing.discounts as Record<string, unknown>
    : {};
  const overrides = discounts.customCancellationPolicies && typeof discounts.customCancellationPolicies === "object" && !Array.isArray(discounts.customCancellationPolicies)
    ? discounts.customCancellationPolicies as Record<string, unknown>
    : {};
  const override = overrides[dateKey];

  return typeof override === "string" && supportedPolicies.has(override)
    ? override
    : listing.cancellationPolicy || "FLEXIBLE";
}

export function getCancellationPolicyForStay(
  listing: {
    cancellationPolicy?: string | null;
    longTermCancellationPolicy?: string | null;
    discounts?: unknown;
  },
  checkIn: BookingDateInput,
  nights: number,
): string {
  return nights >= 28
    ? listing.longTermCancellationPolicy || "FIRM"
    : getCancellationPolicyForCheckIn(listing, checkIn);
}