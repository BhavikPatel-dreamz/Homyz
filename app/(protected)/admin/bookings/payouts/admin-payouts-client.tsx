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

        const res = await fetch(`/api/v1/admin/bookings/payouts?${sp.toString()}`);
        const json = await res.json();
        const data = json.data ?? json;
        setPayouts(data.payouts || []);
        if (data.pagination) setPagination(data.pagination);
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

      {/* Gateway Limitation Notice Callout */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs flex items-start gap-3">
        <svg className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-bold">Automated Gateway Settlement Status</p>
          <p className="mt-0.5">
            Automated direct bank wire execution is currently unconfigured in the payment gateway.
            The figures below reflect authoritative, verified platform earnings readiness derived from completed
            stays and immutable booking price snapshots.
          </p>
        </div>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Verified Payouts
          </p>
          <p className="text-lg font-bold text-foreground mt-1">
            {formatPrice(summary.totalVerifiedPayoutVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">{summary.totalVerifiedPayoutCount} stays</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Eligible Settlement
          </p>
          <p className="text-lg font-bold text-emerald-600 mt-1">
            {formatPrice(summary.eligibleSettlementVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">{summary.eligibleSettlementCount} ready</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Pending Stay
          </p>
          <p className="text-lg font-bold text-sky-600 mt-1">
            {formatPrice(summary.pendingStayVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">{summary.pendingStayCount} upcoming</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            On Hold
          </p>
          <p className="text-lg font-bold text-amber-600 mt-1">
            {formatPrice(summary.onHoldVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">{summary.onHoldCount} held</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Platform Fees
          </p>
          <p className="text-lg font-bold text-foreground mt-1">
            {formatPrice(summary.platformCommissionVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Retained</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Requires Review
          </p>
          <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">
            {summary.payoutsRequiringReviewCount}
          </p>
          <p className="text-2xs text-rose-600/80 mt-0.5">Missing breakdown</p>
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
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value="ELIGIBLE_SETTLEMENT">Eligible for Settlement</option>
            <option value="PENDING_STAY">Pending Stay</option>
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
                          p.status === "ELIGIBLE_SETTLEMENT"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : p.status === "PENDING_STAY"
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
                        Breakdown
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

      {/* Payout Breakdown Modal with ModalOverlay */}
      {selectedPayout && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
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
              <span className="text-xs text-[var(--muted-foreground)] font-medium">Net Eligible Payout</span>
              <p className="text-3xl font-black text-foreground mt-1">
                {formatPrice(selectedPayout.netPayout / 100, selectedPayout.currency)}
              </p>
              <span className="text-2xs text-emerald-600 font-semibold block mt-1">
                Status: {selectedPayout.status}
              </span>
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
            </div>

            <div className="flex justify-end pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSelectedPayout(null)}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold"
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

