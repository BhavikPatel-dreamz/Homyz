"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import type { AdminRefundSummary } from "@/services/refund.service";
import type { RefundCalculationResult } from "@/lib/refund/policy-engine";

interface RefundItem {
  id: string;
  refundReference: string | null;
  bookingId: string;
  paymentId: string | null;
  status: string;
  isApproved: boolean;
  amount: number;
  currency: string;
  refundType: string;
  reason: string | null;
  adminNotes: string | null;
  requestedById: string | null;
  approvedById: string | null;
  processedAt: string | null;
  succeededAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
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
    };
    listing: {
      id: string;
      title: string;
      photos: string[];
      city: string | null;
      host: {
        id: string;
        name: string | null;
        email: string | null;
      };
    };
  };
  payment: {
    id: string;
    provider: string;
    status: string;
    amount: number;
    capturedAmount: number;
    refundedAmount: number;
  } | null;
}

interface AdminRefundsClientProps {
  initialSummary: AdminRefundSummary;
  initialRefunds: RefundItem[];
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

function formatDate(val: string) {
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return val;
  }
}

function formatDateTime(val: string) {
  try {
    return dateTimeFormatter.format(new Date(val));
  } catch {
    return val;
  }
}

export function AdminRefundsClient({
  initialSummary,
  initialRefunds,
  initialPagination,
  initialTab = "all",
  initialSearch = "",
}: AdminRefundsClientProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [summary, setSummary] = useState<AdminRefundSummary>(initialSummary);
  const [refunds, setRefunds] = useState<RefundItem[]>(initialRefunds);
  const [pagination, setPagination] = useState(initialPagination);

  // Filter state
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Create Request Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createBookingId, setCreateBookingId] = useState("");
  const [createAmountMajor, setCreateAmountMajor] = useState<string>("");
  const [createReason, setCreateReason] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteResult, setQuoteResult] = useState<RefundCalculationResult | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch refunds
  const fetchRefunds = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("limit", String(pagination.limit || 20));
        if (activeTab && activeTab !== "all") params.set("tab", activeTab);
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        if (sortBy) params.set("sortBy", sortBy);
        if (sortOrder) params.set("sortOrder", sortOrder);

        const [listRes, summaryRes] = await Promise.all([
          fetch(`/api/v1/admin/bookings/refunds?${params.toString()}`),
          fetch(`/api/v1/admin/bookings/refunds/summary`),
        ]);

        const listData = await listRes.json();
        const summaryData = await summaryRes.json();

        if (!listRes.ok) throw new Error(listData.message || listData.error || "Failed to load refunds");

        setRefunds(listData.refunds || []);
        setPagination(listData.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
        if (summaryRes.ok) setSummary(summaryData);
      } catch (err: any) {
        setError(err.message || "Failed to load refund data");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, debouncedSearch, dateFrom, dateTo, sortBy, sortOrder, pagination.limit],
  );

  useEffect(() => {
    fetchRefunds(1);
  }, [activeTab, debouncedSearch, fetchRefunds]);

  // Handle Tab Switch
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
  };

  // Preview Refund Quote
  const handleCalculateQuote = async () => {
    if (!createBookingId.trim()) {
      setQuoteError("Please enter a valid Booking ID.");
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    setQuoteResult(null);

    try {
      const res = await fetch(`/api/v1/admin/bookings/${createBookingId.trim()}/refund-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to calculate quote");
      }

      setQuoteResult(data);
      if (data.totalRefundableAmount > 0) {
        setCreateAmountMajor((data.totalRefundableAmount / 100).toFixed(2));
      } else {
        setCreateAmountMajor("0.00");
      }
    } catch (err: any) {
      setQuoteError(err.message || "Failed to calculate refund quote");
    } finally {
      setQuoteLoading(false);
    }
  };

  // Submit Refund Request
  const handleSubmitCreateRequest = async () => {
    const amountVal = parseFloat(createAmountMajor);
    if (Number.isNaN(amountVal) || amountVal <= 0) {
      setCreateError("Please enter a valid positive refund amount.");
      return;
    }
    if (!createReason.trim()) {
      setCreateError("Please provide a reason for the refund request.");
      return;
    }

    setSubmittingCreate(true);
    setCreateError(null);

    try {
      const amountCents = Math.round(amountVal * 100);
      const res = await fetch(`/api/v1/admin/bookings/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: createBookingId.trim(),
          amount: amountCents,
          reason: createReason.trim(),
          notes: createNotes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to submit refund request");
      }

      // Close modal and refresh table
      setCreateModalOpen(false);
      setCreateBookingId("");
      setCreateAmountMajor("");
      setCreateReason("");
      setCreateNotes("");
      setQuoteResult(null);
      fetchRefunds(1);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create refund request");
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (refunds.length === 0) return;
    const headers = [
      "Refund Reference",
      "Booking ID",
      "Property Title",
      "Guest Name",
      "Guest Email",
      "Amount",
      "Currency",
      "Refund Type",
      "Status",
      "Reason",
      "Request Date",
      "Processed Date",
    ];

    const rows = refunds.map((r) => [
      `"${r.refundReference || r.id}"`,
      `"${r.bookingId}"`,
      `"${(r.booking.listing.title || "").replace(/"/g, '""')}"`,
      `"${r.booking.user.name || ""}"`,
      `"${r.booking.user.email || ""}"`,
      `"${(r.amount / 100).toFixed(2)}"`,
      `"${r.currency}"`,
      `"${r.refundType}"`,
      `"${r.status}"`,
      `"${(r.reason || "").replace(/"/g, '""')}"`,
      `"${formatDateTime(r.createdAt)}"`,
      `"${r.processedAt ? formatDateTime(r.processedAt) : ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_refunds_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Refund Management
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Review refund requests, monitor payment refunds, and track refund outcomes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Links */}
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

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportCSV}
            disabled={refunds.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          {/* Create Request Action */}
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>+ Create Refund Request</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchRefunds(1)}
            className="font-semibold underline ml-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* 8 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Requests */}
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "all" ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30 bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Total Requests</span>
            <span className="text-sm">📋</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-foreground font-mono">{summary.totalRequests}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">All refund attempts</p>
          </div>
        </button>

        {/* Pending Review */}
        <button
          type="button"
          onClick={() => handleTabChange("pending")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "pending" ? "border-amber-500 ring-2 ring-amber-500/30 bg-amber-50/10" : "border-[var(--border)] bg-[var(--surface)] hover:border-amber-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Pending Review</span>
            <span className="text-sm">⏳</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono">{summary.pendingReview}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Awaiting admin review</p>
          </div>
        </button>

        {/* Approved */}
        <button
          type="button"
          onClick={() => handleTabChange("approved")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "approved" ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/10" : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Approved</span>
            <span className="text-sm">✓</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-mono">{summary.approved}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Ready for processing</p>
          </div>
        </button>

        {/* Processing */}
        <button
          type="button"
          onClick={() => handleTabChange("processing")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "processing" ? "border-purple-500 ring-2 ring-purple-500/30 bg-purple-50/10" : "border-[var(--border)] bg-[var(--surface)] hover:border-purple-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Processing</span>
            <span className="text-sm">⚙️</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-400 font-mono">{summary.processing}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">With payment provider</p>
          </div>
        </button>

        {/* Succeeded */}
        <button
          type="button"
          onClick={() => handleTabChange("completed")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "completed" ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/10" : "border-[var(--border)] bg-[var(--surface)] hover:border-emerald-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Succeeded</span>
            <span className="text-sm">💰</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">{summary.succeeded}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Verified completions</p>
          </div>
        </button>

        {/* Failed */}
        <button
          type="button"
          onClick={() => handleTabChange("failed")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "failed" ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/10" : "border-[var(--border)] bg-[var(--surface)] hover:border-rose-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Failed</span>
            <span className="text-sm">⚠️</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 font-mono">{summary.failed}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Gateway rejections</p>
          </div>
        </button>

        {/* Rejected */}
        <button
          type="button"
          onClick={() => handleTabChange("rejected")}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "rejected" ? "border-zinc-500 ring-2 ring-zinc-500/30 bg-zinc-50/10" : "border-[var(--border)] bg-[var(--surface)] hover:border-zinc-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Rejected</span>
            <span className="text-sm">✕</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-bold text-foreground font-mono">{summary.rejected}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Admin rejected</p>
          </div>
        </button>

        {/* Total Refunded Amount */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Total Refunded</span>
            <span className="text-sm">💵</span>
          </div>
          <div className="mt-2.5">
            <p className="text-2xl font-black text-foreground font-mono">
              {formatPrice(summary.totalRefundedAmount, summary.currency)}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">Verified settled refunds</p>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border)]">
        {[
          { key: "all", label: "All Refunds", count: summary.totalRequests },
          { key: "pending", label: "Pending Review", count: summary.pendingReview },
          { key: "approved", label: "Approved", count: summary.approved },
          { key: "processing", label: "Processing", count: summary.processing },
          { key: "completed", label: "Completed", count: summary.succeeded },
          { key: "failed", label: "Failed", count: summary.failed },
          { key: "rejected", label: "Rejected", count: summary.rejected },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-2xs font-bold"
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

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by refund ref, booking ID, guest, property..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
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

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Refunds Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--muted-foreground)]">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Syncing refunds...</span>
          </div>
        ) : refunds.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-foreground">No refund requests found</h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              There are no refund records matching your criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Refund Ref</th>
                  <th className="px-4 py-3.5">Booking</th>
                  <th className="px-4 py-3.5">Property</th>
                  <th className="px-4 py-3.5">Guest</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {refunds.map((r) => {
                  let statusBadge = (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {r.status}
                    </span>
                  );
                  if (r.status === "SUCCEEDED") {
                    statusBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Completed
                      </span>
                    );
                  } else if (r.status === "PENDING") {
                    statusBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {r.isApproved ? "Approved (Pending Processing)" : "Pending Review"}
                      </span>
                    );
                  } else if (r.status === "PROCESSING") {
                    statusBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        Processing
                      </span>
                    );
                  } else if (r.status === "FAILED") {
                    statusBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        Failed
                      </span>
                    );
                  } else if (r.status === "REJECTED") {
                    statusBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Rejected
                      </span>
                    );
                  }

                  return (
                    <tr key={r.id} className="hover:bg-[var(--surface-secondary)]/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-semibold text-foreground">
                        {r.refundReference || r.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                        <Link href={`/admin/bookings/${r.bookingId}`} className="hover:text-[var(--accent)] hover:underline">
                          {r.bookingId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 min-w-[140px] max-w-[200px]">
                          <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                            {r.booking.listing.photos?.[0] && (
                              <Image src={r.booking.listing.photos[0]} alt="" fill className="object-cover" unoptimized />
                            )}
                          </div>
                          <span className="font-semibold text-foreground truncate">{r.booking.listing.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 min-w-[120px]">
                        <p className="font-semibold text-foreground truncate">{r.booking.user.name || "Guest"}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] truncate">{r.booking.user.email}</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                        {formatPrice(r.amount, r.currency)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--muted-foreground)]">
                          {r.refundType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {statusBadge}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/bookings/refunds/${r.id}`}
                          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground text-xs font-semibold shadow-2xs transition-all"
                        >
                          Review & Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]/20 text-xs">
          <span className="text-[var(--muted-foreground)]">
            Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} refunds
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchRefunds(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              ← Previous
            </button>
            <span className="font-semibold text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchRefunds(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Create Refund Request Modal (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {createModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">
                Create Refund Request
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-3 p-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {createError}
              </div>
            )}

            <div className="mt-4 space-y-3.5 text-xs">
              {/* Booking ID Input + Quote Preview Button */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Booking ID <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={createBookingId}
                    onChange={(e) => setCreateBookingId(e.target.value)}
                    placeholder="Enter Booking ID (e.g., cm...)"
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCalculateQuote}
                    disabled={quoteLoading || !createBookingId.trim()}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)]/80 text-foreground font-semibold border border-[var(--border)] whitespace-nowrap"
                  >
                    {quoteLoading ? "Calculating..." : "Calculate Quote"}
                  </button>
                </div>
              </div>

              {/* Quote Error */}
              {quoteError && (
                <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs">
                  {quoteError}
                </div>
              )}

              {/* Quote Preview Results Callout */}
              {quoteResult && (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-900 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-900 dark:text-blue-200">
                      Policy Engine Result:
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        quoteResult.status === "ELIGIBLE"
                          ? "bg-emerald-100 text-emerald-800"
                          : quoteResult.status === "NEEDS_REVIEW"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {quoteResult.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-blue-800 dark:text-blue-300">
                    {quoteResult.explanation}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/60 text-[11px] font-mono">
                    <div>
                      <span className="text-[var(--muted-foreground)] block">Captured Balance:</span>
                      <span className="font-bold">
                        {formatPrice(quoteResult.capturedAmount, quoteResult.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block">Max Refundable:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPrice(quoteResult.remainingRefundableBalance, quoteResult.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Refund Amount (SAR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createAmountMajor}
                  onChange={(e) => setCreateAmountMajor(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground font-mono font-bold text-base"
                />
              </div>

              {/* Reason Input */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value)}
                  placeholder="e.g., Host cancelled stay / Approved policy refund"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                />
              </div>

              {/* Notes Input */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Internal Review Notes (Optional)
                </label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional context for administrators"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                disabled={submittingCreate}
                className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitCreateRequest}
                disabled={submittingCreate || !createBookingId || !createAmountMajor || !createReason}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs font-semibold shadow-2xs disabled:opacity-50"
              >
                {submittingCreate ? "Submitting..." : "Create Request"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Filters Drawer (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {filterDrawerOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-[var(--surface)] h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <h3 className="text-base font-bold text-foreground">Filter Refunds</h3>
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Sort Direction</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                  >
                    <option value="desc">Descending (Newest / Highest)</option>
                    <option value="asc">Ascending (Oldest / Lowest)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setSortOrder("desc");
                }}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterDrawerOpen(false);
                  fetchRefunds(1);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-semibold shadow-2xs"
              >
                Apply
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
