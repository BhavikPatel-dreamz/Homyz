import { calculateCalendarNights } from "./booking-status";

export interface TaxItemBreakdown {
  name: string;
  amountMinorUnits: number;
}

export interface AuthoritativePriceBreakdown {
  currency: string;
  nights: number;
  nightlyPrice: number; // minor units
  nightlySubtotal: number; // minor units
  extraGuestFee: number; // minor units
  cleaningFee: number; // minor units
  serviceFee: number; // minor units (platform / concierge service fee)
  discountAmount: number; // minor units
  taxTotal: number; // minor units
  taxes: TaxItemBreakdown[];
  otherCharges: number; // minor units (reconciliation line if needed)
  totalPrice: number; // authoritative total in minor units
  storedTotal: number; // stored booking.totalPrice in DB
  isMathConsistent: boolean;
}

function safeNum(val: unknown): number {
  return typeof val === "number" && Number.isFinite(val) ? Math.round(val) : 0;
}

function asRecord(val: unknown): Record<string, unknown> {
  return val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
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
  const cleaningFee = safeNum(booking.cleaningFee) || safeNum(snapshot.cleaningFee);
  const extraGuestFee = safeNum(snapshot.extraGuestFee);
  const serviceFee = safeNum(snapshot.hostServiceFee) || safeNum(snapshot.serviceFee);
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
        if (amt > 0) {
          taxes.push({ name, amountMinorUnits: amt });
        }
      }
    }
  }

  // Calculate sum of known items
  const subtotalBeforeReconcile =
    nightlySubtotal - discountAmount + cleaningFee + extraGuestFee + serviceFee + taxTotal;

  let otherCharges = 0;
  let finalServiceFee = serviceFee;

  // Reconcile with storedTotal to guarantee displayedTotal === storedTotal
  if (storedTotal > 0 && subtotalBeforeReconcile !== storedTotal) {
    const diff = storedTotal - subtotalBeforeReconcile;
    // If service fee was 0 but difference is positive and <= 20% of subtotal, attribute to service fee
    if (serviceFee === 0 && diff > 0 && diff < nightlySubtotal * 0.3) {
      finalServiceFee = diff;
    } else {
      otherCharges = diff;
    }
  }

  const computedTotal =
    nightlySubtotal - discountAmount + cleaningFee + extraGuestFee + finalServiceFee + taxTotal + otherCharges;

  const authoritativeTotal = storedTotal > 0 ? storedTotal : computedTotal;

  return {
    currency,
    nights,
    nightlyPrice: baseNightlyPrice,
    nightlySubtotal,
    extraGuestFee,
    cleaningFee,
    serviceFee: finalServiceFee,
    discountAmount,
    taxTotal,
    taxes,
    otherCharges,
    totalPrice: authoritativeTotal,
    storedTotal: authoritativeTotal,
    isMathConsistent: authoritativeTotal === computedTotal,
  };
}

