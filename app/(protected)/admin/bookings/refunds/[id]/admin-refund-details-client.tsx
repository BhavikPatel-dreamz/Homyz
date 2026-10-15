"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";

interface RefundDetails {
  refund: {
    id: string;
    refundReference: string | null;
    bookingId: string;
    paymentId: string | null;
    status: string;
    amount: number; // minor units (cents)
    currency: string;
    reason: string | null;
    failureReason: string | null;
    adminNotes: string | null;
    requestedById: string | null;
    approvedById: string | null;
    providerRefundId: string | null;
    createdAt: string;
    updatedAt: string;
    processedAt: string | null;
    succeededAt: string | null;
    failedAt: string | null;
    refundType: string;
    capturedAmountSnapshot: number;
    remainingRefundableBalance: number;
    metadata: Record<string, any>;
  };
  booking: {
    id: string;
    submissionId: string | null;
    status: string;
    startDate: string;
    endDate: string;
    totalPrice: number | null;
    currency: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      phone: string | null;
    };
    listing: {
      id: string;
      title: string;
      city: string | null;
      country: string | null;
      photos: string[];
      cancellationPolicy: string;
      host: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      };
    };
    payments: any[];
    refunds: any[];
  };
  payment: {
    id: string;
    provider: string;
    providerPaymentId: string | null;
    status: string;
    amount: number;
    capturedAmount: number;
    refundedAmount: number;
    currency: string;
    paymentMethod: string | null;
    createdAt: string;
  } | null;
  auditLogs: {
    id: string;
    action: string;
    description: string;
    actorEmail: string | null;
    createdAt: string;
    metadata: any;
  }[];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

function formatDateTime(val: string | Date | null | undefined) {
  if (!val) return "—";
  try {
    return dateTimeFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

function getDurationNights(start: string, end: string) {
  try {
    const d1 = new Date(start).getTime();
    const d2 = new Date(end).getTime();
    return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
  } catch {
    return 1;
  }
}

export function AdminRefundDetailsClient({
  initialData,
}: {
  initialData: RefundDetails;
}) {
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [data, setData] = useState<RefundDetails>(initialData);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [confirmProcessCheck, setConfirmProcessCheck] = useState(false);

  const refund = data.refund;
  const booking = data.booking;
  const payment = data.payment;
  const calculation = refund.metadata?.calculation;
  const isApproved = Boolean(refund.approvedById);
  const isPending = refund.status === "PENDING";
  const isSucceeded = refund.status === "SUCCEEDED";
  const isRejected = refund.status === "REJECTED";
  const isFailed = refund.status === "FAILED";

  // Helper for minor units display
  const refundAmountMajor = (refund.amount || 0) / 100;
  const capturedAmountMajor = (payment?.capturedAmount ?? refund.capturedAmountSnapshot ?? 0) / 100;
  const refundedAmountMajor = (payment?.refundedAmount ?? 0) / 100;
  const remainingBalanceMajor = Math.max(0, capturedAmountMajor - refundedAmountMajor);

  // Handle Approve
  const handleApprove = async () => {
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/refunds/${refund.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: approveNotes }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to approve refund");
      }
      setActionSuccess("Refund request successfully approved!");
      setApproveModalOpen(false);
      // Update local state
      setData((prev) => ({
        ...prev,
        refund: {
          ...prev.refund,
          approvedById: resData.approvedById || "approved",
          adminNotes: approveNotes || prev.refund.adminNotes,
        },
      }));
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to approve refund");
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError("A rejection reason is required.");
      return;
    }
    setLoadingAction(true);
    setActionError(null);
    setRejectError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/refunds/${refund.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to reject refund");
      }
      setActionSuccess("Refund request has been rejected.");
      setRejectModalOpen(false);
      setData((prev) => ({
        ...prev,
        refund: {
          ...prev.refund,
          status: "REJECTED",
          failureReason: rejectReason,
        },
      }));
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to reject refund");
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Process
  const handleProcess = async () => {
    if (!confirmProcessCheck) {
      setActionError("Please confirm that you understand this executes a real refund settlement.");
      return;
    }
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/refunds/${refund.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: `proc_${refund.id}_${Date.now()}` }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to process refund settlement");
      }
      setActionSuccess("Refund successfully processed and settled via payment provider!");
      setProcessModalOpen(false);
      setData((prev) => ({
        ...prev,
        refund: {
          ...prev.refund,
          status: "SUCCEEDED",
          providerRefundId: resData.providerRefundId,
          processedAt: resData.processedAt,
          succeededAt: resData.succeededAt,
        },
      }));
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to process refund settlement");
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Reconcile
  const handleReconcile = async () => {
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/refunds/${refund.id}/reconcile`, {
        method: "POST",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to reconcile refund");
      if (resData.reconciled) {
        setActionSuccess("Refund transaction is fully reconciled with payment state. No discrepancies found.");
      } else {
        setActionError(`Reconciliation issues detected: ${resData.issues?.join("; ") || "Unknown issue"}`);
      }
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to reconcile refund");
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bookings/refunds"
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              ← Refunds Queue
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {refund.refundReference || refund.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1>
              Refund Request: {refund.refundReference || refund.id}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                refund.status === "SUCCEEDED"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : refund.status === "PENDING"
                  ? isApproved
                    ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  : refund.status === "PROCESSING"
                  ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                  : refund.status === "REJECTED"
                  ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  : "bg-red-500/10 text-red-600 border border-red-500/20"
              }`}
            >
              {refund.status === "PENDING" && isApproved ? "APPROVED (READY TO PROCESS)" : refund.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/bookings/all"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>All Bookings</span>
          </Link>
          <Link
            href="/admin/bookings/cancellations"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Cancellations</span>
          </Link>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-800 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-800 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols on lg) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section 1: Refund Calculation & Policy Snapshot */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Refund Calculation & Policy Engine Snapshot
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-md bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-mono">
                {refund.refundType} REFUND
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)] font-medium">Requested Amount</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">
                  {formatPrice(refundAmountMajor, refund.currency)}
                </p>
                <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">
                  ({refund.amount.toLocaleString()} minor units)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)] font-medium">Policy Evaluated</p>
                <p className="text-sm font-bold text-foreground mt-1">
                  {calculation?.policyName || booking.listing.cancellationPolicy || "STANDARD"}
                </p>
                <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">
                  Version: {calculation?.policyVersion || "v1"}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <p className="text-xs text-[var(--muted-foreground)] font-medium">Eligibility Status</p>
                <p className={`text-sm font-bold mt-1 ${calculation?.isEligible ? "text-emerald-600" : "text-amber-600"}`}>
                  {calculation?.isEligible ? "ELIGIBLE" : "RESTRICTED / REVIEW"}
                </p>
                <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">
                  {calculation?.reason || (calculation?.isOverride ? "Admin Discretionary Override" : "Standard rules")}
                </p>
              </div>
            </div>

            {/* Breakdown table if calculation details exist */}
            {calculation && (
              <div className="border border-[var(--border)] rounded-xl overflow-hidden mb-5">
                <div className="bg-[var(--surface-secondary)] px-4 py-2.5 text-xs font-semibold text-foreground">
                  Policy Breakdown Items
                </div>
                <div className="divide-y divide-[var(--border)] text-xs">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[var(--muted-foreground)]">Guest Nights Refund</span>
                    <span className="font-semibold text-foreground">
                      {formatPrice((calculation.breakdown?.nightsRefundMinor || 0) / 100, refund.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[var(--muted-foreground)]">Cleaning Fee Refund</span>
                    <span className="font-semibold text-foreground">
                      {formatPrice((calculation.breakdown?.cleaningFeeRefundMinor || 0) / 100, refund.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[var(--muted-foreground)]">Platform Service Fee Refund</span>
                    <span className="font-semibold text-foreground">
                      {formatPrice((calculation.breakdown?.platformFeeRefundMinor || 0) / 100, refund.currency)}
                    </span>
                  </div>
                  {calculation.breakdown?.hostCompensationMinor ? (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/5">
                      <span className="text-amber-700">Host Payout Retained / Compensation</span>
                      <span className="font-semibold text-amber-700">
                        {formatPrice(calculation.breakdown.hostCompensationMinor / 100, refund.currency)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-secondary)]/30 font-bold">
                    <span className="text-foreground">Net Eligible Refund Total</span>
                    <span className="text-foreground text-sm">
                      {formatPrice((calculation.eligibleAmountMinor || 0) / 100, refund.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Request Reason & Admin Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Reason for Request:</p>
                <div className="p-3 rounded-xl bg-[var(--surface-secondary)] text-xs text-[var(--muted-foreground)] min-h-[60px]">
                  {refund.reason || "No explicit reason specified."}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Administrative Notes:</p>
                <div className="p-3 rounded-xl bg-[var(--surface-secondary)] text-xs text-[var(--muted-foreground)] min-h-[60px]">
                  {refund.adminNotes || "No administrator notes recorded."}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Associated Booking Details */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H7" />
                </svg>
                Booking Information
              </h2>
              <span className="text-xs font-mono text-[var(--muted-foreground)]">
                Booking ID: {booking.id}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div className="relative w-full sm:w-36 h-28 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-[var(--border)]">
                {booking.listing.photos?.[0] ? (
                  <Image
                    src={booking.listing.photos[0]}
                    alt={booking.listing.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">
                    No photo
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {booking.listing.title}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {booking.listing.city || "Unknown City"}, {booking.listing.country || "Saudi Arabia"}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Check-in</span>
                    <span className="font-semibold text-foreground">{formatDate(booking.startDate)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Check-out</span>
                    <span className="font-semibold text-foreground">{formatDate(booking.endDate)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Duration</span>
                    <span className="font-semibold text-foreground">
                      {getDurationNights(booking.startDate, booking.endDate)} nights
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Booking Status</span>
                    <span className="font-semibold uppercase text-foreground">{booking.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guest & Host Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-[var(--border)]">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden relative shrink-0">
                  {booking.user.image ? (
                    <Image src={booking.user.image} alt={booking.user.name || "Guest"} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-zinc-600 text-sm">
                      {booking.user.name?.charAt(0) || "G"}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-2xs text-[var(--muted-foreground)] uppercase font-bold tracking-wider block">Guest</span>
                  <p className="text-xs font-semibold text-foreground">{booking.user.name || "Unknown Guest"}</p>
                  <p className="text-2xs text-[var(--muted-foreground)]">{booking.user.email || "No email"}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden relative shrink-0">
                  {booking.listing.host.image ? (
                    <Image src={booking.listing.host.image} alt={booking.listing.host.name || "Host"} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-zinc-600 text-sm">
                      {booking.listing.host.name?.charAt(0) || "H"}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-2xs text-[var(--muted-foreground)] uppercase font-bold tracking-wider block">Host</span>
                  <p className="text-xs font-semibold text-foreground">{booking.listing.host.name || "Unknown Host"}</p>
                  <p className="text-2xs text-[var(--muted-foreground)]">{booking.listing.host.email || "No email"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Original Payment Record */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Original Captured Payment Transaction
              </h2>
              <span className="text-xs font-mono text-[var(--muted-foreground)]">
                {payment?.provider || "MOCK"} • {payment?.status || "UNKNOWN"}
              </span>
            </div>

            {payment ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[var(--muted-foreground)] block">Payment ID</span>
                  <span className="font-mono text-2xs text-foreground block truncate" title={payment.id}>
                    {payment.id}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">Captured Amount</span>
                  <span className="font-semibold text-foreground">
                    {formatPrice(payment.capturedAmount / 100, payment.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">Previously Refunded</span>
                  <span className="font-semibold text-foreground">
                    {formatPrice(payment.refundedAmount / 100, payment.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">Available Balance</span>
                  <span className="font-semibold text-emerald-600">
                    {formatPrice(remainingBalanceMajor, payment.currency)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700">
                Direct payment record reference is unattached. Booking gross value was captured via reservation record.
              </div>
            )}
          </div>

          {/* Section 4: Audit Logs & Activity Trail */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Activity & Financial Audit Trail
            </h2>

            {data.auditLogs.length > 0 ? (
              <div className="space-y-4">
                {data.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border)] text-xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground uppercase tracking-wider text-2xs">
                          {log.action}
                        </span>
                        <span className="text-[var(--muted-foreground)] text-2xs">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-[var(--muted-foreground)] mt-0.5">{log.description}</p>
                      {log.actorEmail && (
                        <p className="text-2xs text-[var(--muted-foreground)] mt-1 font-mono">
                          Actor: {log.actorEmail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] italic">
                No prior audit logs recorded for this transaction.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (1 Col on lg): Financial Summary & Actions */}
        <div className="flex flex-col gap-6">
          {/* Financial Summary Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
              Financial Summary
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--surface-secondary)] to-[var(--surface)] border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] font-medium">Refund Amount</span>
                <p className="text-3xl font-black text-foreground mt-1">
                  {formatPrice(refundAmountMajor, refund.currency)}
                </p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-2xs font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)]">
                  {refund.refundType} REFUND
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-2 border-b border-[var(--border)]">
                <span className="text-[var(--muted-foreground)]">Captured Gross</span>
                <span className="font-semibold text-foreground">
                  {formatPrice(capturedAmountMajor, refund.currency)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-2 border-b border-[var(--border)]">
                <span className="text-[var(--muted-foreground)]">Prior Refunds</span>
                <span className="font-semibold text-foreground">
                  {formatPrice(refundedAmountMajor, refund.currency)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-2">
                <span className="text-[var(--muted-foreground)]">Remaining Refundable</span>
                <span className="font-bold text-emerald-600">
                  {formatPrice(remainingBalanceMajor, refund.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Workflow Status & Reference */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs text-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Workflow Status
            </h2>

            <div>
              <span className="text-[var(--muted-foreground)] block">Reference Number</span>
              <span className="font-mono font-semibold text-foreground">{refund.refundReference || refund.id}</span>
            </div>

            <div>
              <span className="text-[var(--muted-foreground)] block">Creation Date</span>
              <span className="text-foreground">{formatDateTime(refund.createdAt)}</span>
            </div>

            {isApproved && (
              <div>
                <span className="text-[var(--muted-foreground)] block">Approved</span>
                <span className="text-sky-600 font-semibold">
                  Yes ({refund.metadata?.approvedByEmail || "By Administrator"})
                </span>
              </div>
            )}

            {refund.providerRefundId && (
              <div>
                <span className="text-[var(--muted-foreground)] block">Provider Settlement ID</span>
                <span className="font-mono text-emerald-600 font-semibold">{refund.providerRefundId}</span>
              </div>
            )}

            {refund.failureReason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700">
                <span className="font-bold block">Rejection / Failure Reason:</span>
                <span className="text-xs">{refund.failureReason}</span>
              </div>
            )}
          </div>

          {/* Admin Action Controls */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">
              Administrative Actions
            </h2>

            <div className="flex flex-col gap-3">
              {/* If Pending and Not Approved */}
              {isPending && !isApproved && (
                <>
                  <button
                    type="button"
                    onClick={() => setApproveModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Approve Refund Request
                  </button>

                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject Refund Request
                  </button>
                </>
              )}

              {/* If Pending and Approved (Ready to Process) */}
              {isPending && isApproved && (
                <>
                  <button
                    type="button"
                    onClick={() => setProcessModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Process Refund via Gateway
                  </button>

                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    Reject Refund
                  </button>
                </>
              )}

              {/* If Succeeded */}
              {isSucceeded && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs text-center font-medium">
                  ✓ This refund has been successfully settled with provider ID{" "}
                  <span className="font-mono font-bold">{refund.providerRefundId}</span>.
                </div>
              )}

              {/* If Rejected */}
              {isRejected && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs text-center font-medium">
                  ✕ This refund request was rejected and cannot be modified.
                </div>
              )}

              {/* If Failed */}
              {isFailed && (
                <>
                  <button
                    type="button"
                    onClick={() => setProcessModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    Retry Gateway Processing
                  </button>

                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-2"
                  >
                    Reject Refund
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleReconcile}
                disabled={loadingAction}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 hover:bg-[var(--surface-secondary)] text-foreground text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 mt-2"
              >
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reconcile Transaction
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: APPROVE REFUND */}
      {approveModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Approve Refund Request</h3>
              <button
                onClick={() => setApproveModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
              You are approving a refund of{" "}
              <strong className="text-foreground">
                {formatPrice(refundAmountMajor, refund.currency)}
              </strong>{" "}
              for reservation <strong className="text-foreground">{booking.id}</strong>.
            </p>

            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-800">
              <strong>Segregation of Duties Notice:</strong> Once approved, the refund will be queued for
              final payment provider execution.
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Administrative Approval Notes (Optional)
              </label>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                rows={3}
                placeholder="Add internal rationale or audit notes..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-2xs disabled:opacity-50"
              >
                {loadingAction ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 2: REJECT REFUND */}
      {rejectModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-rose-600">Reject Refund Request</h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
              Rejecting this refund request of{" "}
              <strong className="text-foreground">
                {formatPrice(refundAmountMajor, refund.currency)}
              </strong>{" "}
              will permanently mark it as rejected and release any pending reserved balance.
            </p>

            {rejectError && (
              <p className="text-xs text-rose-600 font-semibold">{rejectError}</p>
            )}

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Mandatory Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
                placeholder="Explain why this refund is being rejected (e.g., past policy window, guest damage, dispute settled elsewhere)..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs disabled:opacity-50"
              >
                {loadingAction ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 3: PROCESS REFUND */}
      {processModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Process Refund Settlement</h3>
              <button
                onClick={() => setProcessModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 space-y-1">
              <p className="font-bold">Gateway Execution Confirmation</p>
              <p>
                Amount to settle:{" "}
                <strong>{formatPrice(refundAmountMajor, refund.currency)}</strong> ({refund.currency})
              </p>
              <p>Target Payment Method: {payment?.paymentMethod || "Credit / Debit Card"}</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={confirmProcessCheck}
                onChange={(e) => setConfirmProcessCheck(e.target.checked)}
                className="rounded border-[var(--border)] mt-0.5"
              />
              <span>
                I confirm that I am authorized to execute this financial settlement transaction with the payment gateway.
              </span>
            </label>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setProcessModalOpen(false)}
                disabled={loadingAction}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcess}
                disabled={loadingAction || !confirmProcessCheck}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs disabled:opacity-50"
              >
                {loadingAction ? "Processing Settlement..." : "Execute Settlement"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
