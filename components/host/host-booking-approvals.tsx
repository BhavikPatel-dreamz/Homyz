"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";

import { formatExpiryCountdown } from "@/lib/booking/booking-expiry";
import { formatBookingDate } from "@/lib/booking/booking-date";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";

export type PendingBooking = {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  totalPrice?: number | null;
  currency?: string;
  status?: string;
  createdAt: string;
  expiresAt?: string;
  isExpired?: boolean;
  guest: { name: string | null; image: string | null };
  listing: { title: string; city: string | null; country: string | null; photos: string[] };
};

export type HostBookingRequestDetails = {
  id: string;
  startDate: string;
  endDate: string;
  guests: number;
  totalPrice: number | null;
  nightlyPrice: number | null;
  currency: string;
  status: string;
  cancellationPolicy: string | null;
  isNonRefundable: boolean;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  guest: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
    createdAt: string;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    address: string | null;
    photos: string[];
    price: number;
  };
  guestMessage: string | null;
  conversationId: string | null;
  priceBreakdown: any;
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatDeadlineCountdown(createdAtStr: string): { text: string; isExpired: boolean; isUrgent: boolean } {
  return formatExpiryCountdown(createdAtStr);
}

export function HostBookingApprovals({ bookings: initialBookings }: { bookings: PendingBooking[] }) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const formatMoney = (amount: number | null | undefined, sourceCurrency = "SAR") =>
    amount == null ? "—" : formatPrice(amount, sourceCurrency, 2);
  const router = useRouter();
  const [bookings, setBookings] = useState<PendingBooking[]>(initialBookings);

  // Sync state if initialBookings updates
  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  // Bulk confirmation state
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Single request details modal state
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [details, setDetails] = useState<HostBookingRequestDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Action states
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptPaymentNotice, setAcceptPaymentNotice] = useState<string | null>(null);

  // General alert feedback
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Open detail modal and fetch full request details
  const openRequestDetails = async (booking: PendingBooking) => {
    setSelectedBookingId(booking.id);
    setDetails(null);
    setDetailsError(null);
    setAcceptPaymentNotice(null);
    setDetailsLoading(true);

    try {
      const res = await fetch(`/api/v1/host/bookings/${booking.id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to load booking request details.");
      }
      setDetails(data.data || data);
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to load booking request details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetailsModal = () => {
    setSelectedBookingId(null);
    setDetails(null);
    setDetailsError(null);
    setAcceptPaymentNotice(null);
    setIsRejectOpen(false);
    setRejectReason("");
  };

  // Accept action: fail-closed payment authorization gate
  const handleAccept = async () => {
    if (!selectedBookingId) return;
    setIsAccepting(true);
    setAcceptPaymentNotice(null);
    setDetailsError(null);

    try {
      const res = await fetch(`/api/v1/host/bookings/${selectedBookingId}/accept`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Payment gate fail-closed handling
        const code = data?.error?.code;
        const msg = data?.error?.message;
        if (code === "PAYMENT_AUTHORIZATION_REQUIRED" || msg?.includes("payment")) {
          setAcceptPaymentNotice(
            "Payment authorization is required before this booking request can be accepted. Payment capture is currently blocked by provider.",
          );
        } else {
          setDetailsError(msg || "Unable to accept this booking request.");
        }
        return;
      }

      setSuccessMessage("Booking request accepted successfully!");
      setBookings((prev) => prev.filter((b) => b.id !== selectedBookingId));
      closeDetailsModal();
      router.refresh();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "An unexpected error occurred while accepting.");
    } finally {
      setIsAccepting(false);
    }
  };

  // Reject action: decline booking and release inventory
  const handleReject = async () => {
    if (!selectedBookingId) return;
    setIsRejecting(true);
    setDetailsError(null);

    try {
      const res = await fetch(`/api/v1/host/bookings/${selectedBookingId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to decline booking request.");
      }

      setSuccessMessage("Booking request declined. The dates have been released back to your calendar.");
      setBookings((prev) => prev.filter((b) => b.id !== selectedBookingId));
      closeDetailsModal();
      router.refresh();
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "An error occurred while declining the request.");
    } finally {
      setIsRejecting(false);
    }
  };

  // Approve all (bulk)
  const approveAll = async () => {
    setIsBulkSubmitting(true);
    setGlobalError(null);
    try {
      const response = await fetch("/api/v1/host/bookings/approve-all", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to approve bookings right now.");
      setIsBulkConfirmOpen(false);
      setSuccessMessage("All pending bookings have been confirmed.");
      router.refresh();
    } catch (approvalError) {
      setGlobalError(approvalError instanceof Error ? approvalError.message : "Unable to approve bookings right now.");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl py-8 sm:py-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-zinc-200 pb-7">
        <div>
          <p className="text-sm font-medium text-zinc-500">{t("host_booking_approvals_tools", "Host tools")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
            {t("host_booking_approvals_title", "Pending booking requests")}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {t("host_booking_approvals_desc", "Review active requests for your listings, communicate with guests, and respond within 24 hours.")}
          </p>
        </div>
        {bookings.length > 0 && (
          <button
            type="button"
            onClick={() => setIsBulkConfirmOpen(true)}
            className="min-h-11 rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-200"
          >
            {t("host_booking_approvals_approve_all", `Approve all (${bookings.length})`).replace("{count}", String(bookings.length))}
          </button>
        )}
      </div>

      {/* Global Alerts */}
      {globalError && (
        <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {globalError}
        </div>
      )}
      {successMessage && (
        <div role="status" className="mt-6 flex items-center justify-between rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-semibold uppercase tracking-wider text-emerald-700 hover:underline"
          >
            {t("host_booking_approvals_dismiss", "Dismiss")}
          </button>
        </div>
      )}

      {/* Requests List */}
      {bookings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-zinc-900">{t("host_booking_approvals_no_requests", "No pending booking requests")}</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {t("host_booking_approvals_no_requests_desc", "New requests will appear here when guests request a stay at one of your listings.")}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map((booking) => {
            const location = [booking.listing.city, booking.listing.country].filter(Boolean).join(", ");
            const deadline = formatDeadlineCountdown(booking.createdAt);

            return (
              <article
                key={booking.id}
                className="flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  {/* Photo & Badge */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-zinc-100">
                    {booking.listing.photos[0] ? (
                      <img
                        src={booking.listing.photos[0]}
                        alt={booking.listing.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
                        {t("host_booking_approvals_photo_unavailable", "Photo unavailable")}
                      </div>
                    )}
                    {deadline.isExpired || booking.isExpired ? (
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-zinc-700/90 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                        {t("host_booking_approvals_expired", "Expired")}
                      </span>
                    ) : (
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-amber-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                        {t("host_booking_approvals_pending", "Pending approval")}
                      </span>
                    )}
                  </div>

                  {/* Title & Location */}
                  <h2 className="mt-4 truncate text-lg font-semibold text-zinc-900" title={booking.listing.title}>
                    {booking.listing.title}
                  </h2>
                  {location && <p className="mt-0.5 truncate text-sm text-zinc-500">{location}</p>}

                  {/* Deadline & Requested Time */}
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-100 pt-3">
                    <span>{t("host_booking_approvals_requested_ago", `Requested ${formatTimeAgo(booking.createdAt)}`).replace("{time}", formatTimeAgo(booking.createdAt))}</span>
                    <span
                      className={`font-medium ${
                        deadline.isExpired
                          ? "text-red-600"
                          : deadline.isUrgent
                          ? "text-amber-600"
                          : "text-zinc-600"
                      }`}
                    >
                      {deadline.text}
                    </span>
                  </div>

                  {/* Booking Details Grid */}
                  <dl className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3.5 text-xs sm:text-sm">
                    <div>
                      <dt className="text-zinc-500">{t("host_booking_approvals_guest", "Guest")}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900 truncate">
                        {booking.guest.name || t("host_booking_approvals_guest", "Guest")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">{t("host_booking_details_guests", "Guests")}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900">
                        {t("host_booking_approvals_guests", `${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}`)
                          .replace("{count}", String(booking.guests))
                          .replace("{unit}", booking.guests === 1 ? t("host_booking_approvals_unit_guest", "guest") : t("host_booking_approvals_unit_guests", "guests"))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">{t("host_booking_approvals_checkin", "Check-in")}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900">{formatBookingDate(booking.startDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">{t("host_booking_approvals_checkout", "Check-out")}</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900">{formatBookingDate(booking.endDate)}</dd>
                    </div>
                  </dl>

                  {/* Pricing row */}
                  {booking.totalPrice != null && (
                    <div className="mt-3 flex items-center justify-between px-1">
                      <span className="text-xs text-zinc-500">{t("host_booking_approvals_total_amount", "Total amount")}</span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {formatMoney(booking.totalPrice, booking.currency || "SAR")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary CTA */}
                <div className="mt-5 border-t border-zinc-100 pt-4">
                  <button
                    type="button"
                    onClick={() => openRequestDetails(booking)}
                    className="w-full min-h-11 rounded-xl bg-[#1F1F1F] px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
                  >
                    {t("host_booking_approvals_view_request", "View request")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* REQUEST DETAILS MODAL */}
      {selectedBookingId && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-details-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div className="flex items-center gap-3">
                {details?.isExpired ? (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 border border-zinc-200">
                    {t("host_booking_approvals_expired", "Expired")}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    {t("host_booking_approvals_pending", "Pending approval")}
                  </span>
                )}
                <h2 id="request-details-title" className="text-lg font-semibold text-zinc-900">
                  {t("host_booking_approvals_details_title", "Booking Request Details")}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close dialog"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {detailsLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent mb-3" />
                  <p className="text-sm">{t("host_booking_approvals_loading", "Loading request details...")}</p>
                </div>
              )}

              {detailsError && (
                <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                  {detailsError}
                </div>
              )}

              {acceptPaymentNotice && (
                <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200">
                  <div className="flex items-start gap-2.5">
                    <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-semibold">{t("host_booking_approvals_payment_notice_title", "Payment Authorization Required")}</p>
                      <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                        {t("host_booking_approvals_payment_notice_desc", "Payment authorization is required before this booking request can be accepted. Payment capture is currently blocked by provider.")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {details && (
                <>
                  {/* Expired Request Notice */}
                  {details.isExpired && (
                    <div role="status" className="rounded-2xl bg-zinc-100 p-4 border border-zinc-200 text-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-zinc-500" />
                        <p className="font-semibold text-sm">{t("host_booking_approvals_deadline_expired_title", "Response deadline expired")}</p>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                        {t("host_booking_approvals_deadline_expired_desc", "The 24-hour response window for this booking request has passed. The temporary date hold has been released back to your calendar.")}
                      </p>
                    </div>
                  )}
                  {/* Property Section */}
                  <div className="flex gap-4 items-start rounded-2xl bg-zinc-50 p-4 border border-zinc-200">
                    {details.listing.photos[0] ? (
                      <img
                        src={details.listing.photos[0]}
                        alt={details.listing.title}
                        className="h-20 w-28 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-20 w-28 items-center justify-center rounded-xl bg-zinc-200 text-xs text-zinc-500 flex-shrink-0">
                        {t("host_booking_approvals_no_photo", "No photo")}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{t("host_booking_approvals_property", "Property")}</p>
                      <h3 className="text-base font-semibold text-zinc-900 truncate">{details.listing.title}</h3>
                      <p className="text-xs text-zinc-600 truncate mt-0.5">
                        {[details.listing.address, details.listing.city, details.listing.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>

                  {/* Guest Information */}
                  <div className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4">
                    <div className="flex items-center gap-3">
                      {details.guest.image ? (
                        <img
                          src={details.guest.image}
                          alt={details.guest.name || "Guest"}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700">
                          {(details.guest.name || "G")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-zinc-900">{details.guest.name || t("host_booking_approvals_guest", "Guest")}</h4>
                        <p className="text-xs text-zinc-500">
                          {t("host_booking_approvals_member_since", `Member since ${new Date(details.guest.createdAt).getFullYear()}`).replace("{year}", String(new Date(details.guest.createdAt).getFullYear()))}
                        </p>
                      </div>
                    </div>

                    {details.conversationId ? (
                      <Link
                        href={`/host/messages?conversationId=${details.conversationId}`}
                        className="rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        {t("host_booking_approvals_message_guest", "Message guest")}
                      </Link>
                    ) : (
                      <Link
                        href="/host/messages"
                        className="rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        {t("host_booking_approvals_message_guest", "Message guest")}
                      </Link>
                    )}
                  </div>

                  {/* Trip Details */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">{t("host_booking_approvals_trip_details", "Trip details")}</h4>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-zinc-50 p-4 text-sm">
                      <div>
                        <dt className="text-xs text-zinc-500">{t("host_booking_approvals_checkin", "Check-in")}</dt>
                        <dd className="mt-1 font-semibold text-zinc-900">{formatBookingDate(details.startDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">{t("host_booking_approvals_checkout", "Check-out")}</dt>
                        <dd className="mt-1 font-semibold text-zinc-900">{formatBookingDate(details.endDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">{t("host_booking_details_guests", "Guests")}</dt>
                        <dd className="mt-1 font-semibold text-zinc-900">
                          {t("host_booking_approvals_guests", `${details.guests} ${details.guests === 1 ? "guest" : "guests"}`)
                            .replace("{count}", String(details.guests))
                            .replace("{unit}", details.guests === 1 ? t("host_booking_approvals_unit_guest", "guest") : t("host_booking_approvals_unit_guests", "guests"))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">{t("host_booking_approvals_response_deadline", "Response deadline")}</dt>
                        <dd className="mt-1 font-semibold text-amber-700">
                          {formatDeadlineCountdown(details.createdAt).text}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Guest Message */}
                  {details.guestMessage && (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
                        {t("host_booking_approvals_message_from_guest", "Message from guest")}
                      </p>
                      <p className="mt-2 text-sm text-zinc-800 italic whitespace-pre-wrap leading-relaxed">
                        "{details.guestMessage}"
                      </p>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">{t("host_booking_approvals_price_breakdown", "Price breakdown")}</h4>
                    <div className="rounded-2xl border border-zinc-200 p-4 text-sm space-y-2.5">
                      {details.nightlyPrice != null && (
                        <div className="flex justify-between text-zinc-600 text-xs sm:text-sm">
                          <span>{t("host_booking_approvals_nightly_rate", "Nightly rate")}</span>
                          <span>{formatMoney(details.nightlyPrice, details.currency)} / night</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-zinc-200 pt-3 font-semibold text-zinc-900 text-base">
                        <span>{t("host_booking_approvals_total_guest_pays", "Total (guest pays)")}</span>
                        <span className="text-lg font-bold">{formatMoney(details.totalPrice, details.currency)}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {t("host_booking_approvals_payment_status_deferred", "Payment status: Deferred (no online payment gateway required).")}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions Footer */}
            {details && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                {details.isExpired ? (
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-zinc-500">
                      {t("host_booking_approvals_request_expired_msg", "This request has expired and can no longer be accepted.")}
                    </span>
                    <button
                      type="button"
                      onClick={closeDetailsModal}
                      className="min-h-11 rounded-xl bg-[#1F1F1F] px-6 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
                    >
                      {t("host_booking_approvals_close", "Close")}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isAccepting || isRejecting}
                      onClick={() => setIsRejectOpen(true)}
                      className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {t("host_booking_approvals_decline_request", "Decline request")}
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={isAccepting || isRejecting}
                        onClick={closeDetailsModal}
                        className="min-h-11 rounded-xl px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-200/60"
                      >
                        {t("host_booking_approvals_close", "Close")}
                      </button>
                      <button
                        type="button"
                        disabled={isAccepting || isRejecting}
                        onClick={handleAccept}
                        className="min-h-11 rounded-xl bg-[#1F1F1F] px-6 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:bg-zinc-400"
                      >
                        {isAccepting ? t("host_booking_approvals_validating", "Validating…") : t("host_booking_approvals_accept_request", "Accept request")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* REJECT CONFIRMATION MODAL */}
      {isRejectOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-dialog-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 id="reject-dialog-title" className="text-xl font-semibold text-zinc-900">
              {t("host_booking_approvals_decline_modal_title", "Decline booking request?")}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
              {t("host_booking_approvals_decline_modal_desc", "Declining this request will cancel the reservation and release the held dates back to your calendar.")}
            </p>

            <div className="mt-4">
              <label htmlFor="reject-reason" className="block text-xs font-medium text-zinc-700 mb-1.5">
                {t("host_booking_approvals_decline_reason_label", "Reason for declining (optional, sent to guest):")}
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                maxLength={500}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("host_booking_approvals_decline_reason_ph", "Let the guest know why you cannot accommodate them...")}
                className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isRejecting}
                onClick={() => setIsRejectOpen(false)}
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                {t("host_booking_approvals_cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={handleReject}
                className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {isRejecting ? t("host_booking_approvals_declining", "Declining…") : t("host_booking_approvals_confirm_decline", "Confirm Decline")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* BULK APPROVE MODAL */}
      {isBulkConfirmOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-bookings-title"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 id="approve-bookings-title" className="text-xl font-semibold text-zinc-900">
              {t("host_booking_approvals_bulk_modal_title", "Approve all pending bookings?")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {t("host_booking_approvals_bulk_modal_desc", `This will confirm ${bookings.length} active pending bookings. Guests will see the updated status immediately.`).replace("{count}", String(bookings.length))}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isBulkSubmitting}
                onClick={() => setIsBulkConfirmOpen(false)}
                className="min-h-11 rounded-xl px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                {t("host_booking_approvals_cancel", "Cancel")}
              </button>
              <button
                type="button"
                disabled={isBulkSubmitting}
                onClick={approveAll}
                className="min-h-11 rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:bg-zinc-300"
              >
                {isBulkSubmitting ? t("host_booking_approvals_bulk_approving", "Approving…") : t("host_booking_approvals_bulk_approve_btn", "Approve all")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
