import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { bookingService } from "@/services/booking.service";
import { reviewService } from "@/services/review.service";
import { getCurrencyForCountry } from "@/lib/currency";
import { CurrencyPrice } from "@/components/ui/currency-price";
import { toReservationCardData } from "@/lib/profile/reservation-data";
import { BookingDetailsActions } from "@/components/bookings/booking-details-actions";

function formatDate(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function calendarNights(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(0, Math.round((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86_400_000));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function BookingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser(`/bookings/${id}`);
  const booking = await bookingService.getById(user, id).catch(() => notFound());
  const hasReview = await reviewService.hasReviewForBooking(booking.id);
  const canReview = booking.status === "CONFIRMED" && new Date(booking.endDate) < new Date() && !hasReview;
  const reviewUnavailableMessage = booking.status === "CANCELLED"
    ? "Reviews are not available for cancelled reservations."
    : booking.status !== "CONFIRMED"
      ? "Reviews become available after this reservation is confirmed and your stay has ended."
      : "Reviews become available after check-out.";
  const listing = booking.listing;
  const snapshot = asRecord(booking.priceBreakdown);
  const nights = calendarNights(booking.startDate, booking.endDate);
  const currency = booking.currency || getCurrencyForCountry(listing?.country);
  const nightlySubtotal = amount(snapshot.nightlySubtotal) ?? ((booking.nightlyPrice || listing?.price || 0) * nights);
  const discountAmount = amount(snapshot.discountAmount) ?? 0;
  const cleaningFee = amount(snapshot.cleaningFee) ?? booking.cleaningFee ?? 0;
  const taxTotal = amount(snapshot.taxTotal) ?? 0;
  const total = booking.totalPrice ?? amount(snapshot.guestTotal) ?? amount(snapshot.totalPrice) ?? Math.max(0, nightlySubtotal - discountAmount + cleaningFee + taxTotal);
  const location = [listing?.city, listing?.country].filter((value): value is string => Boolean(value?.trim())).join(", ");
  const bookingCode = booking.id.slice(-8).toUpperCase();
  const reservationData = toReservationCardData(booking, user.name || user.email || "Guest");

  return (
    <div className="mx-auto w-full max-w-5xl pb-12 text-[#1F1F1F]">
      <Link href="/profile/tab/upcoming" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-zinc-600">Back to trips</Link>

      <div className="mt-5 grid gap-9 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-7">
            <div>
              <p className="text-sm text-zinc-600">Reservation {bookingCode}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{listing?.title || "Your stay"}</h1>
              {location && <p className="mt-2 text-sm text-zinc-600">{location}</p>}
            </div>
            <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${booking.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-800" : booking.status === "CANCELLED" ? "bg-zinc-100 text-zinc-700" : "bg-amber-50 text-amber-900"}`}>{statusLabel(booking.status)}</span>
          </div>

          <section className="border-b border-zinc-200 py-7" aria-labelledby="stay-heading">
            <h2 id="stay-heading" className="text-xl font-semibold">Your stay</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div><dt className="text-sm text-zinc-500">Check-in</dt><dd className="mt-1 font-medium">{formatDate(booking.startDate)}{listing?.checkInStart ? ` · ${listing.checkInStart}` : ""}</dd></div>
              <div><dt className="text-sm text-zinc-500">Check-out</dt><dd className="mt-1 font-medium">{formatDate(booking.endDate)}{listing?.checkOutTime ? ` · ${listing.checkOutTime}` : ""}</dd></div>
              <div><dt className="text-sm text-zinc-500">Length of stay</dt><dd className="mt-1 font-medium">{nights} {nights === 1 ? "night" : "nights"}</dd></div>
              <div><dt className="text-sm text-zinc-500">Guests</dt><dd className="mt-1 font-medium">{booking.guests} {booking.guests === 1 ? "guest" : "guests"}</dd></div>
            </dl>
          </section>

          {listing?.description && <section className="border-b border-zinc-200 py-7" aria-labelledby="property-heading">
            <h2 id="property-heading" className="text-xl font-semibold">About this stay</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700">{listing.description}</p>
            <p className="mt-4 text-sm text-zinc-600">{location || "Location details are available after confirmation."}</p>
          </section>}

          <section className="py-7" aria-labelledby="booking-heading">
            <h2 id="booking-heading" className="text-xl font-semibold">Booking details</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div><dt className="text-sm text-zinc-500">Booked on</dt><dd className="mt-1 font-medium">{formatDate(booking.createdAt)}</dd></div>
              <div><dt className="text-sm text-zinc-500">Cancellation policy</dt><dd className="mt-1 font-medium">{booking.isNonRefundable ? "Non-refundable" : booking.cancellationPolicy || "Policy details unavailable"}</dd></div>
            </dl>
          </section>

          <BookingDetailsActions booking={reservationData} />
        </div>

        <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-28" aria-labelledby="price-heading">
          {listing?.photos[0] && <img src={listing.photos[0]} alt={listing.title} className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover" />}
          <h2 id="price-heading" className="text-lg font-semibold">Price details</h2>
          <dl className="mt-5 space-y-3 text-sm text-zinc-700">
            <div className="flex justify-between gap-4"><dt><CurrencyPrice amountMinorUnits={booking.nightlyPrice || listing?.price || 0} sourceCurrency={currency} /> × {nights} {nights === 1 ? "night" : "nights"}</dt><dd><CurrencyPrice amountMinorUnits={nightlySubtotal} sourceCurrency={currency} /></dd></div>
            {discountAmount > 0 && <div className="flex justify-between gap-4 text-emerald-700"><dt>Discount</dt><dd>-<CurrencyPrice amountMinorUnits={discountAmount} sourceCurrency={currency} /></dd></div>}
            {cleaningFee > 0 && <div className="flex justify-between gap-4"><dt>Cleaning fee</dt><dd><CurrencyPrice amountMinorUnits={cleaningFee} sourceCurrency={currency} /></dd></div>}
            {taxTotal > 0 && <div className="flex justify-between gap-4"><dt>Taxes</dt><dd><CurrencyPrice amountMinorUnits={taxTotal} sourceCurrency={currency} /></dd></div>}
            <div className="flex justify-between gap-4 border-t border-zinc-200 pt-4 text-base font-semibold text-zinc-900"><dt>Total paid</dt><dd><CurrencyPrice amountMinorUnits={total} sourceCurrency={currency} /></dd></div>
          </dl>
          {canReview ? <Link href={`/bookings/${booking.id}/review`} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900">Write a review</Link> : hasReview ? <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">Review submitted</p> : <div className="mt-6"><button type="button" disabled aria-disabled="true" className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-zinc-200 px-5 text-sm font-semibold text-zinc-500">Write a review</button><p className="mt-2 text-center text-xs leading-5 text-zinc-500">{reviewUnavailableMessage}</p></div>}
        </aside>
      </div>
    </div>
  );
}
