"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { ReservationCardData } from "./reservation-card";
import type { TaxInvoiceData } from "@/lib/tax/types";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CANCEL BOOKING CONFIRMATION MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface CancelBookingModalProps {
  booking: ReservationCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: (bookingId: string) => void;
}

export function CancelBookingModal({
  booking,
  isOpen,
  onClose,
  onCancelled,
}: CancelBookingModalProps) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !booking) return null;

  const handleConfirmCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          (typeof data?.error === "string" ? data.error : null) ||
          t("booking_details_failed_cancel", "Failed to cancel reservation");
        throw new Error(errorMsg);
      }

      onCancelled(booking.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("booking_details_unexpected_error", "An unexpected error occurred."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl transition-all"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close dialog"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#727272] hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2
              id="cancel-modal-title"
              className="text-xl font-semibold text-[#1F1F1F]"
            >
              {t("booking_details_cancel_modal_title", "Cancel reservation?")}
            </h2>
            <p className="text-xs text-[#727272]">
              {t("booking_details_cancel_modal_ref", { code: booking.id.slice(-8).toUpperCase() }, "Reference #{code}")}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#d7d7d7] bg-zinc-50/80 p-4">
          <h3 className="font-semibold text-sm text-[#1F1F1F] line-clamp-1">
            {booking.propertyName}
          </h3>
          <p className="text-xs text-zinc-600 mt-0.5">{booking.location}</p>
        </div>

        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          {booking.isNonRefundable ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900">
              <span className="font-semibold">{t("booking_details_non_ref_tag", "Non-refundable booking:")}</span>{" "}
              {t("booking_details_non_ref_desc", "This reservation was confirmed under non-refundable rate terms. No refund will be issued upon cancellation.")}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">
              {t("booking_details_flex_modal_notice", {
                policy: booking.cancellationPolicy || "Flexible",
              }, "Cancellation is governed by the host's standard policy ({policy}). Please review your stay terms before confirming.")}
            </p>
          )}

          <p className="text-xs text-[#727272]">
            {t("booking_details_cancel_notice", "Once cancelled, your reserved dates will be released and this action cannot be undone.")}
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            {t("booking_details_keep_reservation", "Keep reservation")}
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={submitting}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-white shadow-xs hover:bg-red-700 disabled:bg-red-300 cursor-pointer"
          >
            {submitting ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>{t("booking_details_cancelling", "Cancelling...")}</span>
              </>
            ) : (
              <span>{t("booking_details_confirm_cancellation", "Confirm cancellation")}</span>
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OFFICIAL RECEIPT / TAX INVOICE MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptModal({
  bookingId,
  isOpen,
  onClose,
}: ReceiptModalProps) {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [invoice, setInvoice] = useState<TaxInvoiceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setInvoice(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/taxes/invoices/${bookingId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errorMsg =
            json?.error?.message ||
            (typeof json?.error === "string" ? json.error : null) ||
            t("booking_details_failed_tax_invoice", "Failed to load tax invoice.");
          throw new Error(errorMsg);
        }
        return json.data !== undefined ? json.data : json;
      })
      .then((data) => {
        if (isMounted) setInvoice(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || t("booking_details_failed_receipt", "Failed to load receipt."));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        className="relative my-8 w-full max-w-2xl rounded-[20px] bg-white p-6 sm:p-9 shadow-2xl transition-all"
      >
        <div className="flex items-start justify-between border-b border-[#d7d7d7] pb-5">
          <div>
            <span className="text-xs font-semibold tracking-wider text-emerald-700 uppercase">
              {t("booking_details_official_receipt", "Official Tax Invoice & Receipt")}
            </span>
            <h2
              id="receipt-modal-title"
              className="mt-1 text-xl font-medium tracking-tight text-[#1F1F1F]"
            >
              {invoice?.invoiceNumber || t("booking_details_booking_receipt", "Booking Receipt")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#727272] hover:bg-zinc-100 hover:text-zinc-800"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <svg
              className="mx-auto h-8 w-8 animate-spin text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-[#727272]">
              {t("booking_details_generating_receipt", "Generating authoritative receipt...")}
            </p>
          </div>
        ) : error ? (
          <div className="my-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white"
            >
              {t("booking_details_dismiss", "Dismiss")}
            </button>
          </div>
        ) : invoice ? (
          <div className="mt-6 space-y-6 text-[#1F1F1F]">
            {/* Header Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
              <div>
                <span className="text-[#727272] block">{t("booking_details_issue_date", "Issue Date")}</span>
                <span className="font-medium">
                  {invoice.issueDate
                    ? new Date(invoice.issueDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-[#727272] block">{t("booking_details_booking_reference", "Booking Reference")}</span>
                <span className="font-mono font-medium">
                  {(invoice.bookingId || bookingId || "")
                    .slice(-8)
                    .toUpperCase()}
                </span>
              </div>
            </div>

            {/* Parties */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-white rounded-lg shadow-[0px_2px_4px_0px_#00000040] bg-[#F3F4F5] p-4 text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-zinc-800 block mb-1">
                  {t("booking_details_supplier", "Host / Supplier")}
                </span>
                <p className="font-medium text-[#1F1F1F]">
                  {invoice.supplier?.name || "Host"}
                </p>
                {invoice.supplier?.taxId && (
                  <p className="text-[#727272] text-xs sm:text-sm">
                    VAT: {invoice.supplier.taxId}
                  </p>
                )}
                {invoice.supplier?.address && (
                  <p className="text-[#727272] text-xs sm:text-sm">
                    {invoice.supplier.address}
                  </p>
                )}
              </div>
              <div>
                <span className="font-semibold text-zinc-800 block mb-1">
                  {t("booking_details_guest_label", "Guest")}
                </span>
                <p className="font-medium text-[#1F1F1F]">
                  {invoice.guest?.name || "Guest"}
                </p>
                <p className="text-[#727272] text-xs sm:text-sm">
                  {invoice.guest?.email || ""}
                </p>
              </div>
            </div>

            {/* Stay Details */}
                <div className="rounded-lg border border-white bg-[#F3F4F5] shadow-[0px_2px_4px_0px_#00000040] p-4 text-xs sm:text-sm space-y-1">
              <span className="font-semibold text-zinc-800 block mb-1">
                {t("booking_details_property_stay", "Property & Stay")}
              </span>
              <p className="font-medium text-[#1F1F1F]">
                {invoice.property?.title || "Property Stay"}
              </p>
              {invoice.property && (
                <p className="text-[#727272]">
                  {[
                    invoice.property.address,
                    invoice.property.city,
                    invoice.property.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {invoice.stayDates && (
                <p className="text-zinc-600 pt-1 font-medium">
                  {invoice.stayDates.checkIn} – {invoice.stayDates.checkOut} (
                  {invoice.stayDates.nights}{" "}
                  {invoice.stayDates.nights === 1 ? t("booking_details_night_singular", "night") : t("booking_details_nights_plural", "nights")})
                </p>
              )}
            </div>

            {/* Line Items Table */}
            <div className="overflow-hidden rounded-lg border border-[#d7d7d7]">
              <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#F3F4F5] text-zinc-700">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">{t("booking_details_description", "Description")}</th>
                    <th className="px-4 py-2.5 font-semibold text-center">
                      {t("booking_details_qty", "Qty")}
                    </th>
                    <th className="px-4 py-2.5 font-semibold text-right">
                      {t("booking_details_amount", "Amount")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(invoice.lineItems || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2.5">{item.description}</td>
                      <td className="px-4 py-2.5 text-center text-[#727272]">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatPrice(item.total, invoice.currency || "SAR")}
                      </td>
                    </tr>
                  ))}
                  {(invoice.taxBreakdown || []).map((tax, idx) => (
                    <tr key={`tax-${idx}`} className="text-zinc-600">
                      <td className="px-4 py-2">
                        {tax.taxName}
                      </td>
                      <td className="px-4 py-2 text-center">—</td>
                      <td className="px-4 py-2 text-right">
                        {formatPrice(tax.taxAmount, invoice.currency || "SAR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold text-[#1F1F1F]">
                  <tr>
                    <td className="px-4 py-3" colSpan={2}>
                      {t("booking_details_grand_total", "Grand Total Paid")}
                    </td>
                    <td className="px-4 py-3 text-right text-base text-emerald-700 font-semibold">
                      {formatPrice(
                        invoice.grandTotal ?? 0,
                        invoice.currency || "SAR",
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[#727272]">
                {t("booking_details_authorized_receipt_note", "Authorized electronic receipt generated by Homyz")}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1f1f1f] px-4 py-2 text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  <span>{t("booking_details_print_pdf", "Print / PDF")}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full bg-[#FCDF9C] px-5 py-2 text-base font-medium text-[#1f1f1f] hover:text-white hover:bg-[#1f1f1f] transition-colors"
                >
                  {t("booking_details_done", "Done")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ModalOverlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CONTACT HOST MODAL (SPEC 1.10 - REPORTING DEPENDENCY ACCURATELY)
// ─────────────────────────────────────────────────────────────────────────────

interface ContactHostModalProps {
  booking: ReservationCardData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContactHostModal({
  booking,
  isOpen,
  onClose,
}: ContactHostModalProps) {
  const { t } = useLanguage();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  return (
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl transition-all"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#727272] hover:bg-zinc-100 hover:text-zinc-800"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <h2
              id="contact-modal-title"
              className="text-xl font-semibold text-[#1F1F1F]"
            >
              {t("booking_details_contact_host_title", "Contact Host")}
            </h2>
            <p className="text-xs text-[#727272]">
              {t("booking_details_booking_ref_short", { code: booking.id.slice(-8).toUpperCase() }, "Booking #{code}")}
            </p>
          </div>
        </div>

        <div className="mt-4 sm:rounded-2xl rounded-lg shadow-md bg-white p-4">
          <p className="text-xs font-semibold text-zinc-800 line-clamp-1">{booking.propertyName}</p>
          <p className="text-xs text-[#727272]">{booking.location}</p>
        </div>

        <div className="mt-4 space-y-3 text-xs sm:text-sm text-zinc-600 leading-relaxed">
          <p>
            {t("booking_details_contact_host_notice", "Direct peer-to-peer guest messaging is currently being finalized. To protect host and guest privacy, private personal contact details are kept secure.")}
          </p>
          <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-xs text-blue-900">
            <span className="font-semibold block mb-0.5">
              {t("booking_details_immediate_assist", "Need immediate assistance with this stay?")}
            </span>
            {t("booking_details_concierge_liaise", "Our 24/7 Concierge & Support desk can liaise directly with your host regarding arrival check-in, key handover, or special accommodation requests.")}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-700 hover:bg-[#1f1f1f] hover:text-white transition-colors duration-300"
          >
            {t("booking_details_close", "Close")}
          </button>
          <Link
            href="/messages"
            onClick={onClose}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#FCDF9C] px-6 text-sm font-medium text-[#1F1F1F] hover:bg-[#1f1f1f] hover:text-white transition-colors duration-300"
          >
            <span>{t("booking_details_message_host_btn", "Message Host")}</span>
          </Link>
        </div>
      </div>
    </ModalOverlay>
  );
}
