"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
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

function getDurationNights(start: string, end: string) {
  const d1 = new Date(start).getTime();
  const d2 = new Date(end).getTime();
  return Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
}

export function AdminCancellationsClient({
  initialSummary,
  initialCancellations,
  initialPagination,
  initialTab = "all",
  initialSearch = "",
}: AdminCancellationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const [isPending, startTransition] = useTransition();

  const [summary, setSummary] = useState<AdminCancellationSummary>(initialSummary);
  const [cancellations, setCancellations] = useState<AdminCancellationItem[]>(initialCancellations);
  const [pagination, setPagination] = useState(initialPagination);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [filterPolicy, setFilterPolicy] = useState<string>("ALL");
  const [checkInFrom, setCheckInFrom] = useState<string>("");
  const [checkInTo, setCheckInTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI state
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

  // Fetch cancellations from server
  const fetchCancellations = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(pageToLoad));
        params.set("limit", String(pagination.limit || 20));
        if (activeTab && activeTab !== "all") params.set("tab", activeTab);
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        if (filterPolicy && filterPolicy !== "ALL") params.set("policy", filterPolicy);
        if (checkInFrom) params.set("checkInFrom", checkInFrom);
        if (checkInTo) params.set("checkInTo", checkInTo);
        if (sortBy) params.set("sortBy", sortBy);
        if (sortOrder) params.set("sortOrder", sortOrder);

        const [listRes, summaryRes] = await Promise.all([
          fetch(`/api/v1/admin/bookings/cancellations?${params.toString()}`),
          fetch(`/api/v1/admin/bookings/cancellations/summary`),
        ]);

        const listData = await listRes.json();
        const summaryData = await summaryRes.json();

        if (!listRes.ok) throw new Error(listData.message || listData.error || "Failed to load cancellations");

        setCancellations(listData.cancellations || []);
        setPagination(listData.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
        if (summaryRes.ok) setSummary(summaryData);
      } catch (err: any) {
        setError(err.message || "Failed to load cancellation data");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, debouncedSearch, filterPolicy, checkInFrom, checkInTo, sortBy, sortOrder, pagination.limit],
  );

  // Re-fetch when tab or debounced search changes
  useEffect(() => {
    fetchCancellations(1);
  }, [activeTab, debouncedSearch, fetchCancellations]);

  // Handle Tab Switch
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
  };

  // Count active drawer filters
  const activeDrawerFilterCount =
    (filterPolicy !== "ALL" ? 1 : 0) +
    (checkInFrom ? 1 : 0) +
    (checkInTo ? 1 : 0) +
    (sortBy !== "createdAt" ? 1 : 0);

  // Reset Drawer Filters
  const resetDrawerFilters = () => {
    setFilterPolicy("ALL");
    setCheckInFrom("");
    setCheckInTo("");
    setSortBy("createdAt");
    setSortOrder("desc");
  };

  // Export CSV
  const exportCSV = () => {
    if (cancellations.length === 0) return;
    const headers = [
      "Booking Reference",
      "Property Title",
      "City",
      "Guest Name",
      "Guest Email",
      "Host Name",
      "Host Email",
      "Cancelled By",
      "Cancellation Reason",
      "Cancellation Date",
      "Check-In",
      "Check-Out",
      "Total Price",
      "Currency",
    ];

    const rows = cancellations.map((item) => {
      return [
        `"${item.id}"`,
        `"${(item.listing.title || "").replace(/"/g, '""')}"`,
        `"${item.listing.city || ""}"`,
        `"${item.user.name || ""}"`,
        `"${item.user.email || ""}"`,
        `"${item.listing.host.name || ""}"`,
        `"${item.listing.host.email || ""}"`,
        `"${item.cancellation.cancelledBy || "UNKNOWN"}"`,
        `"${(item.cancellation.reason || "").replace(/"/g, '""')}"`,
        `"${item.cancellation.cancelledAt ? formatDateTime(item.cancellation.cancelledAt) : ""}"`,
        `"${formatDate(item.startDate)}"`,
        `"${formatDate(item.endDate)}"`,
        `"${formatPrice(item.totalPrice || 0, item.currency)}"`,
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
      {/* 8.2 — Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Cancellation Management
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Audit and manage guest, host, and administrative cancellations across the platform.
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
            href="/admin/bookings/calendar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Calendar</span>
          </Link>

          <Link
            href="/admin/bookings/refunds"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Refunds</span>
          </Link>

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

      {/* 8.3 — 5 KPI Metric Cards */}
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
              {summary.totalCancellations}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">All-time cancellations</p>
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
            <span className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              👤
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.guestCancellations}
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
            <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              🏠
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.hostCancellations}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Host cancellations & declines</p>
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
            <span className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              🛡️
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.adminCancellations}
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
            <span className="p-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
              ⚠️
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {summary.requiresAttention}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Pending refund or disputed</p>
          </div>
        </button>
      </div>

      {/* 8.4 — Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border)]">
        {[
          { key: "all", label: "All Cancellations", count: summary.totalCancellations },
          { key: "guest", label: "Guest Canceled", count: summary.guestCancellations },
          { key: "host", label: "Host Canceled", count: summary.hostCancellations },
          { key: "admin", label: "Admin Canceled", count: summary.adminCancellations },
          { key: "attention", label: "Requires Attention", count: summary.requiresAttention },
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

      {/* 8.5 — Search and Advanced Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full max-w-md">
          <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by ID, property, guest or host..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
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

        <div className="flex items-center gap-2 shrink-0">
          {/* Drawer trigger button */}
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
        </div>
      </div>

      {/* 8.6 — Cancellations Data Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--muted-foreground)]">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Syncing cancellations...</span>
          </div>
        ) : cancellations.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-foreground">No cancellations found</h4>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              There are no cancellations matching the active filter and search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Reference</th>
                  <th className="px-4 py-3.5">Property</th>
                  <th className="px-4 py-3.5">Guest & Host</th>
                  <th className="px-4 py-3.5">Initiator</th>
                  <th className="px-4 py-3.5">Reason & Date</th>
                  <th className="px-4 py-3.5">Stay Dates</th>
                  <th className="px-4 py-3.5">Financials</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {cancellations.map((item) => {
                  const nights = getDurationNights(item.startDate, item.endDate);
                  const initiator = item.cancellation.cancelledBy || "UNKNOWN";

                  let initiatorBadge = (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      System
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

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--surface-secondary)]/30 transition-colors"
                    >
                      {/* Reference */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-foreground">
                        <span className="font-semibold">{item.id.slice(0, 8)}</span>
                        {item.requiresAttention && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                            Alert
                          </span>
                        )}
                      </td>

                      {/* Property */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-[160px] max-w-[220px]">
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
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
                            <p className="text-[10px] text-[var(--muted-foreground)] truncate">{item.listing.city || "Unknown City"}</p>
                          </div>
                        </div>
                      </td>

                      {/* Guest & Host */}
                      <td className="px-4 py-3.5 min-w-[150px]">
                        <div>
                          <p className="font-semibold text-foreground">
                            👤 {item.user.name || "Guest"}
                          </p>
                          <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                            Host: {item.listing.host.name || "Unknown"}
                          </p>
                        </div>
                      </td>

                      {/* Initiator */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {initiatorBadge}
                      </td>

                      {/* Reason & Date */}
                      <td className="px-4 py-3.5 min-w-[180px] max-w-[240px]">
                        <p className="text-foreground truncate font-medium">
                          {item.cancellation.reason || "No explicit reason specified"}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                          {item.cancellation.cancelledAt ? formatDateTime(item.cancellation.cancelledAt) : "Date unknown"}
                        </p>
                      </td>

                      {/* Stay Dates */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-mono text-foreground font-semibold">
                          {formatDate(item.startDate)} – {formatDate(item.endDate)}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {nights} night{nights === 1 ? "" : "s"} • {item.guests} guest{item.guests === 1 ? "" : "s"}
                        </p>
                      </td>

                      {/* Financials */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-mono font-bold text-foreground">
                          {formatPrice(item.totalPrice || 0, item.currency)}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          Policy: {item.cancellationPolicy || "Flexible"}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
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

        {/* 8.7 — Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-secondary)]/20 text-xs">
          <span className="text-[var(--muted-foreground)]">
            Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} cancellations
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
            <span className="font-semibold text-foreground">
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

      {/* ─────────────────────────────────────────────────────────────────────────────
          Advanced Filters Drawer (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {filterDrawerOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-[var(--surface)] h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
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
                  </select>
                </div>

                {/* Check-In Dates Filter */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Stay Check-In Range
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

                {/* Sort By Field */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Sort By
                  </label>
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

                {/* Sort Order */}
                <div>
                  <label className="font-semibold text-foreground block mb-1.5">
                    Sort Direction
                  </label>
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
                onClick={resetDrawerFilters}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)]"
              >
                Reset
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

      {/* ─────────────────────────────────────────────────────────────────────────────
          Cancellation Details Modal (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {selectedItem && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
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

            {/* Cancellation Metadata Callout */}
            <div className="mt-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--muted-foreground)]">Cancelled By:</span>
                <span className="font-bold text-foreground">
                  {selectedItem.cancellation.cancelledBy === "ADMIN"
                    ? `Administrator (${selectedItem.cancellation.adminEmail || "Admin"})`
                    : selectedItem.cancellation.cancelledBy || "Unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--muted-foreground)]">Cancelled Timestamp:</span>
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

            {/* Property & Stay Summary */}
            <div className="mt-4 grid grid-cols-2 gap-4 border-b border-[var(--border)] pb-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Property
                </span>
                <p className="font-bold text-foreground mt-1 truncate">{selectedItem.listing.title}</p>
                <p className="text-[var(--muted-foreground)]">{selectedItem.listing.city || "Unknown City"}</p>
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

            {/* Payment Records (if any) */}
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
                href={`/admin/bookings/${selectedItem.id}`}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs font-semibold shadow-2xs transition-all"
              >
                View Full Booking →
              </Link>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

