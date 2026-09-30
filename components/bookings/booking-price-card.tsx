"use client";

import React from "react";
import Link from "next/link";
import { CurrencyPrice } from "@/components/ui/currency-price";
import type { AuthoritativePriceBreakdown } from "@/lib/booking/booking-price";
import type { BookingStatusDetails, BookingAvailableActions } from "@/lib/booking/booking-status";

interface BookingPriceCardProps {
  photo: string | null;
  propertyTitle: string;
  listingSlug: string | null;
  listingId: string;
  bookingId: string;
  pricing: AuthoritativePriceBreakdown;
  statusDetails: BookingStatusDetails;
  actions: BookingAvailableActions;
  onOpenCancel: () => void;
  onOpenChange: () => void;
  onOpenReceipt: () => void;
  onOpenContact: () => void;
}

export function BookingPriceCard({
  photo,
  propertyTitle,
  listingSlug,
  listingId,
  bookingId,
  pricing,
  statusDetails,
  actions,
  onOpenCancel,
  onOpenChange,
  onOpenReceipt,
  onOpenContact,
}: BookingPriceCardProps) {
  const listingHref = `/listings/${listingSlug || listingId}`;
  const { status, isCompleted, isCancelled, isCurrent, isUpcoming, isPending } = statusDetails;

  return (
    <aside
      className="h-fit rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-28"
      aria-labelledby="price-summary-heading"
    >
      {/* Property Photo & Link */}
      {photo && (
        <Link href={listingHref} className="group block mb-5 overflow-hidden rounded-2xl">
          <img
            src={photo}
            alt={propertyTitle}
            className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      )}

      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <h2 id="price-summary-heading" className="text-lg font-semibold text-[#1F1F1F]">
          Price details
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusDetails.badgeClass}`}>
          {statusDetails.badgeLabel}
        </span>
      </div>

      {/* Authoritative Price Line Items */}
      <dl className="mt-4 space-y-3 text-sm text-zinc-700">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-600">
            <CurrencyPrice
              amountMinorUnits={pricing.nightlyPrice}
              sourceCurrency={pricing.currency}
              fractionDigits={2}
            />{" "}
            × {pricing.nights} {pricing.nights === 1 ? "night" : "nights"}
          </dt>
          <dd className="font-medium text-[#1F1F1F]">
            <CurrencyPrice
              amountMinorUnits={pricing.nightlySubtotal}
              sourceCurrency={pricing.currency}
              fractionDigits={2}
            />
          </dd>
        </div>

        {pricing.extraGuestFee > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Extra guest fee</dt>
            <dd className="font-medium text-[#1F1F1F]">
              <CurrencyPrice
                amountMinorUnits={pricing.extraGuestFee}
                sourceCurrency={pricing.currency}
                fractionDigits={2}
              />
            </dd>
          </div>
        )}

        {pricing.cleaningFee > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Cleaning fee</dt>
            <dd className="font-medium text-[#1F1F1F]">
              <CurrencyPrice
                amountMinorUnits={pricing.cleaningFee}
                sourceCurrency={pricing.currency}
                fractionDigits={2}
              />
            </dd>
          </div>
        )}

        {pricing.serviceFee > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">Service fee</dt>
            <dd className="font-medium text-[#1F1F1F]">
              <CurrencyPrice
                amountMinorUnits={pricing.serviceFee}
                sourceCurrency={pricing.currency}
                fractionDigits={2}
              />
            </dd>
          </div>
        )}

        {pricing.discountAmount > 0 && (
          <div className="flex justify-between gap-4 text-emerald-700">
            <dt>Discount</dt>
            <dd className="font-medium">
              -
              <CurrencyPrice
                amountMinorUnits={pricing.discountAmount}
                sourceCurrency={pricing.currency}
                fractionDigits={2}
              />
            </dd>
          </div>
        )}

        {pricing.taxTotal > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">
              {pricing.taxes.length === 1 ? pricing.taxes[0].name : "Taxes"}
            </dt>
            <dd className="font-medium text-[#1F1F1F]">
              <CurrencyPrice
                amountMinorUnits={pricing.taxTotal}
                sourceCurrency={pricing.currency}
                fractionDigits={2}
              />
            </dd>
          </div>
        )}

        {pricing.otherCharges !== 0 && (
          <div className="flex justify-between gap-4 text-zinc-600">
            <dt>Other charges</dt>
            <dd className="font-medium text-[#1F1F1F]">
              <CurrencyPrice
                amountMinorUnits={pricing.otherCharges}
                sourceCurrency={pricing.currency}
                fractionDigits={2}
              />
            </dd>
          </div>
        )}

        <div className="flex justify-between gap-4 border-t border-zinc-200 pt-4 text-base font-bold text-zinc-900">
          <dt>Total ({pricing.currency})</dt>
          <dd className="text-lg text-emerald-800">
            <CurrencyPrice
              amountMinorUnits={pricing.totalPrice}
              sourceCurrency={pricing.currency}
              fractionDigits={2}
            />
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
          <dt className="font-medium">Payment</dt>
          <dd className="font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            Pending / Deferred
          </dd>
        </div>
      </dl>

      {/* Primary Contextual Actions */}
      <div className="mt-6 space-y-2.5">
        {/* COMPLETED STAY ACTIONS */}
        {isCompleted && (
          <>
            {actions.canReview ? (
              <Link
                href={`/bookings/${bookingId}/review`}
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 shadow-xs"
              >
                Write a review
              </Link>
            ) : actions.hasReviewed ? (
              <Link
                href={`${listingHref}#reviews`}
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 px-5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
              >
                ✓ Review submitted · View reviews
              </Link>
            ) : (
              <div className="rounded-xl bg-zinc-100 px-4 py-2.5 text-center text-xs text-[#727272] font-medium">
                {actions.reviewDisabledReason || "Review period has ended"}
              </div>
            )}

            <Link
              href={listingHref}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition-colors"
            >
              Book again
            </Link>

            <button
              type="button"
              onClick={onOpenReceipt}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition-colors cursor-pointer"
            >
              View receipt
            </button>
          </>
        )}

        {/* CONFIRMED / UPCOMING STAY ACTIONS */}
        {isUpcoming && !isPending && !isCancelled && (
          <>
            <button
              type="button"
              onClick={onOpenChange}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 shadow-xs cursor-pointer"
            >
              Change reservation
            </button>

            <button
              type="button"
              onClick={onOpenReceipt}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition-colors cursor-pointer"
            >
              View receipt
            </button>

            {actions.canCancel ? (
              <button
                type="button"
                onClick={onOpenCancel}
                className="flex min-h-10 w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
              >
                Cancel reservation
              </button>
            ) : (
              <p className="text-center text-xs text-[#727272] pt-1">
                {actions.cancelDisabledReason || "Reservation cannot be cancelled."}
              </p>
            )}
          </>
        )}

        {/* CURRENT STAY ACTIONS */}
        {isCurrent && (
          <>
            <button
              type="button"
              onClick={onOpenContact}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 shadow-xs cursor-pointer"
            >
              Contact host for assistance
            </button>

            <button
              type="button"
              onClick={onOpenReceipt}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition-colors cursor-pointer"
            >
              View receipt
            </button>
          </>
        )}

        {/* CANCELLED ACTIONS */}
        {isCancelled && (
          <>
            <button
              type="button"
              onClick={onOpenReceipt}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              View cancellation receipt
            </button>

            <Link
              href="/listings"
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              Find another stay
            </Link>
          </>
        )}

        {/* PENDING ACTIONS */}
        {isPending && (
          <>
            <button
              type="button"
              onClick={onOpenContact}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Message host
            </button>

            <button
              type="button"
              onClick={onOpenCancel}
              className="flex min-h-10 w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
            >
              Withdraw request
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

