"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { CloseButton } from "@/components/ui/close-button";
import { ReceiptModal } from "@/components/dashboard/trip-modals";
import type { ListingDTO } from "@/services/mappers";
import { resolvePropertyCurrency } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import {
  differenceInBookingNights,
  formatBookingDate,
} from "@/lib/booking/booking-date";
import { getAuthoritativePriceBreakdown } from "@/lib/booking/booking-price";
import { formatTime12h } from "@/lib/booking/booking-time";

type HostPriceBreakdown = {
  nightlySubtotal?: number;
  discountAmount?: number;
  extraGuestFee?: number;
  petFee?: number;
  cleaningFee?: number;
  hostServiceFeePercentage?: number;
  hostServiceFee?: number;
  taxTotal?: number;
  guestTotal?: number;
  rateType?: string;
  paymentMode?: string;
  paymentStatus?: string;
  cancellationPolicySnapshot?: string;
  cancellation?: {
    cancelledBy?: string;
    reason?: string | null;
    guestRefundAmount?: number;
  };
  breakdown?: Array<{ price?: number }>;
  taxes?: Array<{
    taxName?: string;
    taxAmount?: number;
    exemptionApplied?: boolean;
    exemptionReason?: string;
  }>;
  automaticDiscount?: { label?: string } | null;
  selectedDiscount?: { label?: string } | null;
  appliedDiscount?: { name?: string } | null;
  nonRefundable?: { amount?: number } | null;
  nonRefundableDiscount?: { amount?: number } | null;
  payoutBreakdown?: {
    accommodationSubtotal?: number;
    extraGuestFee?: number;
    petFee?: number;
    cleaningFee?: number;
    taxesCollectedForHost?: number;
    taxesRemittedByPlatform?: number;
    platformServiceFee?: number;
    hostServiceFee?: number;
    netHostPayout?: number;
  };
};

export type HostReservation = {
  id: string;
  listingId: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  guestName: string;
  guestId?: string;
  guestImage: string | null;
  guestEmail?: string | null;
  guestCreatedAt?: string | null;
  conversationId?: string | null;
  guests?: number;
  totalPrice?: number | null;
  nightlyPrice?: number | null;
  cleaningFee?: number | null;
  currency?: string;
  priceBreakdown?: HostPriceBreakdown;
  cancellationPolicy?: string | null;
  isNonRefundable?: boolean;
  listing?: {
    id: string;
    title: string;
    city: string;
    district: string | null;
    country: string;
    photos: string[];
    checkInStart?: string | null;
    checkInEnd?: string | null;
    checkOutTime?: string | null;
    price?: number;
  };
};
export type HostWorkspaceProps = {
  listings: ListingDTO[];
  bookings: HostReservation[];
};
export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const shortDate = (date: string) =>
  formatBookingDate(date, { locale: "en-GB" });

export function PropertyPhoto({
  listing,
  className = "",
}: {
  listing: ListingDTO;
  className?: string;
}) {
  // Uploaded property images may come from any configured storage provider.
  return listing.photos[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={listing.photos[0]}
      alt={listing.title}
      className={`object-cover ${className}`}
    />
  ) : (
    <span
      className={`flex items-center justify-center bg-zinc-100 text-[#727272] ${className}`}
      aria-label="No property photo"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8" />
      </svg>
    </span>
  );
}

export function WorkspaceDialog({
  title,
  children,
  onClose,
  dark = false,
  maxWidth = "max-w-md",
  variant = "default",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dark?: boolean;
  maxWidth?: string;
  variant?: "default" | "listing-filter" | "reservation-details";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab" || !node) return;
      const elements = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === node)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === node)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    node?.addEventListener("keydown", handleKey);
    return () => {
      node?.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return (
    <ModalOverlay
      className={`fixed inset-0 z-[100] flex ${dark ? "items-end sm:items-center" : variant === "listing-filter" || variant === "reservation-details" ? "items-stretch sm:items-center" : "items-center"} justify-center ${variant === "listing-filter" ? "bg-black/10 p-0 sm:p-6" : variant === "reservation-details" ? "bg-black/30 p-0 backdrop-blur-xs sm:p-4" : "bg-black/30 p-4 backdrop-blur-xs"}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${variant === "listing-filter" ? "h-dvh max-h-dvh rounded-none p-5 shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:rounded-[28px] sm:p-6" : variant === "reservation-details" ? "flex h-dvh max-h-dvh flex-col overflow-hidden rounded-none shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:rounded-3xl" : "max-h-[88dvh] overflow-y-auto overscroll-contain rounded-2xl p-6 shadow-2xl"} w-full min-w-0 ${maxWidth} outline-none ${dark ? "bg-[#1F1F1F] text-white" : "bg-white text-[#1F1F1F]"}`}
      >
        <div
          className={`flex items-center justify-between gap-3 border-b ${variant === "listing-filter" ? "mb-3 border-[#D7D7D7] pb-2 sm:mb-4 sm:pb-4" : variant === "reservation-details" ? "z-10 shrink-0 border-zinc-200 bg-white px-5 py-4 sm:px-6 sm:py-5 dark:border-white/10 dark:bg-[#1F1F1F]" : "mb-5 border-zinc-100 pb-4 dark:border-white/10"}`}
        >
          <h2
            id={titleId}
            className={
              variant === "listing-filter"
                ? "text-lg font-normal leading-7 sm:font-medium"
                : "text-lg font-semibold tracking-tight"
            }
          >
            {title}
          </h2>
          <CloseButton
            onClick={onClose}
            className={dark ? "text-white hover:bg-white/10" : ""}
          />
        </div>
        {variant === "reservation-details" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </ModalOverlay>
  );
}

export function ReservationDetails({
  booking,
  listing,
  onClose,
  onMoney,
}: {
  booking: HostReservation;
  listing: ListingDTO;
  onClose: () => void;
  onMoney?: () => void;
}) {
  const { formatPrice } = useCurrency();
  const [showInvoice, setShowInvoice] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const sourceCurrency =
    booking.currency || resolvePropertyCurrency(listing);
  const pb = booking.priceBreakdown;
  const pricing = getAuthoritativePriceBreakdown({
    startDate: booking.startDate,
    endDate: booking.endDate,
    totalPrice: booking.totalPrice,
    nightlyPrice: booking.nightlyPrice,
    cleaningFee: booking.cleaningFee,
    currency: sourceCurrency,
    priceBreakdown: pb,
    cancellationPolicy: booking.cancellationPolicy,
    isNonRefundable: booking.isNonRefundable,
  });
  const nights = pricing.nights;
  const guestCount = booking.guests || 1;
  const hasVaryingRates =
    new Set(pricing.nightlyBreakdown?.map((night) => night.rate) ?? []).size >
    1;
  const hasNonRefundableDiscount =
    booking.isNonRefundable || pb?.rateType === "NON_REFUNDABLE";
  const discountLabel =
    pricing.automaticDiscount?.label ??
    (hasNonRefundableDiscount ? "Non-refundable discount" : "Discount");
  const cancellationPolicyLabel = hasNonRefundableDiscount
    ? "Non-refundable"
    : pricing.cancellationPolicySnapshot || booking.cancellationPolicy || listing.cancellationPolicy || "Flexible";
  const taxItemsMatchTotal =
    pricing.taxes.reduce((sum, tax) => sum + tax.amountMinorUnits, 0) ===
    pricing.taxTotal;
  const status = booking.status.toUpperCase();
  const statusClasses =
    status === "CONFIRMED"
      ? {
          dot: "bg-emerald-500",
          text: "text-emerald-700 dark:text-emerald-400",
        }
      : status === "PENDING"
        ? { dot: "bg-amber-500", text: "text-amber-800 dark:text-amber-300" }
        : status === "CANCELLED"
          ? { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" }
          : { dot: "bg-zinc-500", text: "text-zinc-700 dark:text-zinc-300" };
  const payout = pb?.payoutBreakdown;
  const payoutAccommodation = payout?.accommodationSubtotal ?? 0;
  const payoutPetFee = payout?.petFee ?? 0;
  const payoutCleaningFee = payout?.cleaningFee ?? pricing.cleaningFee;
  const payoutHostTax = payout?.taxesCollectedForHost ?? 0;
  const payoutServiceFee =
    payout?.platformServiceFee ?? payout?.hostServiceFee ?? 0;
  const payoutTotal = payout?.netHostPayout;
  const payoutKnownTotal =
    payoutAccommodation +
    payoutPetFee +
    payoutCleaningFee +
    pricing.extraGuestFee +
    payoutHostTax -
    payoutServiceFee;
  const payoutAdjustment =
    typeof payoutTotal === "number" ? payoutTotal - payoutKnownTotal : 0;

  const hostServiceFeeAmount =
    pb?.hostServiceFee ??
    pb?.payoutBreakdown?.platformServiceFee ??
    pb?.payoutBreakdown?.hostServiceFee ??
    0;
  const isPlatformServiceFee =
    pricing.otherCharges > 0 &&
    (hostServiceFeeAmount === pricing.otherCharges ||
      Math.abs(hostServiceFeeAmount - pricing.otherCharges) <= 1);
  const otherChargeLabel = isPlatformServiceFee
    ? typeof pb?.hostServiceFeePercentage === "number"
      ? `Platform service fee (${pb.hostServiceFeePercentage}%)`
      : "Platform service fee"
    : pricing.otherCharges > 0
      ? "Service fee"
      : "Pricing adjustment";

  const confirmationCode = booking.id.slice(-8).toUpperCase();
  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(confirmationCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const messageHref = booking.conversationId
    ? `/host/messages?id=${encodeURIComponent(booking.conversationId)}`
    : "/host/messages";

  return (
    <>
      {!showInvoice && (
        <WorkspaceDialog
          title="Reservation details"
          onClose={onClose}
          maxWidth="max-w-[580px]"
          variant="reservation-details"
        >
          <div className="space-y-6 text-sm">
            {/* 1. Reservation Summary Card with Distinct Property & Guest Identity */}
            <section
              aria-labelledby="reservation-summary-heading"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 dark:border-zinc-700 dark:bg-zinc-800/80"
            >
              <h3 id="reservation-summary-heading" className="sr-only">
                Reservation summary
              </h3>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${statusClasses.dot}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${statusClasses.text}`}
                  >
                    {status.replaceAll("_", " ")}
                  </span>
                </div>
                <span className="text-xs text-[#727272] font-mono">
                  #{confirmationCode}
                </span>
              </div>

              {/* Cancellation Notice Banner */}
              {(booking.status === "CANCELLED" || pb?.cancellation) && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  <p className="font-semibold text-rose-900 dark:text-rose-100 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-rose-600 inline-block" />
                    Reservation Cancelled
                  </p>
                  <div className="mt-2 space-y-1 text-[11px] text-rose-900/90 dark:text-rose-200/90">
                    <p>
                      Cancelled by:{" "}
                      <span className="font-medium capitalize">
                        {String(pb?.cancellation?.cancelledBy || "Guest").toLowerCase()}
                      </span>
                    </p>
                    {pb?.cancellation?.reason && (
                      <p>Reason: {String(pb.cancellation.reason)}</p>
                    )}
                    {typeof pb?.cancellation?.guestRefundAmount === "number" && (
                      <p>
                        Guest refund: {formatPrice(pb.cancellation.guestRefundAmount, sourceCurrency, 2)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Property Details */}
              <div className="flex items-start gap-3.5 sm:gap-4">
                <PropertyPhoto
                  listing={listing}
                  className="size-20 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#727272]">
                    Property
                  </p>
                  <Link
                    href={`/host/listings/${listing.id}`}
                    className="mt-0.5 block truncate text-base font-semibold text-[#1F1F1F] underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    {listing.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-[#727272]">
                    {[listing.district, listing.city, listing.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>

              {/* Explicit Guest & Dates Context */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200/80 pt-3 text-xs dark:border-zinc-700/80">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#727272]">
                    Guest
                  </p>
                  <p className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {booking.guestName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#727272]">
                    Dates
                  </p>
                  <p className="mt-0.5 font-medium text-zinc-800 dark:text-zinc-200">
                    {shortDate(booking.startDate)} – {shortDate(booking.endDate)}
                  </p>
                  <p className="text-[11px] text-[#727272]">
                    {nights} {nights === 1 ? "night" : "nights"} · {guestCount}{" "}
                    {guestCount === 1 ? "guest" : "guests"}
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Guest Information Section */}
            <section aria-labelledby="guest-heading">
              <h3
                id="guest-heading"
                className="mb-3 text-sm font-semibold text-[#1F1F1F] dark:text-zinc-100"
              >
                Guest
              </h3>
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                {booking.guestImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={booking.guestImage}
                    alt={booking.guestName}
                    className="size-12 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  >
                    {booking.guestName[0]?.toUpperCase() || "G"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {booking.guestName}
                  </p>
                  {booking.guestEmail && (
                    <p className="truncate text-xs text-[#727272]">
                      {booking.guestEmail}
                    </p>
                  )}
                  {booking.guestCreatedAt && (
                    <p className="mt-1 text-xs text-[#727272]">
                      Member since{" "}
                      {new Date(booking.guestCreatedAt).getUTCFullYear()}
                    </p>
                  )}
                </div>
                {booking.guestId && (
                  <Link
                    href={`/profile/${booking.guestId}`}
                    className="shrink-0 text-xs font-semibold text-[#1F1F1F] underline underline-offset-2 hover:text-black dark:text-zinc-100"
                  >
                    View profile
                  </Link>
                )}
              </div>
            </section>

            {/* 3. Primary & Secondary Actions */}
            <div
              className={
                onMoney && status === "CONFIRMED"
                  ? "grid gap-3 sm:grid-cols-2"
                  : "grid"
              }
            >
              {onMoney && status === "CONFIRMED" && (
                <button
                  type="button"
                  onClick={onMoney}
                  className="min-h-11 w-full rounded-full border border-zinc-900 px-4 py-3 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Send or request money
                </button>
              )}
              <Link
                href={messageHref}
                className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#1F1F1F] px-4 py-3 text-center text-xs font-semibold text-white transition-colors hover:bg-black dark:bg-zinc-100 dark:text-[#1F1F1F] dark:hover:bg-white"
              >
                Message guest
              </Link>
            </div>

            {/* 4. Stay Details */}
            <section aria-labelledby="stay-details-heading">
              <h3
                id="stay-details-heading"
                className="mb-3 text-sm font-semibold text-[#1F1F1F] dark:text-zinc-100"
              >
                Stay details
              </h3>
              <dl className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
                <DetailRow
                  label="Guests"
                  value={`${guestCount} ${guestCount === 1 ? "guest" : "guests"}`}
                />
                <DetailRow
                  label="Check-in"
                  value={`${shortDate(booking.startDate)} · ${formatTime12h(listing.checkInStart, "3:00 PM")}`}
                />
                <DetailRow
                  label="Check-out"
                  value={`${shortDate(booking.endDate)} · ${formatTime12h(listing.checkOutTime, "11:00 AM")}`}
                />
                <DetailRow
                  label="Length of stay"
                  value={`${nights} ${nights === 1 ? "night" : "nights"}`}
                />
                <DetailRow
                  label="Booking date"
                  value={shortDate(booking.createdAt)}
                />
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-[#727272]">Confirmation code</dt>
                  <dd className="flex items-center gap-2">
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {confirmationCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
                      title="Copy confirmation code"
                    >
                      {codeCopied ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Copied!
                        </span>
                      ) : (
                        <span>Copy</span>
                      )}
                    </button>
                  </dd>
                </div>
                {cancellationPolicyLabel && (
                  <DetailRow
                    label="Cancellation policy"
                    value={cancellationPolicyLabel
                      .replaceAll("_", " ")
                      .toLowerCase()}
                    capitalize
                  />
                )}
              </dl>
              <Link
                href="/host/calendar"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1F1F1F] underline underline-offset-2 hover:text-black dark:text-zinc-100"
              >
                View in calendar →
              </Link>
            </section>

            {/* 5. Guest Paid (Authoritative Pricing Breakdown) */}
            <section
              aria-labelledby="guest-paid-heading"
              className="border-t border-zinc-200 pt-5 dark:border-zinc-800"
            >
              <h3
                id="guest-paid-heading"
                className="mb-3 text-sm font-semibold text-[#1F1F1F] dark:text-zinc-100"
              >
                Guest paid
              </h3>
              <dl className="space-y-2 text-xs">
                <PriceRow
                  label={
                    hasVaryingRates
                      ? `${nights} nights · varying rates`
                      : `${formatPrice(pricing.nightlyPrice, sourceCurrency, 2)} × ${nights} ${nights === 1 ? "night" : "nights"}`
                  }
                  value={formatPrice(
                    pricing.nightlySubtotal,
                    sourceCurrency,
                    2,
                  )}
                />
                {pricing.discountAmount > 0 && (
                  <PriceRow
                    label={discountLabel}
                    value={`− ${formatPrice(pricing.discountAmount, sourceCurrency, 2)}`}
                    tone="discount"
                  />
                )}
                {pricing.extraGuestFee > 0 && (
                  <PriceRow
                    label="Extra guest fee"
                    value={formatPrice(
                      pricing.extraGuestFee,
                      sourceCurrency,
                      2,
                    )}
                  />
                )}
                {pricing.petFee > 0 && (
                  <PriceRow
                    label="Pet fee"
                    value={formatPrice(pricing.petFee, sourceCurrency, 2)}
                  />
                )}
                {pricing.cleaningFee > 0 && (
                  <PriceRow
                    label="Cleaning fee"
                    value={formatPrice(pricing.cleaningFee, sourceCurrency, 2)}
                  />
                )}
                {pricing.taxTotal > 0 && taxItemsMatchTotal ? (
                  pricing.taxes.map((tax, index) => (
                    <PriceRow
                      key={`${tax.name}-${index}`}
                      label={`${tax.name}${tax.exemptionApplied && tax.exemptionReason ? ` · ${tax.exemptionReason}` : ""}`}
                      value={formatPrice(
                        tax.amountMinorUnits,
                        sourceCurrency,
                        2,
                      )}
                    />
                  ))
                ) : pricing.taxTotal > 0 ? (
                  <PriceRow
                    label="Taxes"
                    value={formatPrice(pricing.taxTotal, sourceCurrency, 2)}
                  />
                ) : null}
                {pricing.otherCharges !== 0 && (
                  <PriceRow
                    label={otherChargeLabel}
                    value={
                      pricing.otherCharges > 0
                        ? formatPrice(pricing.otherCharges, sourceCurrency, 2)
                        : `− ${formatPrice(Math.abs(pricing.otherCharges), sourceCurrency, 2)}`
                    }
                  />
                )}
                <div className="flex justify-between gap-4 border-t border-zinc-100 pt-2 text-sm font-semibold dark:border-zinc-800">
                  <dt>Total paid by guest ({sourceCurrency})</dt>
                  <dd>{formatPrice(pricing.totalPrice, sourceCurrency, 2)}</dd>
                </div>
              </dl>
            </section>

            {/* 6. Host Payout */}
            {payout && typeof payoutTotal === "number" && (
              <section
                aria-labelledby="host-payout-heading"
                className="border-t border-zinc-200 pt-5 dark:border-zinc-800"
              >
                <h3
                  id="host-payout-heading"
                  className="mb-3 text-sm font-semibold text-[#1F1F1F] dark:text-zinc-100"
                >
                  Your payout
                </h3>
                <dl className="space-y-2 text-xs">
                  <PriceRow
                    label="Accommodation amount"
                    value={formatPrice(payoutAccommodation, sourceCurrency, 2)}
                  />
                  {pricing.extraGuestFee > 0 && (
                    <PriceRow
                      label="Extra guest fee"
                      value={formatPrice(
                        pricing.extraGuestFee,
                        sourceCurrency,
                        2,
                      )}
                    />
                  )}
                {payoutPetFee > 0 && (
                    <PriceRow
                      label="Pet fee"
                      value={formatPrice(payoutPetFee, sourceCurrency, 2)}
                    />
                )}
                {payoutCleaningFee > 0 && (
                  <PriceRow
                    label="Cleaning fee"
                    value={formatPrice(payoutCleaningFee, sourceCurrency, 2)}
                  />
                )}
                  {payoutHostTax > 0 && (
                    <PriceRow
                      label="Taxes collected for host"
                      value={formatPrice(payoutHostTax, sourceCurrency, 2)}
                    />
                  )}
                  {payoutServiceFee > 0 && (
                    <PriceRow
                      label={
                        typeof pb?.hostServiceFeePercentage === "number"
                          ? `Platform service fee (${pb.hostServiceFeePercentage}%)`
                          : "Platform service fee"
                      }
                      value={`− ${formatPrice(payoutServiceFee, sourceCurrency, 2)}`}
                      tone="fee"
                    />
                  )}
                  {payoutAdjustment !== 0 && (
                    <PriceRow
                      label="Payout adjustment"
                      value={
                        payoutAdjustment > 0
                          ? formatPrice(payoutAdjustment, sourceCurrency, 2)
                          : `− ${formatPrice(Math.abs(payoutAdjustment), sourceCurrency, 2)}`
                      }
                    />
                  )}
                  <div className="flex justify-between gap-4 border-t border-zinc-100 pt-2 text-sm font-semibold dark:border-zinc-800">
                    <dt>Total host payout ({sourceCurrency})</dt>
                    <dd className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {formatPrice(payoutTotal, sourceCurrency, 2)}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            {/* 7. Documents & Payment Records */}
            <section
              aria-label="Documents and payment details"
              className="border-t border-zinc-200 pt-4 text-xs dark:border-zinc-800 space-y-2.5"
            >
              {pricing.taxTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-zinc-200 p-3 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                >
                  <span className="font-medium">View VAT invoice</span>
                  <span aria-hidden="true" className="text-base text-zinc-400">›</span>
                </button>
              )}

              {/* Payment Details Summary */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/50 text-xs">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                  Payment record
                </p>
                <div className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>Payment mode</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200 capitalize">
                      {pb?.paymentMode?.toLowerCase() || "Standard"}
                    </span>
                  </div>
                  {pb?.paymentStatus && (
                    <div className="flex justify-between">
                      <span>Payment status</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 capitalize">
                        {pb.paymentStatus.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Booking reference</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                      {confirmationCode}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </WorkspaceDialog>
      )}
      <ReceiptModal
        bookingId={booking.id}
        isOpen={showInvoice}
        onClose={() => setShowInvoice(false)}
      />
    </>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[#727272]">{label}</dt>
      <dd
        className={`text-right font-medium text-zinc-800 dark:text-zinc-200 ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function PriceRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "discount" | "fee";
}) {
  const toneClass =
    tone === "discount"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "fee"
        ? "text-rose-600 dark:text-rose-400"
        : "text-zinc-800 dark:text-zinc-200";
  return (
    <div className="flex justify-between gap-4">
      <dt className={tone === "default" ? "text-[#727272]" : toneClass}>
        {label}
      </dt>
      <dd className={`shrink-0 ${toneClass}`}>{value}</dd>
    </div>
  );
}

export function MoneyDialog({
  booking,
  onClose,
}: {
  booking: HostReservation;
  onClose: () => void;
}) {
  const nights = Math.max(
    1,
    differenceInBookingNights(booking.startDate, booking.endDate),
  );

  return (
    <WorkspaceDialog
      title="Send or request money"
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="space-y-5 text-sm">
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/80 p-4 border border-zinc-100 dark:border-zinc-700">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#727272]">
            From
          </p>
          <p className="my-1 font-bold text-base text-[#1F1F1F] dark:text-zinc-100">
            {booking.guestName}
          </p>
          <p className="text-xs text-[#727272] dark:text-[#727272]">
            {shortDate(booking.startDate)} – {shortDate(booking.endDate)} (
            {nights} {nights === 1 ? "night" : "nights"}) •{" "}
            {booking.guests || 1}{" "}
            {(booking.guests || 1) === 1 ? "guest" : "guests"}
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold text-[#1F1F1F] dark:text-zinc-100 text-sm">
            What would you like to do?
          </legend>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
            <input
              type="radio"
              name="money-action"
              defaultChecked
              className="size-4 accent-[#1F1F1F] dark:accent-amber-400"
            />
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Send money
            </span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
            <input
              type="radio"
              name="money-action"
              className="size-4 accent-[#1F1F1F] dark:accent-amber-400"
            />
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Request money
            </span>
          </label>
        </fieldset>

        <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-300 leading-relaxed border border-amber-200/60 dark:border-amber-900/60">
          Payments are securely handled via Homyz escrow. You can also contact
          your guest directly through Messages.
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-zinc-600 dark:text-[#727272] hover:text-[#1F1F1F] dark:hover:text-zinc-100 underline"
          >
            Cancel
          </button>
          <a
            href="/host/messages"
            className="rounded-full bg-[#1F1F1F] dark:bg-zinc-100 px-6 py-2.5 text-xs font-semibold text-white dark:text-[#1F1F1F] hover:bg-black dark:hover:bg-white transition-colors"
          >
            Next
          </a>
        </div>
      </div>
    </WorkspaceDialog>
  );
}
