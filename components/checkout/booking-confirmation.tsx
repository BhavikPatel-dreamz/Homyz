import Image from "next/image";
import Link from "next/link";
import type { BookingMode } from "@/lib/booking/booking-mode";
import {
  formatCheckoutDate,
  formatCheckoutGuests,
  getCheckoutPriceRows,
  type CheckoutSummaryQuote,
} from "@/lib/booking/checkout-summary";

type BookingConfirmationProps = {
  bookingId: string;
  bookingMode: BookingMode;
  property: {
    title: string;
    imageUrl: string | null;
    location: string;
  };
  hostName: string;
  checkIn: string;
  checkOut: string;
  guests: {
    adults: number;
    children: number;
    infants: number;
    pets: number;
  };
  message: string;
  quote: CheckoutSummaryQuote;
  paymentTiming: string;
  paymentMethod: string;
  formatMoney: (amount: number, fractionDigits?: number) => string;
};

export function BookingConfirmation({
  bookingId,
  bookingMode,
  property,
  hostName,
  checkIn,
  checkOut,
  guests,
  message,
  quote,
  paymentTiming,
  paymentMethod,
  formatMoney,
}: BookingConfirmationProps) {
  const isInstantBook = bookingMode === "INSTANT_BOOK";
  const priceRows = getCheckoutPriceRows(quote);

  return (
    <div role="status" aria-live="polite" className="mt-5 animate-in fade-in">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
          <svg className="size-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25"><path d="m3.25 8.25 2.8 2.8 6.7-6.7" /></svg>
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-base font-semibold text-emerald-950">
            {isInstantBook ? "Booking confirmed" : "Booking request sent"}
          </h3>
          <p className="mt-1 text-sm leading-5 text-emerald-800">
            {isInstantBook ? "Your reservation is confirmed." : "Waiting for host confirmation."}
          </p>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-white" aria-labelledby="confirmation-property-heading">
        <div className="flex gap-4 p-4">
          <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-100 sm:w-32">
            {property.imageUrl ? (
              <Image src={property.imageUrl} alt="" fill sizes="128px" className="object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs text-zinc-500">No image</div>
            )}
          </div>
          <div className="min-w-0 py-1">
            <h3 id="confirmation-property-heading" className="text-base font-semibold text-zinc-950">{property.title}</h3>
            <p className="mt-1 text-sm text-zinc-600">{property.location}</p>
            <p className="mt-2 text-xs text-zinc-500">Booking ID: <span className="font-mono text-zinc-700">{bookingId}</span></p>
          </div>
        </div>
      </section>

      <div className="mt-5 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 px-4 sm:px-5">
        <section className="py-5" aria-labelledby="confirmation-trip-heading">
          <h3 id="confirmation-trip-heading" className="text-sm font-semibold text-zinc-950">Trip details</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-zinc-500">Check-in</dt><dd className="mt-1 font-medium text-zinc-900">{formatCheckoutDate(checkIn)}</dd></div>
            <div><dt className="text-zinc-500">Check-out</dt><dd className="mt-1 font-medium text-zinc-900">{formatCheckoutDate(checkOut)}</dd></div>
            <div><dt className="text-zinc-500">Number of nights</dt><dd className="mt-1 font-medium text-zinc-900">{quote.nights}</dd></div>
            <div><dt className="text-zinc-500">Guests</dt><dd className="mt-1 font-medium text-zinc-900">{formatCheckoutGuests(guests)}</dd></div>
            <div><dt className="text-zinc-500">Host</dt><dd className="mt-1 font-medium text-zinc-900">{hostName}</dd></div>
            <div><dt className="text-zinc-500">Booking status</dt><dd className="mt-1 font-semibold text-emerald-700">{isInstantBook ? "Confirmed" : "Waiting for host confirmation"}</dd></div>
          </dl>
        </section>

        <section className="py-5" aria-labelledby="confirmation-message-heading">
          <h3 id="confirmation-message-heading" className="text-sm font-semibold text-zinc-950">Message sent to host</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{message.trim() || "No message added"}</p>
        </section>

        <section className="py-5" aria-labelledby="confirmation-payment-heading">
          <h3 id="confirmation-payment-heading" className="text-sm font-semibold text-zinc-950">Payment</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Payment timing</dt><dd className="text-right font-medium text-zinc-900">{paymentTiming}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Payment method</dt><dd className="text-right font-medium text-zinc-900">{paymentMethod}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-zinc-500">Payment status</dt><dd className="text-right font-semibold text-amber-700">Pending / Deferred</dd></div>
          </dl>
        </section>

        <section className="py-5" aria-labelledby="confirmation-price-heading">
          <h3 id="confirmation-price-heading" className="text-sm font-semibold text-zinc-950">Price breakdown</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            {priceRows.map((row) => (
              <div key={row.id} className="flex justify-between gap-4">
                <dt className="text-zinc-600">{row.label}</dt>
                <dd className="font-medium text-zinc-900">{row.subtract ? "−" : ""}{formatMoney(row.amount, 2)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-zinc-300 pt-3 text-base font-semibold text-zinc-950">
              <dt>Total ({quote.currency})</dt>
              <dd>{formatMoney(quote.guestTotal, 2)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href={`/bookings/${bookingId}`} className="flex min-h-12 items-center justify-center rounded-full border border-[#1f1f1f] bg-[#1f1f1f] px-5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#fcdf9c] hover:text-[#1f1f1f]">
          View booking details
        </Link>
        <Link href="/profile/tab/upcoming?bookingView=all" className="flex min-h-12 items-center justify-center rounded-full border border-[#1f1f1f] bg-white px-5 text-center text-sm font-semibold text-[#1f1f1f] transition-colors hover:bg-zinc-100">
          View all bookings
        </Link>
      </div>
      <Link href="/" className="mx-auto mt-4 block w-fit text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950">
        Back to home
      </Link>
    </div>
  );
}
