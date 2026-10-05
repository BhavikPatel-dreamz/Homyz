import Image from "next/image";
import type { ReviewRequestData } from "@/lib/booking/review-request";
import type { BookingMode } from "@/lib/booking/booking-mode";
import { useCurrency } from "@/lib/currency-context";

type ReviewRequestStepProps = {
  data: ReviewRequestData;
  bookingMode: BookingMode;
  property: {
    title: string;
    imageUrl: string | null;
    location: string;
  };
  formatMoney: (amount: number, fractionDigits?: number) => string;
  isSubmitting: boolean;
  onChangePaymentTiming: () => void;
  onChangePaymentMethod: () => void;
  onChangeMessage: () => void;
  onChangeDates: () => void;
  onChangeGuests: () => void;
  onSubmit: () => void;
};

function ChangeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 shrink-0 rounded-full border border-[#1f1f1f] bg-[#f3f4f5] px-4 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#1f1f1f] hover:text-white"
      aria-label={`Change ${label}`}
    >
      Change
    </button>
  );
}

export function ReviewRequestStep({
  data,
  bookingMode,
  property,
  formatMoney,
  isSubmitting,
  onChangePaymentTiming,
  onChangePaymentMethod,
  onChangeMessage,
  onChangeDates,
  onChangeGuests,
  onSubmit,
}: ReviewRequestStepProps) {
  const { currency: displayCurrency } = useCurrency();
  const isInstantBook = bookingMode === "INSTANT_BOOK";
  return (
    <div className="min-w-0 divide-y divide-zinc-200">
      <section className="py-5" aria-labelledby="review-property-heading">
        <h3 id="review-property-heading" className="text-base font-semibold text-[#1f1f1f]">Property</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
            {property.imageUrl ? (
              <Image src={property.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-zinc-500">No image</div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{property.title}</p>
            <p className="mt-1 truncate text-sm text-zinc-600">{property.location}</p>
          </div>
        </div>
      </section>

      <section className="py-5" aria-labelledby="review-payment-heading">
        <h3 id="review-payment-heading" className="text-base font-semibold text-[#1f1f1f]">Payment</h3>
        <div className="mt-4 space-y-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">Payment timing</p>
              <p className="mt-1 break-words text-sm text-zinc-600">{data.payment.timing}</p>
            </div>
            <ChangeButton label="payment timing" onClick={onChangePaymentTiming} />
          </div>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">Payment method</p>
              <p className="mt-1 break-words text-sm text-zinc-600">{data.payment.method}</p>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Payment status: Pending / Deferred
                </span>
              </div>
            </div>
            <ChangeButton label="payment method" onClick={onChangePaymentMethod} />
          </div>
        </div>
      </section>

      <section className="py-5" aria-labelledby="review-message-heading">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id="review-message-heading" className="text-base font-semibold text-[#1f1f1f]">Message to host</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{data.message || "No message added"}</p>
          </div>
          <ChangeButton label="message to host" onClick={onChangeMessage} />
        </div>
      </section>

      <section className="py-5" aria-labelledby="review-trip-heading">
        <h3 id="review-trip-heading" className="text-base font-semibold text-[#1f1f1f]">Trip</h3>
        <div className="mt-4 space-y-4">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <dl className="min-w-0 space-y-2 text-sm">
              <div><dt className="font-medium text-zinc-900">Check-in</dt><dd className="break-words text-zinc-600">{data.trip.checkIn}</dd></div>
              <div><dt className="font-medium text-zinc-900">Check-out</dt><dd className="break-words text-zinc-600">{data.trip.checkOut}</dd></div>
            </dl>
            <ChangeButton label="dates" onClick={onChangeDates} />
          </div>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900">Guests</p>
              <p className="mt-1 break-words text-sm text-zinc-600">{data.trip.guests}</p>
            </div>
            <ChangeButton label="guests" onClick={onChangeGuests} />
          </div>
        </div>
      </section>

      <section className="py-5" aria-labelledby="review-price-heading">
        <h3 id="review-price-heading" className="text-base font-semibold text-[#1f1f1f]">Price details</h3>
        <dl className="mt-4 space-y-2.5">
          {data.pricing.rows.map((row) => (
            <div key={row.id} className="flex items-start justify-between gap-4 text-sm">
              <dt className="min-w-0 break-words text-zinc-600">{row.label}</dt>
              <dd className="shrink-0 font-medium text-zinc-900">{row.subtract ? "−" : ""}{formatMoney(row.amount, 2)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-zinc-300 pt-3 font-semibold text-zinc-950">
            <dt>Total ({displayCurrency})</dt>
            <dd>{formatMoney(data.pricing.total, 2)}</dd>
          </div>
        </dl>
      </section>

      <div className="pt-5 space-y-4">
        {data.isNonRefundable && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="note" aria-label="Non-refundable policy acknowledgment">
            <p className="font-semibold">Non-refundable rate</p>
            <p>You have selected the non-refundable rate. If you cancel this reservation, you will not receive a refund.</p>
          </div>
        )}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          {isInstantBook ? (
            <>
              <p className="font-semibold">Your booking will be confirmed immediately after you continue.</p>
              <p>No real payment will be processed in the current deferred payment mode.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">The host will review your request before the booking is confirmed.</p>
              <p>The host has 24 hours to respond. No real payment is processed when you send the request.</p>
            </>
          )}
        </div>
        {data.blocker && (
          <p id="request-submit-blocker" role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950">
            {data.blocker}
          </p>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!data.canSubmitRequest || isSubmitting}
          aria-describedby={data.blocker ? "request-submit-blocker" : undefined}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full border border-[#1f1f1f] bg-[#1f1f1f] px-5 text-base font-semibold text-white transition-colors hover:bg-[#fcdf9c] hover:text-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? isInstantBook ? "Confirming booking..." : "Sending request..."
            : isInstantBook ? "Confirm booking" : "Request to book"}
        </button>
      </div>
    </div>
  );
}
