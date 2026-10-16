"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import type {
  AdminCancellationItem,
  AdminCancellationSummary,
} from "@/services/booking.service";

interface AdminCancellationsClientProps {
  initialSummary: AdminCancellationSummary;
  initialCancellations: AdminCancellationItem[];
  initialPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialTab?: string;
  initialSearch?: string;
  initialPolicy?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  initialCheckInFrom?: string;
  initialCheckInTo?: string;
  initialSortBy?: string;
  initialSortOrder?: "asc" | "desc";
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

function formatDate(val?: string | null) {
  if (!val) return "N/A";
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return val;
  }
}

function formatDateTime(val?: string | null) {
  if (!val) return "Not recorded";
  try {
    return dateTimeFormatter.format(new Date(val));
  } catch {
    return val;
  }
}

function getDurationNights(start?: string | null, end?: string | null) {
  if (!start || !end) return 1;
  const d1 = new Date(start).getTime();
  const d2 = new Date(end).getTime();
  return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
}

type DatePreset = "ALL_TIME" | "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "CUSTOM";

export function AdminCancellationsClient({
  initialSummary,
  initialCancellations,
  initialPagination,
  initialTab = "all",
  initialSearch = "",
  initialPolicy = "ALL",
  initialDateFrom = "",
  initialDateTo = "",
  initialCheckInFrom = "",
  initialCheckInTo = "",
  initialSortBy = "createdAt",
  initialSortOrder = "desc",
}: AdminCancellationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const isInitialMount = useRef(true);

  // Authoritative State
  const [summary, setSummary] = useState<AdminCancellationSummary>(initialSummary);
  const [cancellations, setCancellations] = useState<AdminCancellationItem[]>(initialCancellations);
  const [pagination, setPagination] = useState(initialPagination);

  // Filters State
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [filterPolicy, setFilterPolicy] = useState<string>(initialPolicy);
  const [datePreset, setDatePreset] = useState<DatePreset>(
    initialDateFrom || initialDateTo ? "CUSTOM" : "ALL_TIME"
  );
  const [cancellationDateFrom, setCancellationDateFrom] = useState<string>(initialDateFrom);
  const [cancellationDateTo, setCancellationDateTo] = useState<string>(initialDateTo);
  const [checkInFrom, setCheckInFrom] = useState<string>(initialCheckInFrom);
  const [checkInTo, setCheckInTo] = useState<string>(initialCheckInTo);
  const [filterCity, setFilterCity] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("ALL");
  const [filterRefundStatus, setFilterRefundStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [pageSize, setPageSize] = useState<number>(initialPagination.limit || 20);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AdminCancellationItem | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Synchronize URL with active filters for bookmarking and back navigation
  const syncUrlParams = useCallback(
    (page: number) => {
      const p = new URLSearchParams();
      if (activeTab && activeTab !== "all") p.set("tab", activeTab);
      if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
      if (filterPolicy && filterPolicy !== "ALL") p.set("policy", filterPolicy);
      if (cancellationDateFrom) p.set("dateFrom", cancellationDateFrom);
      if (cancellationDateTo) p.set("dateTo", cancellationDateTo);
      if (checkInFrom) p.set("checkInFrom", checkInFrom);
      if (checkInTo) p.set("checkInTo", checkInTo);
      if (filterCity.trim()) p.set("city", filterCity.trim());
      if (filterCountry.trim()) p.set("country", filterCountry.trim());
      if (filterPaymentStatus && filterPaymentStatus !== "ALL") p.set("paymentStatus", filterPaymentStatus);
      if (filterRefundStatus && filterRefundStatus !== "ALL") p.set("refundStatus", filterRefundStatus);
      if (sortBy !== "createdAt") p.set("sortBy", sortBy);
      if (sortOrder !== "desc") p.set("sortOrder", sortOrder);
      if (pageSize !== 20) p.set("limit", String(pageSize));
      if (page > 1) p.set("page", String(page));

      const queryStr = p.toString();
      const newUrl = queryStr ? `/admin/bookings/cancellations?${queryStr}` : `/admin/bookings/cancellations`;
      window.history.replaceState(null, "", newUrl);
    },
    [
      activeTab,
      debouncedSearch,
      filterPolicy,
      cancellationDateFrom,
      cancellationDateTo,
      checkInFrom,
      checkInTo,
      filterCity,
      filterCountry,
      filterPaymentStatus,
      filterRefundStatus,
      sortBy,
      sortOrder,
      pageSize,
    ]
  );

  // Fetch cancellations from server
  const fetchCancellations = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("limit", String(pageSize));
        if (activeTab && activeTab !== "all") params.set("tab", activeTab);
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (filterPolicy && filterPolicy !== "ALL") params.set("policy", filterPolicy);
        if (cancellationDateFrom) params.set("dateFrom", cancellationDateFrom);
        if (cancellationDateTo) params.set("dateTo", cancellationDateTo);
        if (checkInFrom) params.set("checkInFrom", checkInFrom);
        if (checkInTo) params.set("checkInTo", checkInTo);
        if (filterCity.trim()) params.set("city", filterCity.trim());
        if (filterCountry.trim()) params.set("country", filterCountry.trim());
        if (filterPaymentStatus && filterPaymentStatus !== "ALL") params.set("paymentStatus", filterPaymentStatus);
        if (filterRefundStatus && filterRefundStatus !== "ALL") params.set("refundStatus", filterRefundStatus);
        if (sortBy) params.set("sortBy", sortBy);
        if (sortOrder) params.set("sortOrder", sortOrder);

        const [listRes, summaryRes] = await Promise.all([
          fetch(`/api/v1/admin/bookings/cancellations?${params.toString()}`),
          fetch(`/api/v1/admin/bookings/cancellations/summary`),
        ]);

        const listData = await listRes.json();
        const summaryData = await summaryRes.json();

        if (!listRes.ok) {
          throw new Error(listData.error?.message || listData.message || "Failed to load cancellations");
        }

        // Robust envelope unwrapping
        const rawCancellations = listData.data?.cancellations ?? (Array.isArray(listData.data) ? listData.data : listData.cancellations ?? []);
        const rawPagination = listData.data?.pagination ?? listData.pagination ?? {
          total: rawCancellations.length,
          page: pageToLoad,
          limit: pageSize,
          totalPages: Math.max(1, Math.ceil(rawCancellations.length / pageSize)),
        };

        setCancellations(rawCancellations);
        setPagination(rawPagination);

        if (summaryRes.ok) {
          const rawSummary = summaryData.data ?? summaryData;
          setSummary(rawSummary);
        }

        syncUrlParams(pageToLoad);
      } catch (err: any) {
        setError(err.message || "Failed to load cancellation records.");
      } finally {
        setLoading(false);
      }
    },
    [
      activeTab,
      debouncedSearch,
      filterPolicy,
      cancellationDateFrom,
      cancellationDateTo,
      checkInFrom,
      checkInTo,
      filterCity,
      filterCountry,
      filterPaymentStatus,
      filterRefundStatus,
      sortBy,
      sortOrder,
      pageSize,
      syncUrlParams,
    ]
  );

  // Trigger refetch when tab, search, or page size changes (skip initial mount to preserve SSR)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchCancellations(1);
  }, [activeTab, debouncedSearch, pageSize, fetchCancellations]);

  // Handle Tab Switch
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
  };

  // Handle Preset Date Change
  const handlePresetDateChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    const toDateStr = now.toISOString().slice(0, 10);

    if (preset === "ALL_TIME") {
      setCancellationDateFrom("");
      setCancellationDateTo("");
    } else if (preset === "TODAY") {
      setCancellationDateFrom(toDateStr);
      setCancellationDateTo(toDateStr);
    } else if (preset === "LAST_7_DAYS") {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setCancellationDateFrom(past.toISOString().slice(0, 10));
      setCancellationDateTo(toDateStr);
    } else if (preset === "LAST_30_DAYS") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setCancellationDateFrom(past.toISOString().slice(0, 10));
      setCancellationDateTo(toDateStr);
    } else if (preset === "THIS_MONTH") {
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      setCancellationDateFrom(startOfMonth.toISOString().slice(0, 10));
      setCancellationDateTo(toDateStr);
    }
  };

  // Count active drawer filters
  const activeDrawerFilterCount =
    (filterPolicy !== "ALL" ? 1 : 0) +
    (datePreset !== "ALL_TIME" ? 1 : 0) +
    (checkInFrom || checkInTo ? 1 : 0) +
    (filterCity ? 1 : 0) +
    (filterCountry ? 1 : 0) +
    (filterPaymentStatus !== "ALL" ? 1 : 0) +
    (filterRefundStatus !== "ALL" ? 1 : 0) +
    (sortBy !== "createdAt" || sortOrder !== "desc" ? 1 : 0);

  // Reset all filters to default
  const handleResetAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setActiveTab("all");
    setFilterPolicy("ALL");
    setDatePreset("ALL_TIME");
    setCancellationDateFrom("");
    setCancellationDateTo("");
    setCheckInFrom("");
    setCheckInTo("");
    setFilterCity("");
    setFilterCountry("");
    setFilterPaymentStatus("ALL");
    setFilterRefundStatus("ALL");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPageSize(20);
    setFilterDrawerOpen(false);
  };

  // Export CSV
  const exportCSV = () => {
    if (cancellations.length === 0) return;
    const headers = [
      "Booking Reference",
      "Property Title",
      "City",
      "Country",
      "Guest Name",
      "Guest Email",
      "Host Name",
      "Host Email",
      "Cancelled By",
      "Cancellation Reason",
      "Cancelled Timestamp",
      "Check-In Date",
      "Check-Out Date",
      "Booking Status",
      "Payment Status",
      "Refund Status",
      "Total Price (Cents)",
      "Currency",
    ];

    const rows = cancellations.map((item) => {
      return [
        `"${item.id}"`,
        `"${(item.listing.title || "").replace(/"/g, '""')}"`,
        `"${item.listing.city || ""}"`,
        `"${item.listing.country || ""}"`,
        `"${item.user.name || ""}"`,
        `"${item.user.email || ""}"`,
        `"${item.listing.host.name || ""}"`,
        `"${item.listing.host.email || ""}"`,
        `"${item.cancellation.cancelledBy || "UNKNOWN"}"`,
        `"${(item.cancellation.reason || "").replace(/"/g, '""')}"`,
        `"${item.cancellation.cancelledAt ? formatDateTime(item.cancellation.cancelledAt) : ""}"`,
        `"${formatDate(item.startDate)}"`,
        `"${formatDate(item.endDate)}"`,
        `"${item.status}"`,
        `"${item.paymentStatus}"`,
        `"${item.refundStatus}"`,
        `"${item.totalPrice || 0}"`,
        `"${item.currency}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_cancellations_${new Date().toISOString().slice(0, 10)}.csv`);
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
            <h1>
              Cancellation Management
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#727272]">
            Audit, track, and manage all genuine guest, host, and administrative cancellations across the platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
         

          {/* Export Action */}
          <button
            type="button"
            onClick={exportCSV}
            disabled={cancellations.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => fetchCancellations(pagination.page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchCancellations(1)}
            className="font-semibold underline ml-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Cancellations */}
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "all"
              ? "border-[var(--accent)] bg-[var(--accent)]/5 ring-2 ring-[var(--accent)]/30"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Total Cancellations</span>
            <span className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.totalCancellations ?? 0}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              All authoritative cancellations
            </p>
          </div>
        </button>

        {/* Guest Canceled */}
        <button
          type="button"
          onClick={() => handleTabChange("guest")}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "guest"
              ? "border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/30"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-blue-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Guest Initiated</span>
            <span className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-sm">
              👤
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.guestCancellations ?? 0}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Cancelled by guests</p>
          </div>
        </button>

        {/* Host Canceled */}
        <button
          type="button"
          onClick={() => handleTabChange("host")}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "host"
              ? "border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/30"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-amber-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Host Initiated</span>
            <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-sm">
              🏠
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.hostCancellations ?? 0}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Confirmed stays cancelled by hosts</p>
          </div>
        </button>

        {/* Admin Canceled */}
        <button
          type="button"
          onClick={() => handleTabChange("admin")}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "admin"
              ? "border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/30"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-purple-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Admin Initiated</span>
            <span className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-sm">
              🛡️
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.adminCancellations ?? 0}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Administrative interventions</p>
          </div>
        </button>

        {/* Requires Attention */}
        <button
          type="button"
          onClick={() => handleTabChange("attention")}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all flex flex-col justify-between ${
            activeTab === "attention"
              ? "border-rose-500 bg-rose-50/20 ring-2 ring-rose-500/30"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-rose-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">Needs Review</span>
            <span className="p-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-sm">
              ⚠️
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {summary.requiresAttention ?? 0}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Pending refunds or payment issues</p>
          </div>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border)]">
        {[
          { key: "all", label: "All Cancellations", count: summary.totalCancellations ?? 0 },
          { key: "guest", label: "Guest Canceled", count: summary.guestCancellations ?? 0 },
          { key: "host", label: "Host Canceled", count: summary.hostCancellations ?? 0 },
          { key: "admin", label: "Admin Canceled", count: summary.adminCancellations ?? 0 },
          { key: "attention", label: "Requires Attention", count: summary.requiresAttention ?? 0 },
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

      {/* Search and Advanced Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by ID, property, guest, host, city, country..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Quick Date Presets */}
          <select
            value={datePreset}
            onChange={(e) => handlePresetDateChange(e.target.value as DatePreset)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs font-medium focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="ALL_TIME">Date: All Time</option>
            <option value="TODAY">Date: Today</option>
            <option value="LAST_7_DAYS">Date: Last 7 Days</option>
            <option value="LAST_30_DAYS">Date: Last 30 Days</option>
            <option value="THIS_MONTH">Date: This Month</option>
            <option value="CUSTOM">Date: Custom Range</option>
          </select>

          {/* Page Size Selector */}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs font-medium focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>

          {/* Drawer Trigger Button */}
          <button
            type="button"
            onClick={() => setFilterDrawerOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all ${
              activeDrawerFilterCount > 0
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-foreground"
                : "border-[var(--border)] bg-[var(--surface)] text-foreground hover:bg-[var(--surface-secondary)]"
            }`}
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filters</span>
            {activeDrawerFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] flex items-center justify-center font-bold">
                {activeDrawerFilterCount}
              </span>
            )}
          </button>

          {/* Clear Filters Button if any active filter */}
          {(activeDrawerFilterCount > 0 || searchInput || activeTab !== "all") && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="text-xs text-[var(--muted-foreground)] hover:text-foreground underline px-1"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Cancellations Data Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--muted-foreground)] space-y-3">
            <svg className="w-6 h-6 animate-spin mx-auto text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Retrieving authoritative cancellation records...</span>
          </div>
        ) : cancellations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-foreground">No cancellations found</h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
              {activeDrawerFilterCount > 0 || searchInput || activeTab !== "all"
                ? "No cancellation records match the current filter criteria."
                : "There are currently no recorded canceled bookings in the platform database."}
            </p>
            {(activeDrawerFilterCount > 0 || searchInput || activeTab !== "all") && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="mt-4 px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-foreground text-xs font-semibold border border-[var(--border)] transition-all"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-3.5">Booking ID</th>
                  <th className="px-3.5 py-3.5">Property</th>
                  <th className="px-3.5 py-3.5">Guest</th>
                  <th className="px-3.5 py-3.5">Host</th>
                  <th className="px-3.5 py-3.5">Check-In</th>
                  <th className="px-3.5 py-3.5">Check-Out</th>
                  <th className="px-3.5 py-3.5">Canceled By</th>
                  <th className="px-3.5 py-3.5">Reason</th>
                  <th className="px-3.5 py-3.5">Canceled At</th>
                  <th className="px-3.5 py-3.5">Booking Status</th>
                  <th className="px-3.5 py-3.5">Payment Status</th>
                  <th className="px-3.5 py-3.5">Refund Status</th>
                  <th className="px-3.5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cancellations.map((item) => {
                  const initiator = item.cancellation.cancelledBy || "UNKNOWN";

                  let initiatorBadge = (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      ⏳ Unknown / Historical
                    </span>
                  );
                  if (initiator === "GUEST") {
                    initiatorBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                        👤 Guest
                      </span>
                    );
                  } else if (initiator === "HOST") {
                    initiatorBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        🏠 Host
                      </span>
                    );
                  } else if (initiator === "ADMIN") {
                    initiatorBadge = (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        🛡️ Admin
                      </span>
                    );
                  }

                  // Payment badge style
                  const payUpper = (item.paymentStatus || "").toUpperCase();
                  let payBadgeClass = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
                  if (payUpper === "CAPTURED" || payUpper === "COMPLETED") {
                    payBadgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
                  } else if (payUpper === "FAILED" || payUpper === "VOIDED") {
                    payBadgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300";
                  } else if (payUpper === "AUTHORIZED" || payUpper === "PENDING") {
                    payBadgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
                  }

                  // Refund badge style
                  const refUpper = (item.refundStatus || "").toUpperCase();
                  let refBadgeClass = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
                  if (refUpper === "SUCCEEDED" || refUpper === "COMPLETED") {
                    refBadgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
                  } else if (refUpper === "PENDING" || refUpper === "PROCESSING") {
                    refBadgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
                  } else if (refUpper === "FAILED" || refUpper === "REJECTED") {
                    refBadgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300";
                  } else if (refUpper === "NO_REFUND_DUE") {
                    refBadgeClass = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
                  }

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--surface-secondary)]/30 transition-colors"
                    >
                      {/* Booking ID */}
                      <td className="px-3.5 py-3.5 font-mono text-[11px] text-foreground whitespace-nowrap">
                        <span className="font-semibold">{item.id.slice(0, 10)}</span>
                        {item.requiresAttention && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold">
                            Alert
                          </span>
                        )}
                      </td>

                      {/* Property */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center gap-2 min-w-[150px] max-w-[200px]">
                          <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                            {item.listing.photos?.[0] && (
                              <Image
                                src={item.listing.photos[0]}
                                alt={item.listing.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{item.listing.title}</p>
                            <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                              {item.listing.city || item.listing.country || "Location N/A"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Guest */}
                      <td className="px-3.5 py-3.5 min-w-[130px]">
                        <p className="font-semibold text-foreground truncate">{item.user.name || "Guest"}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] truncate">{item.user.email || "No email"}</p>
                      </td>

                      {/* Host */}
                      <td className="px-3.5 py-3.5 min-w-[130px]">
                        <p className="font-semibold text-foreground truncate">{item.listing.host.name || "Host"}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] truncate">{item.listing.host.email || "No email"}</p>
                      </td>

                      {/* Check-In */}
                      <td className="px-3.5 py-3.5 font-mono text-[11px] text-foreground whitespace-nowrap">
                        {formatDate(item.startDate)}
                      </td>

                      {/* Check-Out */}
                      <td className="px-3.5 py-3.5 font-mono text-[11px] text-foreground whitespace-nowrap">
                        {formatDate(item.endDate)}
                      </td>

                      {/* Canceled By */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        {initiatorBadge}
                      </td>

                      {/* Reason */}
                      <td className="px-3.5 py-3.5 max-w-[160px]">
                        <p className="text-foreground truncate" title={item.cancellation.reason || "No explicit reason"}>
                          {item.cancellation.reason || "No explicit reason"}
                        </p>
                      </td>

                      {/* Canceled At */}
                      <td className="px-3.5 py-3.5 text-[11px] text-foreground whitespace-nowrap">
                        {item.cancellation.cancelledAt ? formatDateTime(item.cancellation.cancelledAt) : "Date unknown"}
                      </td>

                      {/* Booking Status */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                          {item.status}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${payBadgeClass}`}>
                          {item.paymentStatus}
                        </span>
                      </td>

                      {/* Refund Status */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${refBadgeClass}`}>
                          {item.refundStatus}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3.5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground text-xs font-semibold shadow-2xs transition-all"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]/20 text-xs">
          <span className="text-[var(--muted-foreground)]">
            Showing {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} cancellations
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchCancellations(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              ← Previous
            </button>
            <span className="font-semibold text-foreground px-1">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchCancellations(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Drawer (ModalOverlay background scroll lock) */}
      {filterDrawerOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-[var(--surface)] h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <h3 className="text-base font-bold text-foreground">Filter Cancellations</h3>
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Cancellation Date Preset */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Cancellation Date Filter
                  </label>
                  <select
                    value={datePreset}
                    onChange={(e) => handlePresetDateChange(e.target.value as DatePreset)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                  >
                    <option value="ALL_TIME">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="CUSTOM">Custom Range</option>
                  </select>
                </div>

                {/* Custom Cancellation Date Range */}
                {datePreset === "CUSTOM" && (
                  <div>
                    <label className="font-semibold text-foreground block mb-1.5">
                      Custom Cancellation Date Range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={cancellationDateFrom}
                        onChange={(e) => setCancellationDateFrom(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                      />
                      <input
                        type="date"
                        value={cancellationDateTo}
                        onChange={(e) => setCancellationDateTo(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Cancellation Policy Filter */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Cancellation Policy
                  </label>
                  <select
                    value={filterPolicy}
                    onChange={(e) => setFilterPolicy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                  >
                    <option value="ALL">All Policies</option>
                    <option value="FLEXIBLE">Flexible</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="STRICT">Strict</option>
                    <option value="FIRM">Firm</option>
                  </select>
                </div>

                {/* Stay Check-In Range */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Original Stay Check-In Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={checkInFrom}
                      onChange={(e) => setCheckInFrom(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                    />
                    <input
                      type="date"
                      value={checkInTo}
                      onChange={(e) => setCheckInTo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                    />
                  </div>
                </div>

                {/* City and Country Filters */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-foreground block mb-1.5">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Riyadh"
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-foreground block mb-1.5">Country</label>
                    <input
                      type="text"
                      placeholder="e.g. Saudi Arabia"
                      value={filterCountry}
                      onChange={(e) => setFilterCountry(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs"
                    />
                  </div>
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Payment Status</label>
                  <select
                    value={filterPaymentStatus}
                    onChange={(e) => setFilterPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                  >
                    <option value="ALL">All Payment Statuses</option>
                    <option value="CAPTURED">Captured</option>
                    <option value="AUTHORIZED">Authorized</option>
                    <option value="REFUNDED">Refunded</option>
                    <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                    <option value="VOIDED">Voided</option>
                  </select>
                </div>

                {/* Refund Status Filter */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Refund Status</label>
                  <select
                    value={filterRefundStatus}
                    onChange={(e) => setFilterRefundStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                  >
                    <option value="ALL">All Refund Statuses</option>
                    <option value="SUCCEEDED">Succeeded</option>
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="FAILED">Failed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                {/* Sort By Field */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground"
                  >
                    <option value="createdAt">Cancellation Date</option>
                    <option value="startDate">Stay Check-In Date</option>
                    <option value="totalPrice">Total Price</option>
                  </select>
                </div>

                {/* Sort Direction */}
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

            <div className="border-t border-[var(--border)] pt-4 mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)]"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterDrawerOpen(false);
                  fetchCancellations(1);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] text-xs font-semibold shadow-2xs"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Cancellation Details Modal (ModalOverlay background scroll lock) */}
      {selectedItem && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    Cancelled
                  </span>
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    Ref: {selectedItem.id}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-1">
                  Cancellation Audit Record
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cancellation Details Banner */}
            <div className="mt-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--muted-foreground)]">Canceled By:</span>
                <span className="font-bold text-foreground">
                  {selectedItem.cancellation.cancelledBy === "ADMIN"
                    ? `Administrator (${selectedItem.cancellation.adminEmail || "Admin"})`
                    : selectedItem.cancellation.cancelledBy === "GUEST"
                    ? "Guest"
                    : selectedItem.cancellation.cancelledBy === "HOST"
                    ? "Host"
                    : "Unknown / Historical"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--muted-foreground)]">Canceled Timestamp:</span>
                <span className="font-mono text-foreground">
                  {selectedItem.cancellation.cancelledAt ? formatDateTime(selectedItem.cancellation.cancelledAt) : "Not recorded"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-[var(--muted-foreground)] block mb-1">Cancellation Reason:</span>
                <p className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] font-medium text-foreground">
                  {selectedItem.cancellation.reason || "No explicit reason was given upon cancellation."}
                </p>
              </div>
              {selectedItem.cancellation.notes && (
                <div>
                  <span className="font-semibold text-[var(--muted-foreground)] block mb-1">Administrative Notes:</span>
                  <p className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--muted-foreground)]">
                    {selectedItem.cancellation.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Property & Parties */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-[var(--border)] pb-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Property
                </span>
                <p className="font-bold text-foreground mt-1 truncate">{selectedItem.listing.title}</p>
                <p className="text-[var(--muted-foreground)]">{selectedItem.listing.city || selectedItem.listing.country || "Location N/A"}</p>
                <p className="text-[var(--muted-foreground)] mt-0.5">Host: {selectedItem.listing.host.name || "Unknown"}</p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Guest
                </span>
                <p className="font-bold text-foreground mt-1">{selectedItem.user.name || "Guest"}</p>
                <p className="text-[var(--muted-foreground)]">{selectedItem.user.email || "No email"}</p>
                {selectedItem.user.phone && <p className="text-[var(--muted-foreground)]">{selectedItem.user.phone}</p>}
              </div>
            </div>

            {/* Stay Dates */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-b border-[var(--border)] pb-4 text-xs">
              <div className="rounded-xl bg-[var(--surface-secondary)]/50 p-2.5">
                <span className="text-[10px] text-[var(--muted-foreground)] block">Check-In</span>
                <span className="font-bold text-foreground font-mono">{formatDate(selectedItem.startDate)}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-secondary)]/50 p-2.5">
                <span className="text-[10px] text-[var(--muted-foreground)] block">Check-Out</span>
                <span className="font-bold text-foreground font-mono">{formatDate(selectedItem.endDate)}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-secondary)]/50 p-2.5">
                <span className="text-[10px] text-[var(--muted-foreground)] block">Reservation Policy</span>
                <span className="font-bold text-foreground">{selectedItem.cancellationPolicy || "Flexible"}</span>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="mt-4 flex items-center justify-between border-b border-[var(--border)] pb-4 text-xs">
              <div>
                <span className="text-[11px] text-[var(--muted-foreground)]">Original Total Price</span>
                <p className="text-xl font-black text-foreground font-mono">
                  {formatPrice(selectedItem.totalPrice || 0, selectedItem.currency)}
                </p>
              </div>

              {selectedItem.cancellation.guestRefundAmount !== null && (
                <div className="text-right">
                  <span className="text-[11px] text-[var(--muted-foreground)]">Calculated Refund</span>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatPrice(selectedItem.cancellation.guestRefundAmount || 0, selectedItem.currency)}
                  </p>
                </div>
              )}
            </div>

            {/* Payment & Refund Records */}
            {selectedItem.payments && selectedItem.payments.length > 0 && (
              <div className="mt-4 text-xs">
                <span className="font-semibold text-foreground block mb-2">Payment Records</span>
                <div className="space-y-1.5">
                  {selectedItem.payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded-lg bg-[var(--surface-secondary)]/40 flex items-center justify-between font-mono text-[11px]"
                    >
                      <span>
                        {p.status} ({p.provider || "GATEWAY"})
                      </span>
                      <span className="font-bold text-foreground">
                        {formatPrice(p.amount, selectedItem.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedItem.refunds && selectedItem.refunds.length > 0 && (
              <div className="mt-4 text-xs">
                <span className="font-semibold text-foreground block mb-2">Refund Records</span>
                <div className="space-y-1.5">
                  {selectedItem.refunds.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-[var(--surface-secondary)]/40 flex items-center justify-between font-mono text-[11px]"
                    >
                      <span>
                        {r.status} {r.reason ? `• ${r.reason}` : ""}
                      </span>
                      <span className="font-bold text-foreground">
                        {formatPrice(r.amount, selectedItem.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)] transition-all"
              >
                Close
              </button>
              <Link
                href={`/admin/bookings/all?search=${encodeURIComponent(selectedItem.id)}`}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs font-semibold shadow-2xs transition-all"
              >
                View Full Booking
              </Link>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
