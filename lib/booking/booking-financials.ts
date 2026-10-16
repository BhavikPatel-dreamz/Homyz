/**
 * Financial values in this module are stored minor currency units. They are
 * readers for immutable booking snapshots, never a second pricing engine.
 */

export type StoredHostPayout = {
  accommodationSubtotal: number;
  extraGuestFee: number;
  petFee: number;
  cleaningFee: number;
  hostServiceFee: number;
  taxesCollectedForHost: number;
  netHostPayout: number;
  currency: string | null;
};

type BookingFinancialRecord = {
  cleaningFee?: number | null;
  currency?: string | null;
  totalPrice?: number | null;
  priceBreakdown?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function minorUnits(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Reads the host payout that was saved when the booking was created.
 *
 * A legacy booking without `payoutBreakdown.netHostPayout` deliberately
 * returns null: a guest's total is never a safe substitute for host earnings.
 */
export function extractStoredHostPayout(booking: BookingFinancialRecord): StoredHostPayout | null {
  const snapshot = asRecord(booking.priceBreakdown);
  const payout = asRecord(snapshot?.payoutBreakdown);
  const netHostPayout = minorUnits(payout?.netHostPayout);

  if (netHostPayout === null) return null;

  return {
    accommodationSubtotal: minorUnits(payout?.accommodationSubtotal) ?? 0,
    extraGuestFee: minorUnits(payout?.extraGuestFee) ?? 0,
    petFee: minorUnits(payout?.petFee) ?? 0,
    cleaningFee: minorUnits(payout?.cleaningFee) ?? minorUnits(booking.cleaningFee) ?? 0,
    hostServiceFee:
      minorUnits(payout?.hostServiceFee) ?? minorUnits(payout?.platformServiceFee) ?? 0,
    taxesCollectedForHost: minorUnits(payout?.taxesCollectedForHost) ?? 0,
    netHostPayout,
    currency:
      typeof payout?.currency === "string"
        ? payout.currency
        : typeof booking.currency === "string"
          ? booking.currency
          : null,
  };
}

/**
 * Reads the guest-facing total captured with the booking. The JSON snapshot is
 * preferred; the booking column is its persisted legacy counterpart and is
 * only used for older snapshots that predate `guestTotal`.
 */
export function extractStoredGuestTotal(booking: BookingFinancialRecord): number | null {
  const snapshot = asRecord(booking.priceBreakdown);
  return minorUnits(snapshot?.guestTotal)
    ?? minorUnits(snapshot?.total)
    ?? minorUnits(snapshot?.totalPrice)
    ?? minorUnits(booking.totalPrice);
}

/**
 * Returns whether the immutable payment snapshot proves the reservation is
 * eligible for payout reporting. Older records without a payment field retain
 * their prior status-based behaviour; an explicit pending/failed/refunded
 * payment is never treated as earned money.
 */
export function isStoredBookingPayoutEligible(booking: Pick<BookingFinancialRecord, "priceBreakdown">): boolean {
  const snapshot = asRecord(booking.priceBreakdown);
  const paymentStatus = typeof snapshot?.paymentStatus === "string"
    ? snapshot.paymentStatus.trim().toUpperCase()
    : null;

  if (!paymentStatus) return true;
  return paymentStatus === "PAID"
    || paymentStatus === "CAPTURED"
    || paymentStatus === "SETTLED"
    || paymentStatus === "PAYMENT_COMPLETED";
}

/**
 * Returns the explicitly recorded refund amount from a cancellation snapshot.
 * This application has no settlement/refund ledger, so this is intentionally
 * not presented as proof that a payment provider transfer has completed.
 */
export function extractRecordedCancellationRefund(booking: Pick<BookingFinancialRecord, "priceBreakdown">): number | null {
  const snapshot = asRecord(booking.priceBreakdown);
  const cancellation = asRecord(snapshot?.cancellation);
  return minorUnits(cancellation?.guestRefundAmount);
}
