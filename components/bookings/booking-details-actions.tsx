"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CancelBookingModal, ReceiptModal, ContactHostModal } from "@/components/dashboard/trip-modals";
import type { ReservationCardData } from "@/components/dashboard/reservation-card";

interface BookingDetailsActionsProps {
  booking: ReservationCardData;
}

/** Returns true if the UTC calendar start date is strictly after today's UTC calendar date. */
function isStartDateInFuture(startDate: Date | string): boolean {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  // Compare calendar dates in UTC — matching backend logic
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return startUtc > todayUtc;
}

export function BookingDetailsActions({ booking }: BookingDetailsActionsProps) {
  const router = useRouter();
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(booking.status ?? "CONFIRMED");

  const isCancelled = currentStatus === "CANCELLED";
  const canCancel = !isCancelled && currentStatus !== "COMPLETED";
  // Frontend guards the button; backend will enforce the real check
  const checkinInFuture = isStartDateInFuture(booking.startDate);

  const handleCancelled = () => {
    setCurrentStatus("CANCELLED");
    setIsCancelOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-6 pt-7 border-t border-zinc-200" aria-labelledby="manage-reservation-heading">
      <h2 id="manage-reservation-heading" className="text-xl font-semibold text-[#1F1F1F]">
        Manage your reservation
      </h2>

      <div className="grid gap-4 sm:grid-cols-1">
        {/* 1. CONTACT HOST & SUPPORT */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs hover:border-zinc-300 transition-colors">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1F1F]">
                Getting help with your stay
              </h3>
              <p className="mt-1 text-sm text-zinc-600 leading-relaxed max-w-xl">
                Have questions about check-in instructions, key exchange, directions, or arrival time? Reach out to your host or connect with our 24/7 concierge support.
              </p>
            </div>
          </div>
          <div className="sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition-colors cursor-pointer"
            >
              Contact host
            </button>
          </div>
        </section>

        {/* 2. OFFICIAL VAT INVOICE & RECEIPT */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs hover:border-zinc-300 transition-colors">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1F1F]">
                Payment info & official receipt
              </h3>
              <p className="mt-1 text-sm text-zinc-600 leading-relaxed max-w-xl">
                Download or print an authoritative electronic VAT invoice and payment receipt for your personal records or company expense reimbursement.
              </p>
            </div>
          </div>
          <div className="sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400 transition-colors cursor-pointer"
            >
              View receipt
            </button>
          </div>
        </section>

        {/* 3. CANCELLATION POLICY */}
        {canCancel && (
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs hover:border-zinc-300 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1F1F1F]">
                  Cancellation policy
                </h3>
                <p className="mt-1 text-sm text-zinc-600 leading-relaxed max-w-xl">
                  {booking.isNonRefundable
                    ? "This reservation is non-refundable. Cancellations are final with zero guest refund according to the selected booking terms."
                    : booking.cancellationPolicy
                      ? `Policy: ${booking.cancellationPolicy}. You can cancel before check-in according to this policy.`
                      : "Standard cancellation policy applies. You can cancel this reservation before your scheduled check-in date."}
                </p>
                {!checkinInFuture && (
                  <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                    Check-in date has passed — cancellations are no longer accepted.
                  </p>
                )}
              </div>
            </div>
            <div className="sm:self-center shrink-0">
              {checkinInFuture ? (
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(true)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
                >
                  Cancel reservation
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-400"
                >
                  Cannot cancel
                </button>
              )}
            </div>
          </section>
        )}

        {/* 4. CANCELLED STATE — shown when booking is already cancelled */}
        {isCancelled && (
          <section className="flex items-start gap-4 rounded-2xl border border-zinc-200/70 bg-zinc-50 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-700">Reservation cancelled</h3>
              <p className="mt-1 text-sm text-zinc-500 leading-relaxed">
                This reservation has been cancelled. No further action is required. If you have a question about your refund, please contact support.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* MODALS */}
      <CancelBookingModal
        booking={booking}
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onCancelled={handleCancelled}
      />

      <ReceiptModal
        bookingId={booking.id}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />

      <ContactHostModal
        booking={booking}
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />
    </div>
  );
}
