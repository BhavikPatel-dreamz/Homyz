"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import {
  formatCheckoutDateRange,
  formatCheckoutGuests,
  getCheckoutPriceRows,
  type CheckoutPriceRow,
  type CheckoutSummaryQuote,
} from "@/lib/booking/checkout-summary";

type BookingSummaryState = {
  property: {
    title: string;
    imageUrl: string | null;
    rating: number | null;
    reviewsCount: number;
    isGuestFavorite: boolean;
  };
  stay: {
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    infants: number;
    pets: number;
  };
  pricing: {
    status: "loading" | "success" | "error";
    quote: CheckoutSummaryQuote | null;
    error: string | null;
  };
  displayCurrency: string;
};

type BookingSummaryActions = {
  formatMoney: (amount: number, fractionDigits?: number) => string;
  onChangeDates: () => void;
  onChangeGuests: () => void;
  onRetryPricing: () => void;
  onOpenPolicy: () => void;
};

type BookingSummaryProps = {
  state: BookingSummaryState;
  actions: BookingSummaryActions;
  isBreakdownOpen: boolean;
  onBreakdownOpenChange: (open: boolean) => void;
  cancellationCutoff: string;
};

function SummaryImage({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-[10px] border border-zinc-100 bg-zinc-100 shadow-2xs sm:rounded-2xl">
      {src && !failed ? (
        <Image
          src={src}
          alt={title}
          fill
          sizes="(min-width: 1280px) 507px, (min-width: 1024px) 42vw, 100vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-sm font-medium text-zinc-500" role="img" aria-label={`${title} image unavailable`}>
          Image unavailable
        </div>
      )}
    </div>
  );
}

function PriceRows({
  rows,
  formatMoney,
}: {
  rows: CheckoutPriceRow[];
  formatMoney: BookingSummaryActions["formatMoney"];
}) {
  const { currency: displayCurrency } = useCurrency();
  return (
    <dl className="space-y-2.5">
      {rows.map((row) => {
        const label = row.unitPrice !== undefined && row.units !== undefined
          ? `${formatMoney(row.unitPrice)} × ${row.units} ${row.units === 1 ? "night" : "nights"}`
          : row.label;
        return (
          <div key={row.id} className="flex items-start justify-between gap-4 text-sm text-[#727272]">
            <dt>{label}</dt>
            <dd className="shrink-0 font-medium text-zinc-900">
              {row.subtract ? "−" : ""}{formatMoney(row.amount, 2)}
            </dd>
          </div>
        );
      })}
      <div className="sr-only">Price currency: {displayCurrency}</div>
    </dl>
  );
}

export const BookingSummary = memo(function BookingSummary({ state, actions, isBreakdownOpen, onBreakdownOpenChange, cancellationCutoff }: BookingSummaryProps) {
  const breakdownTriggerRef = useRef<HTMLButtonElement>(null);
  const breakdownCloseRef = useRef<HTMLButtonElement>(null);
  const { property, stay, pricing, displayCurrency } = state;
  const summaryRows = pricing.quote ? getCheckoutPriceRows(pricing.quote) : [];
  const breakdownRows = pricing.quote ? getCheckoutPriceRows(pricing.quote, { itemizeTaxes: true }) : [];
  const reviewLabel = `${property.reviewsCount} ${property.reviewsCount === 1 ? "review" : "reviews"}`;

  useEffect(() => {
    if (!isBreakdownOpen) return;
    window.requestAnimationFrame(() => breakdownCloseRef.current?.focus());
  }, [isBreakdownOpen]);

  const closeBreakdown = () => {
    onBreakdownOpenChange(false);
    window.requestAnimationFrame(() => breakdownTriggerRef.current?.focus());
  };

  return (
    <>
      <aside aria-label="Booking summary" className="rounded-[10px] border border-zinc-200 bg-white p-6 shadow-[0px_2px_4px_0px_#00000040,2px_0px_4px_0px_#00000040] sm:rounded-[30px] sm:p-8 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
        <section aria-labelledby="booking-summary-property">
          <h2 id="booking-summary-property" className="text-xl font-medium text-[#1f1f1f]">{property.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#1f1f1f]">
            {property.rating !== null && property.reviewsCount > 0 ? (
              <span className="inline-flex items-center gap-1.5" aria-label={`${property.rating.toFixed(2)} out of 5, ${reviewLabel}`}>
                <Image src="/images/icons/star-fill.svg" alt="" aria-hidden="true" width={18} height={18} />
                {property.rating.toFixed(2)} · {reviewLabel}
              </span>
            ) : (
              <span>{reviewLabel}</span>
            )}
            {property.isGuestFavorite && (
              <span className="inline-flex items-center gap-1 font-medium">
                <span aria-hidden="true">✦</span> Guest favorite
              </span>
            )}
          </div>
          <SummaryImage key={property.imageUrl || "no-image"} src={property.imageUrl} title={property.title} />
        </section>

        {(() => {
          const isNonRefundable = Boolean(
            pricing.quote?.isNonRefundable || pricing.quote?.rateType === "NON_REFUNDABLE"
          );
          return (
            <section className="mt-5 border-b border-[#727272] pb-5" aria-labelledby="booking-summary-cancellation">
              <h3 id="booking-summary-cancellation" className="text-base font-semibold text-[#1f1f1f]">
                {isNonRefundable ? "Non-refundable rate" : "Free cancellation"}
              </h3>
              <p className="mt-1 text-sm text-[#727272]">
                {isNonRefundable ? (
                  <>
                    This booking uses the non-refundable rate. If you cancel, you will not receive a refund.{" "}
                    <button type="button" onClick={actions.onOpenPolicy} className="font-normal text-[#1f1f1f] underline hover:text-[#727272]">Full policy</button>
                  </>
                ) : (
                  <>
                    Cancel before {cancellationCutoff} for a full refund.{" "}
                    <button type="button" onClick={actions.onOpenPolicy} className="font-normal text-[#1f1f1f] underline hover:text-[#727272]">Full policy</button>
                  </>
                )}
              </p>
            </section>
          );
        })()}

        <section className="flex items-center justify-between gap-4 border-b border-[#727272] py-4 sm:py-6" aria-labelledby="booking-summary-dates">
          <div>
            <h3 id="booking-summary-dates" className="text-base font-semibold text-[#1f1f1f]">Dates</h3>
            <p className="mt-0.5 text-sm text-[#727272]">{formatCheckoutDateRange(stay.checkIn, stay.checkOut)}</p>
          </div>
          <button type="button" onClick={actions.onChangeDates} aria-label={`Change dates, currently ${formatCheckoutDateRange(stay.checkIn, stay.checkOut)}`} className="min-h-11 shrink-0 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 text-base font-medium text-[#1f1f1f] transition-colors hover:bg-[#1f1f1f] hover:text-white sm:min-w-[121px] sm:text-lg">Change</button>
        </section>

        <section className="flex items-center justify-between gap-4 border-b border-[#727272] py-4 sm:py-6" aria-labelledby="booking-summary-guests">
          <div>
            <h3 id="booking-summary-guests" className="text-base font-semibold text-[#1f1f1f]">Guests</h3>
            <p className="mt-0.5 text-sm text-[#727272]">{formatCheckoutGuests(stay)}</p>
          </div>
          <button type="button" onClick={actions.onChangeGuests} aria-label={`Change guests, currently ${formatCheckoutGuests(stay)}`} className="min-h-11 shrink-0 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] px-4 text-base font-medium text-[#1f1f1f] transition-colors hover:bg-[#1f1f1f] hover:text-white sm:min-w-[121px] sm:text-lg">Change</button>
        </section>

        <section className="border-b border-[#727272] py-5" aria-labelledby="booking-summary-price">
          <h3 id="booking-summary-price" className="mb-3 text-base font-semibold text-[#1f1f1f]">Price details</h3>
          {pricing.status === "error" || (!pricing.quote && pricing.status !== "loading") ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <p>{pricing.error || "We couldn't update your price."}</p>
              <button type="button" onClick={actions.onRetryPricing} className="mt-2 min-h-9 rounded-full border border-rose-400 px-4 font-semibold hover:bg-rose-100">Try again</button>
            </div>
          ) : !pricing.quote ? (
            <p className="text-sm text-zinc-500" aria-live="polite">Updating price…</p>
          ) : (
            <div className="relative">
              <PriceRows rows={summaryRows} formatMoney={actions.formatMoney} />
              {pricing.status === "loading" && <p className="mt-2 text-xs text-zinc-500" aria-live="polite">Updating price…</p>}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between pt-4">
          <span className="text-sm font-semibold text-[#1f1f1f] sm:text-base">Total ({displayCurrency})</span>
          <span className="text-sm font-bold text-zinc-950 sm:text-base" aria-live="polite">
            {pricing.quote ? actions.formatMoney(pricing.quote.guestTotal, 2) : "Unavailable"}
          </span>
        </div>

        <button
          ref={breakdownTriggerRef}
          type="button"
          onClick={() => onBreakdownOpenChange(true)}
          disabled={!pricing.quote || pricing.status !== "success"}
          aria-expanded={isBreakdownOpen}
          aria-controls="checkout-price-breakdown"
          className="mt-5 min-h-11 text-left text-base font-semibold text-[#1f1f1f] underline transition-colors hover:text-[#727272] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Price breakdown
        </button>
      </aside>

      {isBreakdownOpen && pricing.quote && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeBreakdown}>
          <section id="checkout-price-breakdown" role="dialog" aria-modal="true" aria-labelledby="checkout-price-breakdown-title" className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-[30px] bg-white p-6 shadow-lg" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") closeBreakdown(); }}>
            <div className="flex items-center justify-between border-b border-[#727272] pb-4">
              <h2 id="checkout-price-breakdown-title" className="text-lg font-medium text-[#1f1f1f]">Price breakdown</h2>
              <button ref={breakdownCloseRef} type="button" onClick={closeBreakdown} aria-label="Close price breakdown" className="flex size-10 items-center justify-center rounded-full text-[#1f1f1f] hover:bg-zinc-100">✕</button>
            </div>
            <div className="py-5"><PriceRows rows={breakdownRows} formatMoney={actions.formatMoney} /></div>
            <div className="flex items-center justify-between border-t border-[#727272] pt-4 text-base font-semibold text-[#1f1f1f]">
              <span>Total ({displayCurrency})</span>
              <span>{actions.formatMoney(pricing.quote.guestTotal, 2)}</span>
            </div>
          </section>
        </ModalOverlay>
      )}
    </>
  );
});
