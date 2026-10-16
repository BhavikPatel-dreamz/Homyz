"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";

interface PaymentDetailsProps {
  initialData: {
    payment: {
      id: string;
      bookingId: string;
      provider: string;
      providerPaymentId: string | null;
      idempotencyKey: string | null;
      status: string;
      currency: string;
      amount: number;
      capturedAmount: number;
      refundedAmount: number;
      remainingRefundableBalance: number;
      paymentMethod: string | null;
      paymentMethodDetails: any;
      authorizedAt: string | null;
      capturedAt: string | null;
      voidedAt: string | null;
      failedAt: string | null;
      failureReason: string | null;
      metadata: any;
      createdAt: string;
      updatedAt: string;
    };
    booking: {
      id: string;
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
      storedHostPayout?: any;
    };
    refunds: any[];
    auditLogs: any[];
  };
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

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

function formatDateTime(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return dateTimeFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

export function AdminPaymentDetailsClient({ initialData }: PaymentDetailsProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [data, setData] = useState(initialData);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const payment = data.payment;
  const booking = data.booking;

  const capturedMajor = (payment.capturedAmount || 0) / 100;
  const refundedMajor = (payment.refundedAmount || 0) / 100;
  const balanceMajor = (payment.remainingRefundableBalance || 0) / 100;
  const hostPayout = booking.storedHostPayout;

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/payments/${payment.id}/reconcile`, {
        method: "POST",
      });
      const raw = await res.json();
      const json = raw.data ?? raw;
      if (!res.ok) throw new Error(json.error || raw.error?.message || "Reconciliation failed");

      setReconcileResult(json);
      if (json.payment) {
        setData((prev) => ({
          ...prev,
          payment: { ...prev.payment, ...json.payment },
        }));
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to reconcile payment");
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bookings/payments"
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              ← All Payments
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              {payment.id.slice(0, 12)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1>
              {payment.id}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                payment.status === "CAPTURED"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : payment.status === "AUTHORIZED"
                  ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                  : payment.status === "PENDING"
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  : payment.status === "PARTIALLY_REFUNDED"
                  ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                  : payment.status === "REFUNDED"
                  ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                  : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
              }`}
            >
              {payment.status}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setReconcileModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Reconcile Record</span>
          </button>

          <Link
            href={`/admin/bookings/refunds?search=${booking.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>View Refunds</span>
          </Link>

          <Link
            href={`/admin/bookings/all?search=${booking.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>View Booking</span>
          </Link>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section 1: Financial Information */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Financial Transaction Overview
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <span className="text-2xs text-[var(--muted-foreground)] font-medium">Captured Amount</span>
                <p className="text-lg font-bold text-foreground mt-1">
                  {formatPrice(capturedMajor, payment.currency)}
                </p>
                <span className="text-3xs text-[var(--muted-foreground)]">
                  ({payment.capturedAmount.toLocaleString()} cents)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <span className="text-2xs text-[var(--muted-foreground)] font-medium">Refunded Total</span>
                <p className="text-lg font-bold text-rose-600 mt-1">
                  {formatPrice(refundedMajor, payment.currency)}
                </p>
                <span className="text-3xs text-[var(--muted-foreground)]">
                  ({payment.refundedAmount.toLocaleString()} cents)
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <span className="text-2xs text-[var(--muted-foreground)] font-medium">Refundable Balance</span>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                  {formatPrice(balanceMajor, payment.currency)}
                </p>
                <span className="text-3xs text-[var(--muted-foreground)]">Available to refund</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                <span className="text-2xs text-[var(--muted-foreground)] font-medium">Provider Reference</span>
                <p className="text-xs font-mono font-bold text-foreground mt-1 truncate" title={payment.providerPaymentId || "None"}>
                  {payment.providerPaymentId || "Simulated"}
                </p>
                <span className="text-3xs text-[var(--muted-foreground)]">{payment.provider}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-[var(--border)]">
              <div>
                <span className="text-[var(--muted-foreground)] block">Payment Method</span>
                <span className="font-semibold text-foreground">{payment.paymentMethod || "Credit / Debit Card"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Created At</span>
                <span className="text-foreground">{formatDateTime(payment.createdAt)}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Captured At</span>
                <span className="text-foreground">{formatDateTime(payment.capturedAt)}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Authorized At</span>
                <span className="text-foreground">{formatDateTime(payment.authorizedAt)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Associated Booking */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H7" />
              </svg>
              Associated Booking
            </h2>

            <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
              <div className="relative w-full sm:w-32 h-24 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-[var(--border)]">
                {booking.listing.photos?.[0] ? (
                  <Image src={booking.listing.photos[0]} alt={booking.listing.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Photo</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground text-sm">{booking.listing.title}</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {booking.listing.city || "Saudi Arabia"}, {booking.listing.country || "SA"}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Check-in</span>
                    <span className="font-semibold text-foreground">{formatDate(booking.startDate)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Check-out</span>
                    <span className="font-semibold text-foreground">{formatDate(booking.endDate)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block">Booking Status</span>
                    <span className="font-semibold uppercase text-foreground">{booking.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[var(--border)] text-xs">
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden relative shrink-0">
                  {booking.user.image ? (
                    <Image src={booking.user.image} alt={booking.user.name || "Guest"} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">G</div>
                  )}
                </div>
                <div>
                  <span className="text-2xs text-[var(--muted-foreground)] uppercase font-bold block">Guest</span>
                  <p className="font-semibold text-foreground">{booking.user.name || "Guest"}</p>
                  <p className="text-2xs text-[var(--muted-foreground)]">{booking.user.email}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden relative shrink-0">
                  {booking.listing.host.image ? (
                    <Image src={booking.listing.host.image} alt={booking.listing.host.name || "Host"} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">H</div>
                  )}
                </div>
                <div>
                  <span className="text-2xs text-[var(--muted-foreground)] uppercase font-bold block">Host</span>
                  <p className="font-semibold text-foreground">{booking.listing.host.name || "Host"}</p>
                  <p className="text-2xs text-[var(--muted-foreground)]">{booking.listing.host.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Associated Refunds */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H4m0 0l3-3m-3 3l3 3m5 4v1a3 3 0 003 3h4m0 0l-3-3m3 3l-3 3" />
              </svg>
              Associated Refund Transactions
            </h2>

            {data.refunds.length > 0 ? (
              <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden text-xs">
                {data.refunds.map((r: any) => (
                  <div key={r.id} className="p-3 flex items-center justify-between hover:bg-[var(--surface-secondary)]/40">
                    <div>
                      <span className="font-mono font-semibold text-foreground block">
                        {r.refundReference || r.id}
                      </span>
                      <span className="text-2xs text-[var(--muted-foreground)]">
                        {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-foreground block">
                        {formatPrice((r.amount || 0) / 100, r.currency || "SAR")}
                      </span>
                      <span className="text-2xs font-semibold uppercase text-emerald-600">{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] italic">
                No refunds have been issued against this payment transaction.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Workflow Details & Host Earnings */}
        <div className="flex flex-col gap-6">
          {/* Host Payout Readiness */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs text-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Host Earnings Snapshot
            </h2>

            {hostPayout ? (
              <>
                <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                  <span className="text-2xs text-[var(--muted-foreground)] block">Net Host Payout</span>
                  <p className="text-2xl font-black text-foreground mt-0.5">
                    {formatPrice((hostPayout.netHostPayout || 0) / 100, hostPayout.currency || "SAR")}
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Accommodation</span>
                    <span className="font-semibold text-foreground">
                      {formatPrice((hostPayout.accommodationSubtotal || 0) / 100, hostPayout.currency || "SAR")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Cleaning Fee</span>
                    <span className="font-semibold text-foreground">
                      {formatPrice((hostPayout.cleaningFee || 0) / 100, hostPayout.currency || "SAR")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Platform Commission</span>
                    <span className="font-semibold text-rose-600">
                      -{formatPrice((hostPayout.hostServiceFee || 0) / 100, hostPayout.currency || "SAR")}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-2xs text-[var(--muted-foreground)]">
                Legacy reservation record. Payout breakdown was not computed upfront.
              </p>
            )}
          </div>

          {/* Technical Metadata */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs text-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Gateway Details
            </h2>

            <div>
              <span className="text-[var(--muted-foreground)] block">Idempotency Key</span>
              <span className="font-mono text-foreground text-3xs break-all">
                {payment.idempotencyKey || "None"}
              </span>
            </div>

            <div>
              <span className="text-[var(--muted-foreground)] block">Failure Reason</span>
              <span className="text-rose-600 font-semibold">{payment.failureReason || "None (Healthy)"}</span>
            </div>

            <div>
              <span className="text-[var(--muted-foreground)] block">Last Updated</span>
              <span className="text-foreground">{formatDateTime(payment.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reconcile Modal */}
      {reconcileModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Reconcile Payment Transaction</h3>
              <button
                onClick={() => setReconcileModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted-foreground)]">
              This operation verifies the local captured amount against child refund records, ensures
              balance invariants, and aligns transaction statuses with provider outcomes.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs">
                {error}
              </div>
            )}

            {reconcileResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs space-y-1">
                <p className="font-bold">Reconciliation Complete</p>
                <p>Status Updated: {reconcileResult.statusUpdated ? "Yes" : "No (Already synchronized)"}</p>
                <p>Issues Found: {reconcileResult.issuesFound?.length || 0}</p>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setReconcileModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconciling}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {reconciling ? "Checking..." : "Run Reconciliation"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

