"use client";

import React, { useState, useEffect } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { useRouter } from "next/navigation";
import { bookingDateKey, compareBookingDates } from "@/lib/booking/booking-date";
import { useLanguage } from "@/lib/i18n/language-context";

interface ChangeReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  currentStartDate: Date | string;
  currentEndDate: Date | string;
  currentGuests: number;
  maxGuests: number;
  currency: string;
  currentTotalPrice: number; // minor units
  propertyName: string;
}

export function ChangeReservationModal({
  isOpen,
  onClose,
  bookingId,
  currentStartDate,
  currentEndDate,
  currentGuests,
  maxGuests,
  currency,
  currentTotalPrice,
  propertyName,
}: ChangeReservationModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [startDate, setStartDate] = useState(bookingDateKey(currentStartDate));
  const [endDate, setEndDate] = useState(bookingDateKey(currentEndDate));
  const [guests, setGuests] = useState(currentGuests);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<{
    available: boolean;
    reason?: string;
    oldTotal: number;
    newTotal: number;
    difference: number;
    newNights: number;
  } | null>(null);

  // Tomorrow as minimum check-in date
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setStartDate(bookingDateKey(currentStartDate));
      setEndDate(bookingDateKey(currentEndDate));
      setGuests(currentGuests);
      setPreviewData(null);
      setPreviewError(null);
      setSubmitError(null);
    }
  }, [isOpen, currentStartDate, currentEndDate, currentGuests]);

  // Fetch preview when dates or guests change
  useEffect(() => {
    if (!isOpen) return;

    if (!startDate || !endDate) return;
    if (compareBookingDates(endDate, startDate) <= 0) {
      setPreviewError(t("booking_details_checkout_after_checkin", "Check-out date must be after check-in date."));
      setPreviewData(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      setPreviewError(null);

      try {
        const res = await fetch(`/api/v1/bookings/${bookingId}/change-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate, guests }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = json?.error?.message || (typeof json?.error === "string" ? json.error : null) || t("booking_details_unable_check_avail", "Unable to check availability.");
          throw new Error(msg);
        }

        const data = json.data !== undefined ? json.data : json;
        if (!isMounted) return;

        if (!data.available) {
          setPreviewError(data.reason || t("booking_details_dates_unavailable", "The selected dates are unavailable."));
          setPreviewData(null);
        } else {
          setPreviewData(data);
          setPreviewError(null);
        }
      } catch (err) {
        if (!isMounted) return;
        setPreviewError(err instanceof Error ? err.message : t("booking_details_failed_quote", "Failed to calculate quote."));
        setPreviewData(null);
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, bookingId, startDate, endDate, guests, t]);

  const handleSubmit = async () => {
    if (submitting || !previewData?.available) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/v1/bookings/${bookingId}/change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, guests }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message || (typeof json?.error === "string" ? json.error : null) || t("booking_details_failed_update", "Failed to update reservation.");
        throw new Error(msg);
      }

      onClose();
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("booking_details_failed_update", "Failed to update reservation."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasChanges =
    startDate !== bookingDateKey(currentStartDate) ||
    endDate !== bookingDateKey(currentEndDate) ||
    guests !== currentGuests;

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-modal-title"
        className="relative my-8 w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl transition-all"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close dialog"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#1f1f1f] hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 id="change-modal-title" className="text-xl font-semibold text-[#1F1F1F]">
              {t("booking_details_change_reservation", "Change reservation")}
            </h2>
            <p className="text-xs text-[#727272] line-clamp-1">{propertyName}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="change-checkin" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                {t("booking_details_check_in", "Check-in")}
              </label>
              <input
                id="change-checkin"
                type="date"
                min={tomorrowStr}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
                className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-[#1F1F1F] shadow-2xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label htmlFor="change-checkout" className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                {t("booking_details_check_out", "Check-out")}
              </label>
              <input
                id="change-checkout"
                type="date"
                min={startDate || tomorrowStr}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
                className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm font-medium text-[#1F1F1F] shadow-2xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                {t("booking_details_guests", "Guests")}
              </label>
              <span className="text-xs text-[#727272]">
                {t("booking_details_max_guests_label", { count: maxGuests }, "Max {count} guests")}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-zinc-300 bg-white px-4 py-2.5">
              <span className="text-sm font-medium text-[#1F1F1F]">
                {guests} {guests === 1 ? t("booking_details_guest_singular", "guest") : t("booking_details_guests_plural", "guests")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  disabled={submitting || guests <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                  aria-label="Decrease guests"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
                  disabled={submitting || guests >= maxGuests}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                  aria-label="Increase guests"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Comparison Preview */}
        <div className="mt-6 sm:rounded-2xl rounded-lg shadow-md bg-white p-4">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-4 text-xs text-[#727272] gap-2">
              <svg className="h-4 w-4 animate-spin text-[#727272]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{t("booking_details_checking_quote", "Checking availability and recalculating pricing...")}</span>
            </div>
          ) : previewError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {previewError}
            </div>
          ) : previewData ? (
            <dl className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-zinc-600">
                <dt>{t("booking_details_current_total", "Current reservation total")}</dt>
                <dd>
                  <CurrencyPrice amountMinorUnits={currentTotalPrice} sourceCurrency={currency} fractionDigits={2} />
                </dd>
              </div>
              <div className="flex justify-between font-semibold text-[#1F1F1F] border-t border-zinc-200/80 pt-2">
                <dt>
                  {t("booking_details_new_total", {
                    count: previewData.newNights,
                    nights: previewData.newNights === 1 ? t("booking_details_night_singular", "night") : t("booking_details_nights_plural", "nights"),
                  }, "New total ({count} {nights})")}
                </dt>
                <dd>
                  <CurrencyPrice amountMinorUnits={previewData.newTotal} sourceCurrency={currency} fractionDigits={2} />
                </dd>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <dt>
                  {previewData.difference > 0
                    ? t("booking_details_add_payment", "Additional payment required")
                    : previewData.difference < 0
                      ? t("booking_details_refund_due", "Refund due")
                      : t("booking_details_price_adjust", "Price adjustment")}
                </dt>
                <dd className={previewData.difference > 0 ? "text-amber-700" : previewData.difference < 0 ? "text-emerald-700" : "text-zinc-700"}>
                  {previewData.difference > 0 ? "+" : previewData.difference < 0 ? "-" : ""}
                  <CurrencyPrice amountMinorUnits={Math.abs(previewData.difference)} sourceCurrency={currency} fractionDigits={2} />
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-center text-xs text-[#727272] py-2">
              {t("booking_details_change_instructions", "Select your new dates and guest count above to see availability and price updates.")}
            </p>
          )}
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {submitError}
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-11 items-center justify-center rounded-full border border-[#1F1F1F] px-5 text-sm font-medium text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white disabled:opacity-50"
          >
            {t("booking_details_cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !hasChanges || !previewData?.available}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#FCDF9C] px-6 text-sm font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] disabled:bg-zinc-300 disabled:text-[#727272] disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
          >
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{t("booking_details_updating_reservation", "Updating reservation...")}</span>
              </>
            ) : (
              <span>{t("booking_details_confirm_changes", "Confirm changes")}</span>
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
