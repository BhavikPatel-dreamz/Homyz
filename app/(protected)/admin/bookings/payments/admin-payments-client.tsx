"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import type { PaymentSummaryData } from "@/services/payment-admin.service";

interface PaymentItem {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  currency: string;
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  paymentMethod: string | null;
  createdAt: string;
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
    } | null;
    listing: {
      id: string;
      title: string;
      city: string | null;
      photos: string[];
      host: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
      } | null;
    } | null;
  } | null;
  refunds: {
    id: string;
    refundReference: string | null;
    amount: number;
    status: string;
  }[];
}

interface AdminPaymentsClientProps {
  initialSummary: PaymentSummaryData;
  initialPayments: PaymentItem[];
  initialPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialTab?: string;
  initialSearch?: string;
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

export function AdminPaymentsClient({
  initialSummary,
  initialPayments,
  initialPagination,
  initialTab = "all",
  initialSearch = "",
}: AdminPaymentsClientProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [summary, setSummary] = useState<PaymentSummaryData>(initialSummary);
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [pagination, setPagination] = useState(initialPagination);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [filterProvider, setFilterProvider] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch payments from server
  const fetchPayments = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageToLoad));
        sp.set("limit", String(pagination.limit));
        if (activeTab && activeTab !== "all") sp.set("tab", activeTab);
        if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
        if (filterProvider !== "ALL") sp.set("provider", filterProvider);
        if (filterStatus !== "ALL") sp.set("status", filterStatus);
        if (startDate) sp.set("startDate", startDate);
        if (endDate) sp.set("endDate", endDate);
        sp.set("sortBy", sortBy);
        sp.set("sortOrder", sortOrder);

        const res = await fetch(`/api/v1/admin/bookings/payments?${sp.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || json.message || "Payment records could not be loaded.");
        }
        const data = json.data ?? json;
        setPayments(data.payments || []);
        if (data.pagination) setPagination(data.pagination);
      } catch (err) {
        console.error("[AdminPaymentsClient] Fetch error:", err);
        setError(err instanceof Error ? err.message : "Payment records could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, debouncedSearch, filterProvider, filterStatus, startDate, endDate, sortBy, sortOrder, pagination.limit],
  );

  useEffect(() => {
    fetchPayments(1);
  }, [fetchPayments]);

  const tabs = [
    { id: "all", label: "All Transactions", count: pagination.total },
    { id: "captured", label: "Captured", count: summary.successfulCount },
    { id: "authorized", label: "Authorized", count: summary.authorizedCount },
    { id: "pending", label: "Pending", count: summary.pendingCount },
    { id: "failed", label: "Failed", count: summary.failedCount },
    { id: "partially_refunded", label: "Partially Refunded", count: summary.partiallyRefundedCount },
    { id: "refunded", label: "Refunded", count: summary.fullyRefundedCount },
    { id: "attention", label: "Requires Attention", count: summary.requiresAttentionCount },
  ];

  const exportCSV = () => {
    if (payments.length === 0) return;
    const headers = [
      "Payment ID",
      "Provider Reference",
      "Booking ID",
      "Property",
      "Guest",
      "Host",
      "Provider",
      "Amount",
      "Captured",
      "Refunded",
      "Currency",
      "Status",
      "Date",
    ];
    const rows = payments.map((p) => [
      `"${p.id}"`,
      `"${p.providerPaymentId || ""}"`,
      `"${p.booking?.id || ""}"`,
      `"${(p.booking?.listing?.title || "").replace(/"/g, '""')}"`,
      `"${p.booking?.user?.name || ""}"`,
      `"${p.booking?.listing?.host?.name || ""}"`,
      `"${p.provider}"`,
      `"${(p.amount / 100).toFixed(2)}"`,
      `"${(p.capturedAmount / 100).toFixed(2)}"`,
      `"${(p.refundedAmount / 100).toFixed(2)}"`,
      `"${p.currency}"`,
      `"${p.status}"`,
      `"${formatDateTime(p.createdAt)}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* 11.2 — Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Payments & Transactions
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Monitor booking payments, transaction activity, and payment issues across Homyz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/bookings/refunds"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Refunds</span>
          </Link>
          <Link
            href="/admin/bookings/payouts"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Host Payouts</span>
          </Link>
          <Link
            href="/admin/bookings/disputes"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Disputes</span>
          </Link>

          <button
            type="button"
            onClick={exportCSV}
            disabled={payments.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 11.2 — 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Captured
          </p>
          <p className="text-lg font-bold text-foreground mt-1">
            {formatPrice(summary.totalCapturedVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">
            Net: {formatPrice((summary.netCapturedVolume ?? summary.totalCapturedVolume) / 100, summary.currency)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Authorized
          </p>
          <p className="text-lg font-bold text-sky-600 mt-1">
            {formatPrice(summary.authorizedVolume / 100, summary.currency)}
          </p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">{summary.authorizedCount} holds</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Pending
          </p>
          <p className="text-lg font-bold text-amber-600 mt-1">{summary.pendingCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Awaiting capture</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Successful
          </p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{summary.successfulCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Fully captured</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Failed
          </p>
          <p className="text-lg font-bold text-rose-600 mt-1">{summary.failedCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Declined / Error</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Partial Refund
          </p>
          <p className="text-lg font-bold text-purple-600 mt-1">{summary.partiallyRefundedCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Partially returned</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Full Refund
          </p>
          <p className="text-lg font-bold text-indigo-600 mt-1">{summary.fullyRefundedCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">
            {formatPrice((summary.refundedVolume ?? 0) / 100, summary.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Attention
          </p>
          <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.requiresAttentionCount}</p>
          <p className="text-2xs text-rose-600/80 mt-0.5">Stale / Issues</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          {error} Refresh after the financial database migration is available.
        </div>
      )}

      {/* 11.4 — Status Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-2xs"
                  : "text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? "bg-black/15 text-[var(--accent-foreground)]"
                    : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 11.5 — Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by payment ID, booking, guest, property..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filters</span>
          </button>

          <button
            type="button"
            onClick={() => fetchPayments(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 11.3 — Payment Transactions Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Transaction / ID</th>
                <th className="py-3 px-4">Booking</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Guest</th>
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Captured Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-muted-foreground">
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--muted-foreground)]">
                    Loading payment records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--muted-foreground)]">
                    No payment transactions found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const capturedMajor = (p.capturedAmount || 0) / 100;
                  return (
                    <tr key={p.id} className="hover:bg-[var(--surface-secondary)]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-2xs text-foreground font-semibold">
                        <Link href={`/admin/bookings/payments/${p.id}`} className="hover:underline">
                          {p.id.slice(0, 14)}...
                        </Link>
                        {p.providerPaymentId && (
                          <span className="block text-3xs text-[var(--muted-foreground)] font-mono">
                            {p.providerPaymentId}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-2xs text-foreground">
                        {p.booking ? (
                          <Link href={`/admin/bookings/all?search=${p.booking.id}`} className="hover:underline">
                            {p.booking.id.slice(0, 10)}...
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-[160px] truncate font-medium text-foreground">
                        {p.booking?.listing?.title || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-foreground block truncate">
                          {p.booking?.user?.name || "Guest"}
                        </span>
                        <span className="text-3xs text-[var(--muted-foreground)] block truncate">
                          {p.booking?.user?.email || ""}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-foreground block truncate">
                          {p.booking?.listing?.host?.name || "Host"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-2xs font-mono bg-[var(--surface-secondary)] text-[var(--muted-foreground)]">
                          {p.provider}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                        {formatPrice(capturedMajor, p.currency)}
                        {p.refundedAmount > 0 && (
                          <span className="block text-3xs text-rose-600">
                            -{(p.refundedAmount / 100).toFixed(2)} refunded
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                            p.status === "CAPTURED"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : p.status === "AUTHORIZED"
                              ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                              : p.status === "PENDING"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : p.status === "PARTIALLY_REFUNDED"
                              ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                              : p.status === "REFUNDED"
                              ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                              : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] whitespace-nowrap text-2xs">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/bookings/payments/${p.id}`}
                          className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-foreground transition-all"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 text-xs">
          <span>
            Showing {payments.length} of {pagination.total} records (Page {pagination.page} of{" "}
            {pagination.totalPages || 1})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPayments(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              ← Prev
            </button>
            <button
              onClick={() => fetchPayments(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Filter Drawer with ModalOverlay */}
      {filterDrawerOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-[var(--surface)] border-l border-[var(--border)] p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-5">
                <h3 className="text-base font-bold text-foreground">Filter Payments</h3>
                <button
                  onClick={() => setFilterDrawerOpen(false)}
                  className="text-[var(--muted-foreground)] hover:text-foreground font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Payment Provider</label>
                  <select
                    value={filterProvider}
                    onChange={(e) => setFilterProvider(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  >
                    <option value="ALL">All Providers</option>
                    <option value="MOCK">MOCK</option>
                    <option value="MOYASAR">MOYASAR</option>
                    <option value="DEFERRED">DEFERRED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="CAPTURED">CAPTURED</option>
                    <option value="AUTHORIZED">AUTHORIZED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="FAILED">FAILED</option>
                    <option value="PARTIALLY_REFUNDED">PARTIALLY_REFUNDED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  >
                    <option value="createdAt">Date Created</option>
                    <option value="capturedAmount">Captured Amount</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setFilterProvider("ALL");
                  setFilterStatus("ALL");
                  setStartDate("");
                  setEndDate("");
                }}
                className="w-1/2 py-2.5 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--surface-secondary)]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
                className="w-1/2 py-2.5 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
