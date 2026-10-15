"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import type { PayoutSummaryData } from "@/services/payment-admin.service";

interface PayoutItem {
  id: string;
  bookingId: string;
  startDate: string;
  endDate: string;
  scheduledPayoutDate?: string;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    photos: string[];
  };
  grossEarnings: number;
  platformFee: number;
  deductions: number;
  netPayout: number;
  currency: string;
  status: string;
  settlementExecutionSupported: boolean;
  payoutAccountMasked: string;
  holdDetails?: {
    isHeld: boolean;
    holdType?: string;
    reason?: string;
    heldBy?: string;
    heldAt?: string;
  } | null;
  executionDetails?: {
    status: string;
    settlementReference: string;
    amount: number;
    executedAt: string;
  } | null;
  createdAt: string;
}

interface AdminPayoutsClientProps {
  initialSummary: PayoutSummaryData;
  initialPayouts: PayoutItem[];
  initialPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialSearch?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
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

export function AdminPayoutsClient({
  initialSummary,
  initialPayouts,
  initialPagination,
  initialSearch = "",
}: AdminPayoutsClientProps) {
  const { formatPrice } = useCurrency();

  const [summary, setSummary] = useState<PayoutSummaryData>(initialSummary);
  const [payouts, setPayouts] = useState<PayoutItem[]>(initialPayouts);
  const [pagination, setPagination] = useState(initialPagination);

  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [holdType, setHoldType] = useState("MANUAL_ADMIN_HOLD");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPayouts = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageToLoad));
        sp.set("limit", String(pagination.limit));
        if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
        if (filterStatus !== "ALL") sp.set("status", filterStatus);
        if (startDate) sp.set("startDate", startDate);
        if (endDate) sp.set("endDate", endDate);

        const [res, sumRes] = await Promise.all([
          fetch(`/api/v1/admin/bookings/payouts?${sp.toString()}`),
          fetch(`/api/v1/admin/bookings/payouts/summary`),
        ]);

        const json = await res.json();
        const data = json.data ?? json;
        setPayouts(data.payouts || []);
        if (data.pagination) setPagination(data.pagination);

        if (sumRes.ok) {
          const sumJson = await sumRes.json();
          setSummary(sumJson.data ?? sumJson);
        }
      } catch (err) {
        console.error("[AdminPayoutsClient] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, filterStatus, startDate, endDate, pagination.limit],
  );

  useEffect(() => {
    fetchPayouts(1);
  }, [fetchPayouts]);

  const exportCSV = () => {
    if (payouts.length === 0) return;
    const headers = [
      "Payout ID",
      "Booking ID",
      "Host Name",
      "Host Email",
      "Property Title",
      "Gross Earnings",
      "Platform Fee",
      "Net Payout",
      "Currency",
      "Payout Status",
      "Stay Dates",
    ];
    const rows = payouts.map((p) => [
      `"${p.id}"`,
      `"${p.bookingId}"`,
      `"${p.host?.name || ""}"`,
      `"${p.host?.email || ""}"`,
      `"${(p.listing?.title || "").replace(/"/g, '""')}"`,
      `"${(p.grossEarnings / 100).toFixed(2)}"`,
      `"${(p.platformFee / 100).toFixed(2)}"`,
      `"${(p.netPayout / 100).toFixed(2)}"`,
      `"${p.currency}"`,
      `"${p.status}"`,
      `"${formatDate(p.startDate)} - ${formatDate(p.endDate)}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_host_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleHoldPayout = async () => {
    if (!selectedPayout || !holdReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/payouts/${selectedPayout.bookingId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdType, reason: holdReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to hold payout");
      setActionSuccess("Payout successfully placed on hold.");
      setHoldModalOpen(false);
      setHoldReason("");
      fetchPayouts(pagination.page);
      setSelectedPayout(null);
    } catch (err: any) {
      setActionError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleasePayout = async () => {
    if (!selectedPayout) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/payouts/${selectedPayout.bookingId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Admin verified conditions met. Hold released." }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to release payout hold");
      setActionSuccess("Payout hold released successfully.");
      fetchPayouts(pagination.page);
      setSelectedPayout(null);
    } catch (err: any) {
      setActionError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Host Payouts
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Monitor Host earnings, payout records, settlement statuses, and payout issues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/bookings/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Payments</span>
          </Link>
          <Link
            href="/admin/bookings/refunds"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Refunds</span>
          </Link>
          <a
            href="/api/v1/admin/bookings/payouts/export"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>SARIE Batch Export</span>
          </a>
          <button
            type="button"
            onClick={exportCSV}
            disabled={payouts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Gateway Limitation Notice Callout */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
        <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-bold">Automated Gateway Settlement Status</p>
          <p className="mt-0.5">
            Automated direct bank wire execution is currently unconfigured in the payment gateway.
            The figures below reflect authoritative, verified platform earnings readiness derived from completed
            stays, verified payment captures, and immutable booking price snapshots.
          </p>
        </div>
      </div>

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Total Paid Volume */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Total Paid Vol
          </p>
          <p className="text-base sm:text-lg font-bold text-foreground mt-1">
            {formatPrice((summary.totalPaidVolume || 0) / 100, summary.currency)}
          </p>
        </div>

        {/* 2. Total Paid Count */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Total Paid Count
          </p>
          <p className="text-base sm:text-lg font-bold text-foreground mt-1">
            {summary.totalPaidCount || 0}
          </p>
        </div>

        {/* 3. Eligible Settlement Volume */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Eligible Vol
          </p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatPrice(summary.eligibleSettlementVolume / 100, summary.currency)}
          </p>
        </div>

        {/* 4. Eligible Settlement Count */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Eligible Count
          </p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.eligibleSettlementCount}
          </p>
        </div>

        {/* 5. Scheduled / Pending Stay Volume */}
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
            Pending Stay Vol
          </p>
          <p className="text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400 mt-1">
            {formatPrice(summary.pendingStayVolume / 100, summary.currency)}
          </p>
        </div>

        {/* 6. Scheduled / Pending Stay Count */}
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
            Pending Count
          </p>
          <p className="text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400 mt-1">
            {summary.pendingStayCount}
          </p>
        </div>

        {/* 7. On Hold Volume */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            On Hold Vol
          </p>
          <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatPrice(summary.onHoldVolume / 100, summary.currency)}
          </p>
        </div>

        {/* 8. On Hold Count */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            On Hold Count
          </p>
          <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
            {summary.onHoldCount}
          </p>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by host, property, or booking ID..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground text-xs"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value="ELIGIBLE_SETTLEMENT">Eligible for Settlement</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="PAID">Paid / Settled</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="REQUIRES_REVIEW">Requires Review</option>
          </select>

          <button
            type="button"
            onClick={() => fetchPayouts(pagination.page)}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Payout / Booking</th>
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Stay Dates</th>
                <th className="py-3 px-4">Gross Earnings</th>
                <th className="py-3 px-4">Platform Fee</th>
                <th className="py-3 px-4">Net Host Payout</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-muted-foreground">
              {loading && payouts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--muted-foreground)]">
                    Loading payout records...
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--muted-foreground)]">
                    No host payout records found.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--surface-secondary)]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-2xs text-foreground font-semibold">
                      <Link href={`/admin/bookings/all?search=${p.bookingId}`} className="hover:underline">
                        {p.bookingId.slice(0, 10)}...
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-foreground block truncate">{p.host?.name || "Host"}</span>
                      <span className="text-3xs text-[var(--muted-foreground)] block truncate">{p.host?.email}</span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[160px] truncate font-medium text-foreground">
                      {p.listing?.title || "Property"}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-2xs">
                      {formatDate(p.startDate)} - {formatDate(p.endDate)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {formatPrice(p.grossEarnings / 100, p.currency)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-rose-600">
                      -{formatPrice(p.platformFee / 100, p.currency)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-foreground whitespace-nowrap">
                      {formatPrice(p.netPayout / 100, p.currency)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                          p.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : p.status === "ELIGIBLE_SETTLEMENT"
                            ? "bg-teal-500/10 text-teal-600 border border-teal-500/20"
                            : p.status === "SCHEDULED"
                            ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                            : p.status === "ON_HOLD"
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPayout(p)}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-foreground transition-all"
                      >
                        Breakdown & Actions
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 text-xs">
          <span>
            Showing {payouts.length} of {pagination.total} records (Page {pagination.page} of{" "}
            {pagination.totalPages || 1})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPayouts(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              ← Prev
            </button>
            <button
              onClick={() => fetchPayouts(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Payout Breakdown & Actions Modal with ModalOverlay */}
      {selectedPayout && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Host Payout Breakdown</h3>
              <button
                onClick={() => setSelectedPayout(null)}
                className="text-[var(--muted-foreground)] hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
              <span className="text-xs text-[var(--muted-foreground)] font-medium">Net Host Payout</span>
              <p className="text-3xl font-black text-foreground mt-1">
                {formatPrice(selectedPayout.netPayout / 100, selectedPayout.currency)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Status: {selectedPayout.status}
                </span>
                {selectedPayout.holdDetails?.isHeld && (
                  <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    Hold: {selectedPayout.holdDetails.holdType}
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl text-xs overflow-hidden">
              <div className="flex justify-between p-3">
                <span className="text-[var(--muted-foreground)]">Gross Booking Value</span>
                <span className="font-semibold text-foreground">
                  {formatPrice(selectedPayout.grossEarnings / 100, selectedPayout.currency)}
                </span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-[var(--muted-foreground)]">Platform Commission Deducted</span>
                <span className="font-semibold text-rose-600">
                  -{formatPrice(selectedPayout.platformFee / 100, selectedPayout.currency)}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-[var(--surface-secondary)]/30 font-bold">
                <span className="text-foreground">Net Payout to Host</span>
                <span className="text-foreground">
                  {formatPrice(selectedPayout.netPayout / 100, selectedPayout.currency)}
                </span>
              </div>
            </div>

            <div className="text-2xs text-[var(--muted-foreground)] space-y-1">
              <p>Host: {selectedPayout.host?.name} ({selectedPayout.host?.email})</p>
              <p>Property: {selectedPayout.listing?.title}</p>
              <p>Stay: {formatDate(selectedPayout.startDate)} to {formatDate(selectedPayout.endDate)}</p>
              <p>Payout Destination: {selectedPayout.payoutAccountMasked}</p>
              {selectedPayout.executionDetails && (
                <p className="font-mono text-emerald-600">
                  Settlement Ref: {selectedPayout.executionDetails.settlementReference} ({formatDate(selectedPayout.executionDetails.executedAt)})
                </p>
              )}
            </div>

            {/* Hold Reason if on hold */}
            {selectedPayout.holdDetails?.isHeld && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-2xs text-amber-800 dark:text-amber-300">
                <p className="font-bold">Hold Reason:</p>
                <p>{selectedPayout.holdDetails.reason}</p>
                <p className="mt-1 text-3xs opacity-80">Held by: {selectedPayout.holdDetails.heldBy}</p>
              </div>
            )}

            {/* Hold Form Modal Sub-section */}
            {holdModalOpen && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <h4 className="text-xs font-bold text-foreground">Place Administrative Hold</h4>
                <div>
                  <label className="text-3xs font-semibold text-[var(--muted-foreground)] uppercase">Hold Type</label>
                  <select
                    value={holdType}
                    onChange={(e) => setHoldType(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground"
                  >
                    <option value="MANUAL_ADMIN_HOLD">Manual Admin Hold</option>
                    <option value="DISPUTE_HOLD">Dispute Hold</option>
                    <option value="FRAUD_REVIEW">Fraud Review</option>
                    <option value="COMPLIANCE_HOLD">Compliance Hold</option>
                  </select>
                </div>
                <div>
                  <label className="text-3xs font-semibold text-[var(--muted-foreground)] uppercase">Mandatory Reason</label>
                  <textarea
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    placeholder="State reason for hold..."
                    rows={2}
                    className="w-full mt-1 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setHoldModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleHoldPayout}
                    disabled={!holdReason.trim() || actionLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {actionLoading ? "Holding..." : "Confirm Hold"}
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-2">
                {selectedPayout.status === "ON_HOLD" ? (
                  <button
                    type="button"
                    onClick={handleReleasePayout}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {actionLoading ? "Releasing..." : "Release Hold"}
                  </button>
                ) : selectedPayout.status !== "PAID" && !holdModalOpen ? (
                  <button
                    type="button"
                    onClick={() => setHoldModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/20"
                  >
                    Place Hold
                  </button>
                ) : null}

                {selectedPayout.status === "ELIGIBLE_SETTLEMENT" && !selectedPayout.settlementExecutionSupported && (
                  <span className="max-w-56 text-2xs text-amber-700 dark:text-amber-300">
                    Eligible for bank-batch preparation. Settlement remains unverified until an approved bank-confirmation integration is configured.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] text-foreground text-xs font-semibold hover:bg-[var(--surface)] border border-[var(--border)]"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
