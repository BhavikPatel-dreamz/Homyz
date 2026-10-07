"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { HostBookingRequestDetails } from "@/services/booking.service";
import { BookingStatusTimeline } from "@/components/bookings/booking-status-timeline";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { formatExpiryCountdown } from "@/lib/booking/booking-expiry";
import { differenceInBookingNights, formatBookingDate } from "@/lib/booking/booking-date";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";

interface HostBookingDetailsClientProps {
  details: HostBookingRequestDetails;
}

export function HostBookingDetailsClient({ details }: HostBookingDetailsClientProps) {
  const { t } = useLanguage();
  const { currency: displayCurrency, formatPrice } = useCurrency();
  const formatMoney = (amount: number | null | undefined, sourceCurrency = "SAR") =>
    formatPrice(typeof amount === "number" ? amount : 0, sourceCurrency, 2);
  const router = useRouter();
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isPending = details.status === "PENDING";
  const isExpired = details.isExpired;
  const canAct = isPending && !isExpired;

  const countdown = isPending
    ? formatExpiryCountdown(new Date(details.expiresAt))
    : null;

  const nights = Math.max(1, differenceInBookingNights(details.startDate, details.endDate));

  async function handleAccept() {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/host/bookings/${details.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to accept booking request");
      }
      setIsAcceptModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to accept booking request");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDecline() {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/host/bookings/${details.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to decline booking request");
      }
      setIsDeclineModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to decline booking request");
    } finally {
      setIsSubmitting(false);
    }
  }

  const breakdown = details.priceBreakdown && typeof details.priceBreakdown === "object"
    ? details.priceBreakdown
    : {};

  const nightlySubtotal = breakdown.nightlySubtotal ?? (details.nightlyPrice ? details.nightlyPrice * nights : 0);
  const nightlyRates = Array.isArray(breakdown.breakdown) ? breakdown.breakdown : [];
  const hasVaryingRates = new Set(nightlyRates.map((night: { price?: number }) => night.price)).size > 1;
  const discountAmount = breakdown.discountAmount ?? 0;
  const extraGuestFee = breakdown.extraGuestFee ?? 0;
  const petFee = breakdown.petFee ?? 0;
  const taxTotal = breakdown.taxTotal ?? 0;
  const taxItems = Array.isArray(breakdown.taxes) ? breakdown.taxes : [];
  const totalPrice = details.totalPrice ?? breakdown.guestTotal ?? breakdown.totalPrice ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl pb-20 pt-6 text-[#1F1F1F]">
      {/* Back button */}
      <Link
        href="/host/bookings"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-700 underline underline-offset-4 hover:text-zinc-900 transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{t("host_booking_details_back", "Back to reservations")}</span>
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("host_booking_details_res_num", "Reservation #{id}").replace("{id}", details.id.slice(-8).toUpperCase())}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#1F1F1F]">
            {details.listing.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {[details.listing.city, details.listing.country].filter(Boolean).join(", ")}
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {details.status === "CONFIRMED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-sm font-semibold text-emerald-800 border border-emerald-200 shadow-2xs">
              <span className="size-2 rounded-full bg-emerald-500" />
              {t("host_booking_details_status_confirmed", "Confirmed")}
            </span>
          ) : isExpired ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1 text-sm font-semibold text-slate-700 border border-slate-300 shadow-2xs">
              <span className="size-2 rounded-full bg-slate-400" />
              {t("host_booking_details_status_expired", "Expired")}
            </span>
          ) : details.status === "CANCELLED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1 text-sm font-semibold text-rose-800 border border-rose-200 shadow-2xs">
              <span className="size-2 rounded-full bg-rose-500" />
              {t("host_booking_details_status_cancelled", "Declined / Cancelled")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1 text-sm font-semibold text-amber-900 border border-amber-200 shadow-2xs">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              {t("host_booking_details_status_pending", "Pending confirmation")}
            </span>
          )}
        </div>
      </div>

      {/* Contextual Status Banner */}
      {isPending && !isExpired && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-amber-950 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {t("host_booking_details_deadline_banner_title", "Response deadline: {time}").replace("{time}", countdown?.text || "")}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-amber-900 leading-relaxed">
                {t("host_booking_details_deadline_banner_desc", "Accept or decline this request before the 24-hour window expires. Calendar dates are currently held for this guest.")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeclineModalOpen(true)}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                {t("host_booking_details_decline", "Decline")}
              </button>
              <button
                type="button"
                onClick={() => setIsAcceptModalOpen(true)}
                className="rounded-full bg-[#FCDF9C] px-5 py-2 text-xs font-semibold text-zinc-900 hover:bg-amber-400 transition-colors shadow-2xs cursor-pointer"
              >
                {t("host_booking_details_accept", "Accept request")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-5 text-slate-800 shadow-2xs">
          <h2 className="text-base font-semibold">{t("host_booking_details_expired_banner_title", "Response deadline expired")}</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t("host_booking_details_expired_banner_desc", "This booking request was not confirmed within the 24-hour response window. It has expired and dates have been released back to your calendar.")}
          </p>
        </div>
      )}

      {details.status === "CONFIRMED" && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-emerald-950 shadow-2xs">
          <h2 className="text-base font-semibold">{t("host_booking_details_confirmed_banner_title", "Reservation confirmed")}</h2>
          <p className="mt-1 text-xs sm:text-sm text-emerald-900 leading-relaxed">
            {t("host_booking_details_confirmed_banner_desc", "You confirmed this booking request. Calendar dates are booked. Payment is pending/deferred.")}
          </p>
        </div>
      )}

      {/* Main Grid: Content (Left) & Sidebar (Right) */}
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Guest Profile Card */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
              {t("host_booking_details_guest_details", "Guest details")}
            </h3>
            <div className="flex items-center gap-4">
              <div className="relative size-16 shrink-0 rounded-full overflow-hidden bg-zinc-200 border border-zinc-200">
                {details.guest.image ? (
                  <Image
                    src={details.guest.image}
                    alt={details.guest.name || "Guest"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center text-xl font-bold bg-amber-100 text-amber-900">
                    {(details.guest.name || "G").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-zinc-900 truncate">
                  {details.guest.name || "Guest"}
                </h4>
                {details.guest.email && (
                  <p className="text-xs text-zinc-500 truncate">{details.guest.email}</p>
                )}
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t("host_booking_details_member_since", "Member since {year}").replace("{year}", String(new Date(details.guest.createdAt).getFullYear()))}
                </p>
              </div>

              {details.conversationId && (
                <Link
                  href={`/host/messages?id=${details.conversationId}`}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap"
                >
                  {t("host_booking_details_message_guest", "Message guest")}
                </Link>
              )}
            </div>

            {/* Guest Initial Message */}
            {details.guestMessage && (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold text-zinc-600 mb-1">{t("host_booking_details_guest_msg_heading", "Message from guest:")}</p>
                <p className="text-sm text-zinc-800 italic leading-relaxed">
                  &ldquo;{details.guestMessage}&rdquo;
                </p>
              </div>
            )}
          </section>

          {/* Status Timeline */}
          {details.timeline && details.timeline.length > 0 && (
            <BookingStatusTimeline events={details.timeline} />
          )}

          {/* Trip Dates & Guests Info */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
              {t("host_booking_details_stay_details", "Stay details")}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3.5">
                <span className="text-xs text-zinc-500 font-medium">{t("host_booking_details_checkin", "Check-in")}</span>
                <p className="mt-1 text-sm font-bold text-zinc-900">
                  {formatBookingDate(details.startDate, { weekday: true })}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3.5">
                <span className="text-xs text-zinc-500 font-medium">{t("host_booking_details_checkout", "Check-out")}</span>
                <p className="mt-1 text-sm font-bold text-zinc-900">
                  {formatBookingDate(details.endDate, { weekday: true })}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3.5">
                <span className="text-xs text-zinc-500 font-medium">{t("host_booking_details_guests", "Guests")}</span>
                <p className="mt-1 text-sm font-bold text-zinc-900">
                  {details.guests} {details.guests === 1 ? t("booking_details_guest_singular", "guest") : t("booking_details_guests_plural", "guests")} · {nights} {nights === 1 ? t("host_booking_details_unit_night", "night") : t("host_booking_details_unit_nights", "nights")}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Pricing & CTAs */}
        <div>
          <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
            <h3 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-3">
              {t("host_booking_details_payout_pricing", "Payout & pricing breakdown")}
            </h3>

            <dl className="mt-4 space-y-3 text-sm text-zinc-700">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">
                  {hasVaryingRates
                    ? `${t("host_booking_details_accommodation", "Accommodation")} · ${nights} ${nights === 1 ? t("host_booking_details_unit_night", "night") : t("host_booking_details_unit_nights", "nights")} (varying rates)`
                    : `${formatMoney(nightlyRates[0]?.price ?? details.nightlyPrice ?? 0, details.currency)} × ${nights} ${nights === 1 ? t("host_booking_details_unit_night", "night") : t("host_booking_details_unit_nights", "nights")}`}
                </dt>
                <dd className="font-medium text-zinc-900">
                  {formatMoney(nightlySubtotal, details.currency)}
                </dd>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-emerald-700">{t("host_booking_details_discount", "Discount")}</dt>
                  <dd className="font-medium text-emerald-700">−{formatMoney(discountAmount, details.currency)}</dd>
                </div>
              )}

              {extraGuestFee > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">{t("host_booking_details_extra_guest_fee", "Extra guest fee")}</dt>
                  <dd className="font-medium text-zinc-900">
                    {formatMoney(extraGuestFee, details.currency)}
                  </dd>
                </div>
              )}

              {petFee > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">{t("host_booking_details_pet_fee", "Pet fee")}</dt>
                  <dd className="font-medium text-zinc-900">{formatMoney(petFee, details.currency)}</dd>
                </div>
              )}

              {taxItems.map((tax: { taxName?: string; taxAmount?: number; exemptionApplied?: boolean; exemptionReason?: string }, index: number) => (
                <div key={`${tax.taxName || "Tax"}-${index}`} className="flex justify-between gap-4">
                  <dt className="text-zinc-600">
                    {tax.taxName || t("host_booking_details_taxes", "Tax")}
                    {tax.exemptionApplied && tax.exemptionReason ? ` · ${tax.exemptionReason}` : ""}
                  </dt>
                  <dd className="font-medium text-zinc-900">{formatMoney(tax.taxAmount ?? 0, details.currency)}</dd>
                </div>
              ))}
              {taxItems.length === 0 && taxTotal > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-600">{t("host_booking_details_taxes", "Taxes")}</dt>
                  <dd className="font-medium text-zinc-900">{formatMoney(taxTotal, details.currency)}</dd>
                </div>
              )}

              <div className="flex justify-between gap-4 border-t border-zinc-200 pt-4 text-base font-bold text-zinc-900">
                <dt>{t("host_booking_details_total", "Total ({currency})").replace("{currency}", displayCurrency)}</dt>
                <dd className="text-lg text-emerald-800 font-extrabold">
                  {formatMoney(totalPrice, details.currency)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                <dt className="font-medium">{t("host_booking_details_payment_status", "Payment status")}</dt>
                <dd className="font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  {t("host_booking_details_deferred", "Pending / Deferred")}
                </dd>
              </div>
            </dl>

            {/* Action Buttons */}
            <div className="mt-6 space-y-3 border-t border-zinc-100 pt-5">
              {canAct ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAcceptModalOpen(true)}
                    className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#FCDF9C] hover:bg-amber-400 text-zinc-900 font-bold text-sm transition-colors shadow-2xs cursor-pointer"
                  >
                    {t("host_booking_details_accept", "Accept request")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeclineModalOpen(true)}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-semibold text-sm transition-colors cursor-pointer"
                  >
                    {t("host_booking_details_confirm_decline", "Decline request")}
                  </button>
                </>
              ) : isExpired ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center text-xs font-medium text-slate-600">
                  {t("host_booking_details_expired_banner_title", "This request has expired and can no longer be accepted.")}
                </div>
              ) : details.status === "CONFIRMED" ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-semibold text-emerald-800">
                  ✓ {t("host_booking_details_status_confirmed", "Booking confirmed")}
                </div>
              ) : null}

              {details.conversationId && (
                <Link
                  href={`/host/messages?id=${details.conversationId}`}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium text-xs transition-colors"
                >
                  {t("host_booking_details_open_conversation", "Open conversation with guest")}
                </Link>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ACCEPT MODAL with ModalOverlay */}
      {isAcceptModalOpen && (
        <ModalOverlay>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl text-[#1F1F1F]">
            <h3 className="text-xl font-bold text-zinc-900">{t("host_booking_details_accept_modal_title", "Accept booking request?")}</h3>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              {t("host_booking_details_accept_modal_desc", "Confirming this request will permanently book your property for {name} from {start} to {end}.")
                .replace("{name}", details.guest.name || "the guest")
                .replace("{start}", formatBookingDate(details.startDate, { weekday: true }))
                .replace("{end}", formatBookingDate(details.endDate, { weekday: true }))}
            </p>

            {actionError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAcceptModalOpen(false)}
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                {t("host_cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleAccept}
                className="rounded-full bg-[#FCDF9C] hover:bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-900 transition-colors shadow-2xs disabled:opacity-50"
              >
                {isSubmitting ? t("host_booking_details_confirming", "Confirming...") : t("host_booking_details_confirm_accept", "Confirm & Accept")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* DECLINE MODAL with ModalOverlay */}
      {isDeclineModalOpen && (
        <ModalOverlay>
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl text-[#1F1F1F]">
            <h3 className="text-xl font-bold text-zinc-900">{t("host_booking_details_decline_modal_title", "Decline booking request?")}</h3>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              {t("host_booking_details_decline_modal_desc", "Declining will immediately release the held calendar dates back to other guests.")}
            </p>

            <div className="mt-4">
              <label htmlFor="decline-reason" className="block text-xs font-semibold text-zinc-700 mb-1">
                {t("host_booking_details_decline_reason_label", "Reason for declining (optional note to guest):")}
              </label>
              <textarea
                id="decline-reason"
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder={t("host_booking_details_decline_reason_ph", "e.g. Property is undergoing maintenance on these dates.")}
                className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
              />
            </div>

            {actionError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsDeclineModalOpen(false)}
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                {t("host_back", "Back")}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDecline}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-6 py-2.5 text-sm font-bold text-white transition-colors shadow-2xs disabled:opacity-50"
              >
                {isSubmitting ? t("host_booking_details_declining", "Declining...") : t("host_booking_details_confirm_decline", "Decline request")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
