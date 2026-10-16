"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { useCurrency } from "@/lib/currency-context";

export interface BookingRowItem {
  id: string;
  submissionId: string | null;
  status: string;
  computedStatus: string;
  bookingType: string;
  paymentStatus: string;
  startDate: string;
  endDate: string;
  guests: number;
  totalPrice: number | null;
  nightlyPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  cancellationPolicy: string | null;
  isNonRefundable: boolean;
  createdAt: string;
  updatedAt: string;
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
    price: number;
    city: string | null;
    country: string | null;
    photos: string[];
    hostId: string;
    host: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  };
  payments?: Array<{
    id: string;
    status: string;
    amount: number;
    capturedAmount: number;
    refundedAmount: number;
    provider: string;
    createdAt: string;
  }>;
  refunds?: Array<{
    id: string;
    status: string;
    amount: number;
    reason: string | null;
    createdAt: string;
  }>;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminAllBookingsClientProps {
  initialBookings: BookingRowItem[];
  initialPagination: PaginationMeta;
}

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Canceled" },
  { id: "rejected", label: "Rejected" },
  { id: "expired", label: "Expired" },
] as const;

const SORT_OPTIONS = [
  { label: "Newest bookings", sortBy: "createdAt", sortOrder: "desc" },
  { label: "Oldest bookings", sortBy: "createdAt", sortOrder: "asc" },
  { label: "Check-in: Soonest", sortBy: "startDate", sortOrder: "asc" },
  { label: "Check-in: Latest", sortBy: "startDate", sortOrder: "desc" },
  { label: "Highest amount", sortBy: "totalPrice", sortOrder: "desc" },
  { label: "Lowest amount", sortBy: "totalPrice", sortOrder: "asc" },
] as const;

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

export function AdminAllBookingsClient({
  initialBookings,
  initialPagination,
}: AdminAllBookingsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();

  // Local URL-driven state
  const currentTab = searchParams.get("tab") || "all";
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const currentLimit = Math.min(50, Math.max(10, Number(searchParams.get("limit")) || 20));
  const currentSearch = searchParams.get("search") || "";
  const currentSortBy = searchParams.get("sortBy") || "createdAt";
  const currentSortOrder = searchParams.get("sortOrder") || "desc";

  // Filter drawer state
  const currentBookingType = searchParams.get("bookingType") || "";
  const currentPaymentStatus = searchParams.get("paymentStatus") || "";
  const currentCity = searchParams.get("city") || "";
  const currentCheckInFrom = searchParams.get("checkInFrom") || "";
  const currentCheckInTo = searchParams.get("checkInTo") || "";
  const currentCheckOutFrom = searchParams.get("checkOutFrom") || "";
  const currentCheckOutTo = searchParams.get("checkOutTo") || "";
  const currentCreatedFrom = searchParams.get("createdFrom") || "";
  const currentCreatedTo = searchParams.get("createdTo") || "";

  // Data state
  const [bookings, setBookings] = useState<BookingRowItem[]>(initialBookings);
  const [pagination, setPagination] = useState<PaginationMeta>(initialPagination);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search input state with debounce
  const [searchInput, setSearchInput] = useState<string>(currentSearch);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Drawer & detail modal state
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRowItem | null>(null);

  // Temporary drawer filters while editing
  const [tempBookingType, setTempBookingType] = useState<string>(currentBookingType);
  const [tempPaymentStatus, setTempPaymentStatus] = useState<string>(currentPaymentStatus);
  const [tempCity, setTempCity] = useState<string>(currentCity);
  const [tempCheckInFrom, setTempCheckInFrom] = useState<string>(currentCheckInFrom);
  const [tempCheckInTo, setTempCheckInTo] = useState<string>(currentCheckInTo);
  const [tempCheckOutFrom, setTempCheckOutFrom] = useState<string>(currentCheckOutFrom);
  const [tempCheckOutTo, setTempCheckOutTo] = useState<string>(currentCheckOutTo);
  const [tempCreatedFrom, setTempCreatedFrom] = useState<string>(currentCreatedFrom);
  const [tempCreatedTo, setTempCreatedTo] = useState<string>(currentCreatedTo);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (currentBookingType) count++;
    if (currentPaymentStatus) count++;
    if (currentCity) count++;
    if (currentCheckInFrom || currentCheckInTo) count++;
    if (currentCheckOutFrom || currentCheckOutTo) count++;
    if (currentCreatedFrom || currentCreatedTo) count++;
    return count;
  }, [
    currentBookingType,
    currentPaymentStatus,
    currentCity,
    currentCheckInFrom,
    currentCheckInTo,
    currentCheckOutFrom,
    currentCheckOutTo,
    currentCreatedFrom,
    currentCreatedTo,
  ]);

  // Push new query params to URL
  const updateUrl = useCallback(
    (params: Record<string, string | number | undefined | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, val]) => {
        if (val === undefined || val === null || val === "" || val === "all") {
          sp.delete(key);
        } else {
          sp.set(key, String(val));
        }
      });
      router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Server fetcher triggered by URL changes
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams(searchParams.toString());
      if (!sp.has("limit")) sp.set("limit", String(currentLimit));
      if (!sp.has("page")) sp.set("page", String(currentPage));

      const res = await fetch(`/api/v1/admin/bookings?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to load booking records.");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBookings(json.data);
        if (json.pagination) {
          setPagination({
            page: json.pagination.page,
            limit: json.pagination.limit,
            total: json.pagination.total,
            totalPages: json.pagination.totalPages,
          });
        }
      }
    } catch (err: any) {
      console.error("[AdminAllBookings] Fetch error:", err);
      setError(err?.message || "An error occurred fetching bookings.");
    } finally {
      setLoading(false);
    }
  }, [searchParams, currentLimit, currentPage]);

  // Initial and subsequent sync with searchParams
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Search debounce
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateUrl({ search: value.trim() || undefined, page: 1 });
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    updateUrl({ search: undefined, page: 1 });
  };

  // Tab change
  const handleTabChange = (tabId: string) => {
    updateUrl({ tab: tabId === "all" ? undefined : tabId, page: 1 });
  };

  // Sort change
  const handleSortChange = (sortBy: string, sortOrder: string) => {
    updateUrl({ sortBy, sortOrder, page: 1 });
  };

  // Filter drawer apply
  const handleApplyFilters = () => {
    updateUrl({
      bookingType: tempBookingType || undefined,
      paymentStatus: tempPaymentStatus || undefined,
      city: tempCity || undefined,
      checkInFrom: tempCheckInFrom || undefined,
      checkInTo: tempCheckInTo || undefined,
      checkOutFrom: tempCheckOutFrom || undefined,
      checkOutTo: tempCheckOutTo || undefined,
      createdFrom: tempCreatedFrom || undefined,
      createdTo: tempCreatedTo || undefined,
      page: 1,
    });
    setFilterDrawerOpen(false);
  };

  const handleClearAllFilters = () => {
    setTempBookingType("");
    setTempPaymentStatus("");
    setTempCity("");
    setTempCheckInFrom("");
    setTempCheckInTo("");
    setTempCheckOutFrom("");
    setTempCheckOutTo("");
    setTempCreatedFrom("");
    setTempCreatedTo("");
    updateUrl({
      bookingType: undefined,
      paymentStatus: undefined,
      city: undefined,
      checkInFrom: undefined,
      checkInTo: undefined,
      checkOutFrom: undefined,
      checkOutTo: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      page: 1,
    });
    setFilterDrawerOpen(false);
  };

  // Open drawer and sync temp state
  const handleOpenDrawer = () => {
    setTempBookingType(currentBookingType);
    setTempPaymentStatus(currentPaymentStatus);
    setTempCity(currentCity);
    setTempCheckInFrom(currentCheckInFrom);
    setTempCheckInTo(currentCheckInTo);
    setTempCheckOutFrom(currentCheckOutFrom);
    setTempCheckOutTo(currentCheckOutTo);
    setTempCreatedFrom(currentCreatedFrom);
    setTempCreatedTo(currentCreatedTo);
    setFilterDrawerOpen(true);
  };

  // Export CSV
  const exportCSV = () => {
    if (bookings.length === 0) return;
    const headers = [
      "Booking ID",
      "Listing",
      "City",
      "Host Name",
      "Host Email",
      "Guest Name",
      "Guest Email",
      "Check-In",
      "Check-Out",
      "Nights",
      "Booking Mode",
      "Booking Status",
      "Payment Status",
      "Total Price",
      "Currency",
      "Created At",
    ];
    const rows = bookings.map((b) => {
      const nights = getDurationNights(b.startDate, b.endDate);
      const total = b.totalPrice ?? b.listing.price * nights;
      return [
        `"${b.id}"`,
        `"${(b.listing.title || "").replace(/"/g, '""')}"`,
        `"${b.listing.city || ""}"`,
        `"${b.listing.host.name || ""}"`,
        `"${b.listing.host.email || ""}"`,
        `"${b.user.name || ""}"`,
        `"${b.user.email || ""}"`,
        `"${formatDate(b.startDate)}"`,
        `"${formatDate(b.endDate)}"`,
        `"${nights}"`,
        `"${b.bookingType}"`,
        `"${b.status}"`,
        `"${b.paymentStatus}"`,
        `"${formatPrice(total, b.currency)}"`,
        `"${b.currency}"`,
        `"${formatDateTime(b.createdAt)}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12">
      {/* 4.2 — All Bookings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1>
              All Bookings
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#727272]">
            View and monitor reservations across all properties.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">

          {/* Refresh Action */}
          <button
            type="button"
            onClick={fetchBookings}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            title="Refresh bookings"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{loading ? "Loading..." : "Refresh"}</span>
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={exportCSV}
            disabled={bookings.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4.3 — Booking Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border-subtle)] scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-2xs"
                  : "text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--surface-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 4.5 & 4.6 & 4.7 — Search, Advanced Filters & Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search booking ID, listing, guest, host, or email..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-9 text-xs text-foreground placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--accent)] transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--surface)] transition-colors"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controls: Sort Dropdown + Filters Button + Clear Filters */}
        <div className="flex items-center gap-2">
          {/* Sorting Dropdown */}
          <div className="relative">
            <select
              value={`${currentSortBy}:${currentSortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(":");
                handleSortChange(sb, so);
              }}
              className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground pl-3 pr-8 py-2 text-xs font-semibold shadow-2xs outline-none hover:border-[var(--accent)] transition-colors cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={`${opt.sortBy}:${opt.sortOrder}`} value={`${opt.sortBy}:${opt.sortOrder}`}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <svg
              className="w-3.5 h-3.5 text-[var(--muted-foreground)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={handleOpenDrawer}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all ${
              activeFiltersCount > 0
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--surface)] text-foreground hover:bg-[var(--surface-secondary)]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-1.5 py-0.2 text-[10px] font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Clear Filters (if active) */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs text-[var(--muted-foreground)] hover:text-foreground underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchBookings}
            className="font-semibold underline ml-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4.4 — Main Bookings Table (Desktop) */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">Booking ID</th>
                <th className="py-3 px-3.5">Property</th>
                <th className="py-3 px-3.5">Guest</th>
                <th className="py-3 px-3.5">Host</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Stay Dates</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Nights</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Payment</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Total</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Created</th>
                <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={12} className="py-4 px-3.5">
                      <div className="h-6 bg-[var(--surface-secondary)] rounded-md w-full" />
                    </td>
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-[var(--muted-foreground)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-[var(--muted-foreground)] opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p className="font-semibold text-foreground text-sm">No bookings found matching filters</p>
                      <p className="text-xs text-[var(--muted-foreground)]">Try clearing active filters or adjusting search terms.</p>
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllFilters}
                          className="mt-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--surface)] transition-all"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const nights = getDurationNights(booking.startDate, booking.endDate);
                  const totalPrice = booking.totalPrice ?? booking.listing.price * nights;

                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      {/* Booking ID */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono font-bold text-foreground">
                        #{booking.id.slice(-8)}
                      </td>

                      {/* Property */}
                      <td className="py-3.5 px-3.5 max-w-[200px]">
                        <span className="font-semibold text-foreground truncate block">{booking.listing.title}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] truncate block">
                          {booking.listing.city || "—"}, {booking.listing.country || "—"}
                        </span>
                      </td>

                      {/* Guest */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-semibold text-foreground block">{booking.user.name || "Guest"}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] block">{booking.user.email}</span>
                      </td>

                      {/* Host */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-medium text-foreground block">{booking.listing.host.name || "Host"}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] block">{booking.listing.host.email}</span>
                      </td>

                      {/* Stay Dates */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono text-[11px]">
                        {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                      </td>

                      {/* Nights */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono">
                        {nights}n
                      </td>

                      {/* Booking Mode */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono text-[10px]">
                        {booking.bookingType === "INSTANT_BOOK" ? "Instant" : "Request"}
                      </td>

                      {/* Booking Status */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            booking.status === "CONFIRMED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : booking.status === "CANCELLED"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                            booking.paymentStatus === "CAPTURED" || booking.paymentStatus === "PAID"
                              ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : booking.paymentStatus === "FAILED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {booking.paymentStatus}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono font-semibold text-foreground">
                        {formatPrice(totalPrice, booking.currency)}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
                        {formatDate(booking.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(booking);
                          }}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4.13 — Mobile Bookings Card List */}
      <div className="md:hidden flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 h-28 animate-pulse" />
          ))
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted-foreground)]">
            No bookings found matching filters.
          </div>
        ) : (
          bookings.map((booking) => {
            const nights = getDurationNights(booking.startDate, booking.endDate);
            const totalPrice = booking.totalPrice ?? booking.listing.price * nights;

            return (
              <div
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2.5 active:bg-[var(--surface-secondary)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-[10px] text-foreground block">#{booking.id.slice(-8)}</span>
                    <h3 className="font-bold text-xs text-foreground mt-0.5">{booking.listing.title}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      booking.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : booking.status === "CANCELLED"
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-bold">Guest</span>
                    <span className="font-semibold text-foreground">{booking.user.name || "Guest"}</span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-bold">Amount</span>
                    <span className="font-bold text-foreground font-mono">{formatPrice(totalPrice, booking.currency)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-bold">Dates</span>
                    <span className="font-mono text-[var(--muted-foreground)]">
                      {formatDate(booking.startDate)} → {formatDate(booking.endDate)} ({nights} nights)
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    Pay: {booking.paymentStatus}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBooking(booking);
                    }}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4.8 — Server-Side Pagination Controls */}
      <AdminPagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        pageSize={pagination.limit}
        onPageChange={(page) => updateUrl({ page })}
        onPageSizeChange={(size) => updateUrl({ limit: size, page: 1 })}
        itemLabel="bookings"
        pageSizeOptions={[10, 20, 50]}
      />

      {/* 4.6 — Advanced Filters Drawer (Using ModalOverlay) */}
      {filterDrawerOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-[var(--surface)] text-foreground p-6 shadow-2xl border-l border-[var(--border)] flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-5">
                <div>
                  <h3 className="text-base font-bold text-foreground">Advanced Filters</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">Filter booking records across properties.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Filter Fields Form */}
              <div className="flex flex-col gap-4 text-xs overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
                {/* Booking Mode */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    Booking Mode
                  </label>
                  <select
                    value={tempBookingType}
                    onChange={(e) => setTempBookingType(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-foreground outline-none"
                  >
                    <option value="">All Modes</option>
                    <option value="INSTANT_BOOK">Instant Book</option>
                    <option value="REQUEST_TO_BOOK">Request to Book</option>
                  </select>
                </div>

                {/* Payment Status */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    Payment Status
                  </label>
                  <select
                    value={tempPaymentStatus}
                    onChange={(e) => setTempPaymentStatus(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-foreground outline-none"
                  >
                    <option value="">All Payment Statuses</option>
                    <option value="CAPTURED">Captured / Paid</option>
                    <option value="AUTHORIZED">Authorized</option>
                    <option value="PENDING">Pending</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                    <option value="VOIDED">Voided</option>
                  </select>
                </div>

                {/* City / Location */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={tempCity}
                    onChange={(e) => setTempCity(e.target.value)}
                    placeholder="e.g. Riyadh, Jeddah"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs text-foreground outline-none"
                  />
                </div>

                {/* Check-In Date Range */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    Check-In Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={tempCheckInFrom}
                      onChange={(e) => setTempCheckInFrom(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-foreground outline-none"
                    />
                    <input
                      type="date"
                      value={tempCheckInTo}
                      onChange={(e) => setTempCheckInTo(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-foreground outline-none"
                    />
                  </div>
                </div>

                {/* Check-Out Date Range */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    Check-Out Date Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={tempCheckOutFrom}
                      onChange={(e) => setTempCheckOutFrom(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-foreground outline-none"
                    />
                    <input
                      type="date"
                      value={tempCheckOutTo}
                      onChange={(e) => setTempCheckOutTo(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-foreground outline-none"
                    />
                  </div>
                </div>

                {/* Created Date Range */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                    Booking Creation Date
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={tempCreatedFrom}
                      onChange={(e) => setTempCreatedFrom(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-foreground outline-none"
                    />
                    <input
                      type="date"
                      value={tempCreatedTo}
                      onChange={(e) => setTempCreatedTo(e.target.value)}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs text-foreground outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="border-t border-[var(--border-subtle)] pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-xs font-semibold text-[var(--muted-foreground)] hover:text-foreground underline"
              >
                Clear All
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] px-5 py-2 text-xs font-semibold shadow-2xs hover:bg-[var(--accent-hover)] transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Booking Details Modal (Shared ModalOverlay) */}
      {selectedBooking && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] text-foreground p-6 shadow-2xl border border-[var(--border)] flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Booking Details #{selectedBooking.id.slice(-8)}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Created {formatDateTime(selectedBooking.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="rounded-xl bg-[var(--surface-secondary)] p-3.5 border border-[var(--border-subtle)] flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  Property Information
                </span>
                <p className="font-bold text-sm text-foreground">{selectedBooking.listing.title}</p>
                <p className="text-[var(--muted-foreground)]">
                  Location: {selectedBooking.listing.city || "—"}, {selectedBooking.listing.country || "—"}
                </p>
                <p className="text-[var(--muted-foreground)]">
                  Host: {selectedBooking.listing.host.name || selectedBooking.listing.host.email}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">
                    Guest Information
                  </span>
                  <p className="font-bold text-foreground">{selectedBooking.user.name || "Guest"}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{selectedBooking.user.email}</p>
                  {selectedBooking.user.phone && (
                    <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{selectedBooking.user.phone}</p>
                  )}
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{selectedBooking.guests} Guests</p>
                </div>

                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">
                    Status & Policy
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[var(--accent-foreground)] w-fit">
                      {selectedBooking.status}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                      {selectedBooking.bookingType}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      Policy: {selectedBooking.cancellationPolicy || "Standard"}
                      {selectedBooking.isNonRefundable ? " (Non-refundable)" : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--surface-secondary)] p-3.5 border border-[var(--border-subtle)] flex justify-between items-center font-mono">
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] block uppercase font-sans font-bold">
                    Stay Dates
                  </span>
                  <span className="font-bold">
                    {formatDate(selectedBooking.startDate)} → {formatDate(selectedBooking.endDate)}
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)] block font-sans">
                    ({getDurationNights(selectedBooking.startDate, selectedBooking.endDate)} nights)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--muted-foreground)] block uppercase font-sans font-bold">
                    Total Amount
                  </span>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {formatPrice(selectedBooking.totalPrice ?? 0, selectedBooking.currency)}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)] block font-sans">
                    Payment: {selectedBooking.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="rounded-full bg-[var(--primary)] text-primary-foreground px-5 py-2 text-xs font-semibold shadow-2xs hover:opacity-90 transition-opacity"
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

