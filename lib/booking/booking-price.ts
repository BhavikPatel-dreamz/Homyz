import { calculateCalendarNights } from "./booking-status";

export interface TaxItemBreakdown {
  name: string;
  amountMinorUnits: number;
  exemptionApplied: boolean;
  exemptionReason?: string;
}

export interface AuthoritativePriceBreakdown {
  currency: string;
  nights: number;
  nightlyPrice: number; // minor units
  nightlySubtotal: number; // minor units
  extraGuestFee: number; // minor units
  petFee: number; // minor units
  discountAmount: number; // minor units
  taxTotal: number; // minor units
  taxes: TaxItemBreakdown[];
  otherCharges: number; // minor units (reconciliation line if needed)
  totalPrice: number; // authoritative total in minor units
  storedTotal: number; // stored booking.totalPrice in DB
  isMathConsistent: boolean;
  pricingSnapshotVersion?: string;
  pricingSnapshotRevision?: number;
  rateType?: string;
  isNonRefundable?: boolean;
  accommodationSubtotal?: number;
  discountedAccommodationSubtotal?: number;
  automaticDiscount?: { type: string; label?: string; percentage?: number; amount: number } | null;
  cancellationPolicySnapshot?: string | null;
  nightlyBreakdown?: Array<{ date: string; rate: number; rateType?: string }>;
}

function safeNum(val: unknown): number {
  return typeof val === "number" && Number.isFinite(val) ? Math.round(val) : 0;
}

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
}

/** Splits an integer monetary total across nights without losing minor units. */
export function allocateNightlyTotal(totalMinorUnits: number, nights: number): number[] {
  const normalizedTotal = Math.max(0, Math.round(totalMinorUnits));
  const normalizedNights = Math.max(1, Math.floor(nights));
  const base = Math.floor(normalizedTotal / normalizedNights);
  const remainder = normalizedTotal - base * normalizedNights;

  return Array.from(
    { length: normalizedNights },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

/**
 * Extracts and reconstructs the single authoritative price breakdown
 * from the stored booking record and quote snapshot.
 * Guarantees that the sum of line items strictly equals the stored total price.
 */
export function getAuthoritativePriceBreakdown(booking: {
  nightlyPrice?: number | null;
  cleaningFee?: number | null;
  totalPrice?: number | null;
  currency?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  priceBreakdown?: unknown;
  cancellationPolicy?: string | null;
  isNonRefundable?: boolean;
}): AuthoritativePriceBreakdown {
  const snapshot = asRecord(booking.priceBreakdown);
  const currency = booking.currency || (typeof snapshot.currency === "string" ? snapshot.currency : "SAR");
  const nights = Math.max(1, calculateCalendarNights(booking.startDate, booking.endDate));

  // Stored / payment total
  const storedTotal =
    safeNum(booking.totalPrice) ||
    safeNum(snapshot.guestTotal) ||
    safeNum(snapshot.totalPrice);

  // Nightly base price and subtotal
  const baseNightlyPrice =
    safeNum(booking.nightlyPrice) ||
    safeNum(snapshot.baseNightlyPrice) ||
    (nights > 0 && storedTotal > 0 ? Math.round(storedTotal / nights) : 0);

  const snapshotNightlySubtotal = safeNum(snapshot.nightlySubtotal);
  const nightlySubtotal = snapshotNightlySubtotal > 0 ? snapshotNightlySubtotal : baseNightlyPrice * nights;

  // Additional charges
  const extraGuestFee = safeNum(snapshot.extraGuestFee);
  const petFee = safeNum(snapshot.petFee);
  const discountAmount = safeNum(snapshot.discountAmount) || safeNum(snapshot.nonRefundableDiscount);

  // Taxes
  const taxTotal = safeNum(snapshot.taxTotal);
  const taxes: TaxItemBreakdown[] = [];
  if (Array.isArray(snapshot.taxes)) {
    for (const item of snapshot.taxes) {
      if (item && typeof item === "object") {
        const taxRec = item as Record<string, unknown>;
        const name = typeof taxRec.taxName === "string" ? taxRec.taxName : "Tax";
        const amt = safeNum(taxRec.taxAmount);
        const exemptionApplied = taxRec.exemptionApplied === true || taxRec.isExempt === true;
        const exemptionReason = typeof taxRec.exemptionReason === "string" ? taxRec.exemptionReason : undefined;
        taxes.push({ name, amountMinorUnits: amt, exemptionApplied, exemptionReason });
      }
    }
  }

  // Calculate sum of known items
  const subtotalBeforeReconcile =
    nightlySubtotal - discountAmount + extraGuestFee + petFee + taxTotal;

  let otherCharges = 0;

  // Reconcile legacy snapshots with storedTotal without reintroducing removed
  // cleaning/service-fee labels. Historical payment totals remain immutable.
  if (storedTotal > 0 && subtotalBeforeReconcile !== storedTotal) {
    otherCharges = storedTotal - subtotalBeforeReconcile;
  }

  const computedTotal =
    nightlySubtotal - discountAmount + extraGuestFee + petFee + taxTotal + otherCharges;

  const authoritativeTotal = storedTotal > 0 ? storedTotal : computedTotal;

  const nightlyBreakdown = Array.isArray(snapshot.nightlyBreakdown)
    ? (snapshot.nightlyBreakdown as Array<{ date: string; rate: number; rateType?: string }>)
    : Array.isArray(snapshot.breakdown)
      ? (snapshot.breakdown as Array<{ date: string; price: number; rateSource?: string }>).map((b) => ({
          date: b.date,
          rate: b.price,
          rateType: b.rateSource,
        }))
      : undefined;

  const accommodationSubtotal = safeNum(snapshot.accommodationSubtotal) || (nightlySubtotal - discountAmount);
  const discountedAccommodationSubtotal = safeNum(snapshot.discountedAccommodationSubtotal) || accommodationSubtotal;

  const automaticDiscount = snapshot.automaticDiscount && typeof snapshot.automaticDiscount === "object"
    ? (snapshot.automaticDiscount as { type: string; label?: string; percentage?: number; amount: number })
    : snapshot.selectedDiscount && typeof snapshot.selectedDiscount === "object"
      ? (snapshot.selectedDiscount as { type: string; label?: string; percentage?: number; amount: number })
      : snapshot.appliedDiscount && typeof snapshot.appliedDiscount === "object"
        ? (() => {
            const appliedDiscount = snapshot.appliedDiscount as Record<string, unknown>;
            return {
              type: typeof appliedDiscount.key === "string" ? appliedDiscount.key : "DISCOUNT",
              label: typeof appliedDiscount.name === "string" ? appliedDiscount.name : undefined,
              percentage: typeof appliedDiscount.percentage === "number" ? appliedDiscount.percentage : undefined,
              amount: safeNum(appliedDiscount.amount),
            };
          })()
        : null;

  const rateType = typeof snapshot.rateType === "string" ? snapshot.rateType : undefined;
  const isNonRefundable = Boolean(snapshot.isNonRefundable || booking.isNonRefundable);
  const pricingSnapshotVersion = typeof snapshot.pricingSnapshotVersion === "string" ? snapshot.pricingSnapshotVersion : undefined;
  const pricingSnapshotRevision = typeof snapshot.pricingSnapshotRevision === "number"
    ? snapshot.pricingSnapshotRevision
    : undefined;
  const cancellationPolicySnapshot = typeof snapshot.cancellationPolicySnapshot === "string"
    ? snapshot.cancellationPolicySnapshot
    : typeof booking.cancellationPolicy === "string"
      ? booking.cancellationPolicy
      : typeof snapshot.cancellationPolicy === "string"
        ? snapshot.cancellationPolicy
        : null;

  return {
    currency,
    nights,
    nightlyPrice: baseNightlyPrice,
    nightlySubtotal,
    extraGuestFee,
    petFee,
    discountAmount,
    taxTotal,
    taxes,
    otherCharges,
    totalPrice: authoritativeTotal,
    storedTotal: authoritativeTotal,
    isMathConsistent: authoritativeTotal === computedTotal,
    pricingSnapshotVersion,
    pricingSnapshotRevision,
    rateType,
    isNonRefundable,
    accommodationSubtotal,
    discountedAccommodationSubtotal,
    automaticDiscount,
    cancellationPolicySnapshot,
    nightlyBreakdown,
  };
}
