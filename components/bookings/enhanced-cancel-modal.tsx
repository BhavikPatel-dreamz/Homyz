"use client";

import React, { useState, useEffect } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { useRouter } from "next/navigation";

interface EnhancedCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  propertyName: string;
  location: string;
  cancellationPolicy: string;
  isNonRefundable: boolean;
  totalPaid: number; // minor units
  currency: string;
  onCancelled?: () => void;
}

export function EnhancedCancelModal({
  isOpen,
  onClose,
  bookingId,
  propertyName,
  location,
  cancellationPolicy,
  isNonRefundable,
  totalPaid,
  currency,
  onCancelled,
}: EnhancedCancelModalProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate policy-based refund expectations
  const policyUpper = (cancellationPolicy || "FLEXIBLE").toUpperCase();
  const isZeroRefund = isNonRefundable || policyUpper === "NON_REFUNDABLE";

  // If flexible, full refund of stay total before check-in cutoff
  const expectedRefund = isZeroRefund ? 0 : totalPaid;
  const nonRefundableAmount = totalPaid - expectedRefund;

  const handleConfirmCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          json?.error?.message ||
          (typeof json?.error === "string" ? json.error : null) ||
          "Failed to cancel reservation.";
        throw new Error(msg);
      }

      if (onCancelled) onCancelled();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="relative my-8 w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl transition-all"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close dialog"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 id="cancel-title" className="text-xl font-semibold text-[#1F1F1F]">
              Cancel reservation?
            </h2>
            <p className="text-xs text-zinc-500">
              Reference #{bookingId.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="font-semibold text-sm text-[#1F1F1F] line-clamp-1">{propertyName}</h3>
          {location && <p className="text-xs text-zinc-600 mt-0.5">{location}</p>}
        </div>

        {/* Cancellation policy & Refund Breakdown */}
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Cancellation Policy & Terms
            </h4>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              {isNonRefundable
                ? "Non-refundable Rate"
                : `${cancellationPolicy.charAt(0).toUpperCase() + cancellationPolicy.slice(1).toLowerCase()} Policy`}
            </p>
            <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
              {isNonRefundable
                ? "This booking was booked under a non-refundable discount rate. No refund is granted for guest cancellations."
                : `Under the ${cancellationPolicy.toLowerCase()} cancellation policy, cancelling before check-in qualifies for a full refund of your reservation total.`}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Refund Summary
            </h4>
            <dl className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-zinc-600">
                <dt>Total paid</dt>
                <dd>
                  <CurrencyPrice amountMinorUnits={totalPaid} sourceCurrency={currency} fractionDigits={2} />
                </dd>
              </div>
              {nonRefundableAmount > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <dt>Non-refundable fees</dt>
                  <dd className="text-red-700">
                    -<CurrencyPrice amountMinorUnits={nonRefundableAmount} sourceCurrency={currency} fractionDigits={2} />
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold text-zinc-900">
                <dt>Expected refund</dt>
                <dd className={expectedRefund > 0 ? "text-emerald-700" : "text-zinc-700"}>
                  <CurrencyPrice amountMinorUnits={expectedRefund} sourceCurrency={currency} fractionDigits={2} />
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            By confirming cancellation, your dates will be immediately released to other guests and this reservation will be closed.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            Keep reservation
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-white shadow-xs hover:bg-red-700 disabled:bg-red-300 cursor-pointer"
          >
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Cancelling...</span>
              </>
            ) : (
              <span>Confirm cancellation</span>
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

