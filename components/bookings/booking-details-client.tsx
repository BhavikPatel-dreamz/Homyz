"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { BookingDetailsData } from "@/services/booking.service";
import { BookingStayInfo } from "./booking-stay-info";
import { BookingArrivalInfo } from "./booking-arrival-info";
import { BookingGuestDetails } from "./booking-guest-details";
import { BookingHostCard } from "./booking-host-card";
import { BookingHouseRules } from "./booking-house-rules";
import { BookingPriceCard } from "./booking-price-card";
import { BookingStatusTimeline } from "./booking-status-timeline";
import { ChangeReservationModal } from "./change-reservation-modal";
import { EnhancedCancelModal } from "./enhanced-cancel-modal";
import { ReceiptModal, ContactHostModal } from "@/components/dashboard/trip-modals";
import { toReservationCardData } from "@/lib/profile/reservation-data";

interface BookingDetailsClientProps {
  data: BookingDetailsData;
}

export function BookingDetailsClient({ data }: BookingDetailsClientProps) {
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  const { booking, listing, guest, statusDetails, actions, pricing } = data;

  const backLinkHref = statusDetails.isCompleted ? "/profile/tab/past" : "/profile/tab/upcoming";
  const backLinkLabel = statusDetails.isCompleted ? "Back to past trips" : "Back to upcoming trips";

  const location = [listing.city, listing.country].filter(Boolean).join(", ");
  const bookingCode = booking.id.slice(-8).toUpperCase();

  // Reservation card data for existing ContactHostModal compatibility
  const reservationData = toReservationCardData(
    {
      ...booking,
      priceBreakdown: booking.priceBreakdown as any,
      listing: {
        id: listing.id,
        customSlug: listing.customSlug,
        title: listing.title,
        photos: listing.photos,
        description: listing.description,
        price: listing.price,
        city: listing.city,
        country: listing.country,
        checkInStart: listing.checkInStart,
        checkOutTime: listing.checkOutTime,
      },
      user: guest,
    } as any,
    guest?.name || guest?.email || "Guest",
  );

  return (
    <div className="w-full pb-16 pt-4 text-[#1F1F1F]">
      {/* Back navigation */}
      <Link
        href={backLinkHref}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-zinc-700 underline underline-offset-4 hover:text-[#1F1F1F] transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{backLinkLabel}</span>
      </Link>

      {/* Main Grid: Left Content (cols) & Right Sticky Sidebar */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        {/* Left Column: Comprehensive Reservation Management */}
        <div className="min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">
                Reservation #{bookingCode}
              </p>
              <h1 className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight text-[#1F1F1F]">
                {listing.title}
              </h1>
              {location && (
                <p className="mt-1.5 text-sm font-medium text-[#727272] flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-[#727272] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{location}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span className={`rounded-full px-3.5 py-1 text-sm font-medium shadow-2xs ${statusDetails.badgeClass}`}>
                {statusDetails.label}
              </span>
            </div>
          </div>

          {/* Contextual Status Banner */}
          <div className={`mt-6 sm:rounded-2xl rounded-lg border p-5 ${
            statusDetails.isCompleted
              ? "bg-zinc-50 border-zinc-200 text-zinc-800"
              : statusDetails.isCancelled
                ? "bg-red-50/70 border-red-200 text-red-900"
                : statusDetails.isCurrent
                  ? "bg-blue-50/70 border-blue-200 text-blue-950"
                  : statusDetails.isPending
                    ? "bg-amber-50/70 border-amber-200 text-amber-950"
                    : "bg-emerald-50/60 border-emerald-200 text-emerald-950"
          }`}>
            <h2 className="text-base font-semibold">{statusDetails.headline}</h2>
            <p className="mt-1 text-xs sm:text-sm leading-relaxed opacity-90">
              {statusDetails.description}
            </p>
          </div>

          {/* Status Timeline */}
          {data.timeline && data.timeline.length > 0 && (
            <BookingStatusTimeline events={data.timeline} className="mt-6" />
          )}

          {/* Guest message note */}
          {data.guestMessage && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-2xs">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Your message to {listing.host.name || "the host"}
                </h3>
                {data.conversationId && (
                  <Link
                    href={`/messages?id=${data.conversationId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:text-zinc-600 underline underline-offset-4"
                  >
                    Open conversation
                  </Link>
                )}
              </div>
              <p className="mt-3 text-sm text-zinc-700 leading-relaxed italic">
                &ldquo;{data.guestMessage}&rdquo;
              </p>
            </div>
          )}

          {/* 1. Stay Information */}
          <BookingStayInfo
            bookingId={booking.id}
            propertyName={listing.title}
            propertyType={listing.propertyType || listing.placeCategory}
            listingSlug={listing.customSlug}
            listingId={listing.id}
            startDate={booking.startDate}
            endDate={booking.endDate}
            checkInStart={listing.checkInStart}
            checkOutTime={listing.checkOutTime}
            nights={pricing.nights}
            guests={booking.guests}
            location={location}
            createdAt={booking.createdAt}
            cancellationPolicy={booking.cancellationPolicy}
            isNonRefundable={booking.isNonRefundable}
            description={listing.description}
          />

          {/* 2. Arrival Information (Time-gated) */}
          <BookingArrivalInfo
            isArrivalInfoReleased={actions.isArrivalInfoReleased}
            arrivalReleaseDateTime={actions.arrivalReleaseDateTime}
            checkInMethod={listing.checkInMethod}
            checkInStart={listing.checkInStart}
            checkInEnd={listing.checkInEnd}
            checkOutTime={listing.checkOutTime}
            address={listing.address || listing.shortAddress}
            apartment={listing.apartment}
            city={listing.city}
            country={listing.country}
            directions={listing.directions}
            parkingInstructions={listing.parkingInstructions}
            checkInInstructions={listing.checkInInstructions}
            houseManual={listing.houseManual}
            wifiNetwork={listing.wifiNetwork}
            wifiPassword={listing.wifiPassword}
            doorCode={listing.doorCode}
            lockboxCode={listing.lockboxCode}
            isConfirmedOrCurrent={statusDetails.status === "CONFIRMED" || statusDetails.status === "CURRENT_STAY" || statusDetails.status === "COMPLETED"}
          />

          {/* 3. Guest Details */}
          <BookingGuestDetails
            totalGuests={booking.guests}
            maxListingGuests={listing.guests}
            priceBreakdown={booking.priceBreakdown}
            canModifyGuests={actions.canModify}
            onChangeGuests={() => setIsChangeOpen(true)}
          />

          {/* 4. Host Profile & Contact */}
          <BookingHostCard
            hostName={listing.host.name}
            hostImage={listing.host.image}
            hostSince={listing.host.createdAt}
            isConfirmed={statusDetails.status === "CONFIRMED" || statusDetails.status === "CURRENT_STAY" || statusDetails.status === "COMPLETED"}
            onContactHost={() => setIsContactOpen(true)}
          />

          {/* 5. House Rules & Things to Know */}
          <BookingHouseRules
            checkInStart={listing.checkInStart}
            checkInEnd={listing.checkInEnd}
            checkOutTime={listing.checkOutTime}
            maxGuests={listing.guests}
            petsAllowed={listing.petsAllowed}
            maxPets={listing.maxPets}
            petFee={listing.petFee}
            smokingAllowed={listing.smokingAllowed}
            smokingLocation={listing.smokingLocation}
            eventsAllowed={listing.eventsAllowed}
            quietHours={listing.quietHours}
            quietHoursStart={listing.quietHoursStart}
            quietHoursEnd={listing.quietHoursEnd}
            additionalRules={listing.additionalRules}
            safetyEquipment={listing.safetyEquipment}
            safetyDisclosures={listing.safetyDisclosures}
          />

          {/* 6. Help & Concierge Support */}
          <section className="py-7 border-t border-zinc-200" aria-labelledby="help-heading">
            <h2 id="help-heading" className="text-xl font-semibold text-[#1F1F1F]">
              Need help with this reservation?
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:rounded-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs">
                <h3 className="font-semibold text-base text-[#1F1F1F]">Message your host</h3>
                <p className="mt-1 text-sm text-[#727272]">
                  Have questions about arrival, luggage drop-off, key exchange, or check-in?
                </p>
                <button
                  type="button"
                  onClick={() => setIsContactOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1F1F1F] underline underline-offset-4 hover:text-zinc-600 cursor-pointer"
                >
                  Contact host
                </button>
              </div>

              <div className="sm:rounded-2xl rounded-lg border border-zinc-200 bg-white p-5 shadow-2xs">
                <h3 className="font-semibold text-base text-[#1F1F1F]">24/7 Concierge Support</h3>
                <p className="mt-1 text-sm text-[#727272]">
                  Our customer care team is available around the clock to support your stay.
                </p>
                <Link
                  href="/profile/tab/support"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1F1F1F] underline underline-offset-4 hover:text-zinc-600"
                >
                  Contact support
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Right Sticky Sidebar: Authoritative Price Breakdown & CTAs */}
        <div>
          <BookingPriceCard
            photo={listing.photos[0] || null}
            propertyTitle={listing.title}
            listingSlug={listing.customSlug}
            listingId={listing.id}
            bookingId={booking.id}
            pricing={pricing}
            statusDetails={statusDetails}
            actions={actions}
            onOpenCancel={() => setIsCancelOpen(true)}
            onOpenChange={() => setIsChangeOpen(true)}
            onOpenReceipt={() => setIsReceiptOpen(true)}
            onOpenContact={() => setIsContactOpen(true)}
          />
        </div>
      </div>

      {/* Modals */}
      <ChangeReservationModal
        isOpen={isChangeOpen}
        onClose={() => setIsChangeOpen(false)}
        bookingId={booking.id}
        currentStartDate={booking.startDate}
        currentEndDate={booking.endDate}
        currentGuests={booking.guests}
        maxGuests={listing.guests}
        currency={pricing.currency}
        currentTotalPrice={pricing.totalPrice}
        propertyName={listing.title}
      />

      <EnhancedCancelModal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        bookingId={booking.id}
        propertyName={listing.title}
        location={location}
        cancellationPolicy={booking.cancellationPolicy || "Flexible"}
        isNonRefundable={booking.isNonRefundable}
        totalPaid={pricing.totalPrice}
        currency={pricing.currency}
      />

      <ReceiptModal
        bookingId={booking.id}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />

      <ContactHostModal
        booking={reservationData}
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
}
