import React from "react";
import Link from "next/link";
import { formatBookingDate } from "@/lib/booking/booking-date";

interface BookingStayInfoProps {
  bookingId: string;
  propertyName: string;
  propertyType: string | null;
  listingSlug: string | null;
  listingId: string;
  startDate: Date | string;
  endDate: Date | string;
  checkInStart?: string | null;
  checkOutTime?: string | null;
  nights: number;
  guests: number;
  location: string;
  createdAt: Date | string;
  cancellationPolicy: string | null;
  isNonRefundable: boolean;
  description?: string | null;
}

function formatCreatedDate(val: Date | string): string {
  const d = new Date(val);
  if (isNaN(d.getTime())) return "Not available";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BookingStayInfo({
  bookingId,
  propertyName,
  propertyType,
  listingSlug,
  listingId,
  startDate,
  endDate,
  checkInStart,
  checkOutTime,
  nights,
  guests,
  location,
  createdAt,
  cancellationPolicy,
  isNonRefundable,
  description,
}: BookingStayInfoProps) {
  const listingHref = `/listings/${listingSlug || listingId}`;
  const bookingCode = bookingId.slice(-8).toUpperCase();

  return (
    <section className="border-b border-zinc-200 py-7" aria-labelledby="stay-info-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stay-info-heading" className="text-xl font-semibold text-[#1F1F1F]">
          Stay information
        </h2>
        <Link
          href={listingHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 underline underline-offset-4 hover:text-zinc-600 transition-colors"
        >
          <span>View full listing</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Property</dt>
          <dd className="mt-1 font-semibold text-zinc-900">{propertyName}</dd>
          {propertyType && <p className="text-xs text-zinc-500 mt-0.5">{propertyType}</p>}
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Reservation Code</dt>
          <dd className="mt-1 font-mono font-semibold text-zinc-900">{bookingCode}</dd>
          <p className="text-xs text-zinc-500 mt-0.5">Booked on {formatCreatedDate(createdAt)}</p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Check-in</dt>
          <dd className="mt-1 font-semibold text-zinc-900">{formatBookingDate(startDate, { weekday: true })}</dd>
          <p className="text-xs text-zinc-600 mt-0.5">
            {checkInStart ? `From ${checkInStart}` : "Check-in from 3:00 PM"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Check-out</dt>
          <dd className="mt-1 font-semibold text-zinc-900">{formatBookingDate(endDate, { weekday: true })}</dd>
          <p className="text-xs text-zinc-600 mt-0.5">
            {checkOutTime ? `By ${checkOutTime}` : "Check-out by 11:00 AM"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Length of Stay</dt>
          <dd className="mt-1 font-semibold text-zinc-900">
            {nights} {nights === 1 ? "night" : "nights"}
          </dd>
          <p className="text-xs text-zinc-500 mt-0.5">
            {guests} {guests === 1 ? "guest" : "guests"} reserved
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cancellation Policy</dt>
          <dd className="mt-1 font-semibold text-zinc-900">
            {isNonRefundable ? "Non-refundable" : cancellationPolicy || "Flexible"}
          </dd>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isNonRefundable
              ? "Special non-refundable discounted booking"
              : "Review terms for refund eligibility"}
          </p>
        </div>
      </dl>

      {description && (
        <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-white p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
            Listing Summary
          </p>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed line-clamp-3">
            {description}
          </p>
        </div>
      )}
    </section>
  );
}
