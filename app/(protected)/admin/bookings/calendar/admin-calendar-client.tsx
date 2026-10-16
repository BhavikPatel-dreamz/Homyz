"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import {
  AdminAllPropertiesCalendar,
  type AdminAllPropertiesCalendarData,
} from "./admin-all-properties-calendar";
import { bookingDateKey } from "@/lib/booking/booking-date";

export interface PropertyListItem {
  id: string;
  title: string;
  city: string | null;
  country: string | null;
  photos: string[];
  price: number;
  status: string;
  host: {
    id: string;
    name: string | null;
    email: string | null;
  };
  bookingCount: number;
}

export interface CalendarBookingItem {
  id: string;
  submissionId: string | null;
  status: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  nights: number;
  guests: number;
  totalPrice: number | null;
  nightlyPrice: number | null;
  cleaningFee: number | null;
  currency: string;
  bookingType: string;
  cancellationPolicy: string | null;
  isPendingHold: boolean;
  expiresAt: string | null;
  countdownText: string | null;
  isUrgent: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone?: string | null;
  };
  payments?: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
  }>;
}

export interface AdminCalendarData {
  listing: {
    id: string;
    title: string;
    city: string | null;
    district: string | null;
    country: string | null;
    photos: string[];
    price: number;
    weekdayBasePrice: number | null;
    weekendPrice?: number | null;
    weekendBasePrice?: number | null;
    customPrices: Record<string, number> | null;
    blockedDates: string[];
    minNights: number | null;
    maxNights: number | null;
    cancellationPolicy: string | null;
    status: string;
    host: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  };
  bookings: CalendarBookingItem[];
  blockedDates: string[];
  customPrices: Record<string, number>;
  monthKey: string;
}

interface AdminCalendarClientProps {
  initialListings: PropertyListItem[];
  initialSelectedListingId: string | null;
  initialCalendarData: AdminCalendarData | null;
  initialAllCalendarData?: AdminAllPropertiesCalendarData | null;
  initialCalendarScope?: "all" | "single";
  initialMonth?: string;
  initialView?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminCalendarClient({
  initialListings,
  initialSelectedListingId,
  initialCalendarData,
  initialAllCalendarData = null,
  initialCalendarScope = "all",
  initialMonth,
  initialView = "month",
}: AdminCalendarClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();

  const now = useMemo(() => new Date(), []);
  const defaultMonthKey = useMemo(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, [now]);

  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    initialSelectedListingId,
  );
  const [calendarScope, setCalendarScope] = useState<"all" | "single">(initialCalendarScope);
  const [currentMonthKey, setCurrentMonthKey] = useState<string>(
    initialMonth || initialCalendarData?.monthKey || defaultMonthKey,
  );
  const [viewMode, setViewMode] = useState<"month" | "year">(
    initialView === "year" ? "year" : "month",
  );

  const [calendarData, setCalendarData] = useState<AdminCalendarData | null>(
    initialCalendarData,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Property search & selector state
  const [listings, setListings] = useState<PropertyListItem[]>(initialListings);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingProperties, setIsSearchingProperties] = useState(false);

  // Filter toggles
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [showHolds, setShowHolds] = useState(true);
  const [showBlocked, setShowBlocked] = useState(true);
  const [showPricing, setShowPricing] = useState(true);

  // Modals state
  const [previewBooking, setPreviewBooking] = useState<CalendarBookingItem | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<CalendarBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Parse active year and month
  const [year, month] = useMemo(() => {
    const parts = currentMonthKey.split("-").map(Number);
    return [parts[0] || now.getFullYear(), parts[1] || now.getMonth() + 1];
  }, [currentMonthKey, now]);

  // Fetch calendar data when listing or month changes
  const fetchCalendarData = useCallback(
    async (listingId: string, monthKey: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/admin/bookings/calendar?listingId=${encodeURIComponent(listingId)}&month=${encodeURIComponent(monthKey)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to load calendar data");
        }
        setCalendarData(data.data || data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load calendar data");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Search listings
  const handleSearchListings = useCallback(async (query: string) => {
    setIsSearchingProperties(true);
    try {
      const res = await fetch(
        `/api/v1/admin/bookings/calendar/listings?search=${encodeURIComponent(query)}&limit=30`,
      );
      const data = await res.json();
      if (res.ok && data.listings) {
        setListings(data.listings);
      }
    } catch {
      // Keep existing list on error
    } finally {
      setIsSearchingProperties(false);
    }
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectorOpen) {
        handleSearchListings(searchQuery);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectorOpen, handleSearchListings]);

  // Handle month navigation
  const navigateMonth = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      const nextKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setCurrentMonthKey(nextKey);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "single");
      params.set("month", nextKey);
      router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
      if (selectedListingId) fetchCalendarData(selectedListingId, nextKey);
      return;
    }

    let nextYear = year;
    let nextMonth = direction === "next" ? month + 1 : month - 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    } else if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    const nextKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    setCurrentMonthKey(nextKey);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "single");
    params.set("month", nextKey);
    router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
    if (selectedListingId) fetchCalendarData(selectedListingId, nextKey);
  };

  // Select listing
  const handleSelectListing = (listing: PropertyListItem) => {
    setSelectedListingId(listing.id);
    setCalendarScope("single");
    setSelectorOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "single");
    params.set("listingId", listing.id);
    params.set("month", currentMonthKey);
    params.set("calendarView", viewMode);
    router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
    fetchCalendarData(listing.id, currentMonthKey);
  };

  const handleSelectSingleProperty = useCallback((listingId: string) => {
    if (!listingId) return;
    setCalendarScope("single");
    setSelectedListingId(listingId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "single");
    params.set("listingId", listingId);
    params.set("month", currentMonthKey);
    params.set("calendarView", viewMode);
    router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
    void fetchCalendarData(listingId, currentMonthKey);
  }, [currentMonthKey, fetchCalendarData, router, searchParams, viewMode]);

  const setSingleViewMode = (nextView: "month" | "year") => {
    setViewMode(nextView);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "single");
    params.set("calendarView", nextView);
    router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
  };

  const returnToAllProperties = () => {
    setCalendarScope("all");
    setSelectedListingId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "all");
    params.delete("listingId");
    params.delete("propertyId");
    params.delete("month");
    router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
  };

  // Perform Admin Cancellation
  const handlePerformCancel = async () => {
    if (!cancelModalBooking) return;
    if (!cancelReason.trim()) {
      setCancelError("Please enter a valid cancellation reason.");
      return;
    }

    setCancelling(true);
    setCancelError(null);

    try {
      const res = await fetch(`/api/v1/admin/bookings/${cancelModalBooking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason.trim(),
          notes: cancelNotes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to cancel reservation");
      }

      // Close modal and refresh calendar
      setCancelModalBooking(null);
      setPreviewBooking(null);
      setCancelReason("");
      setCancelNotes("");
      if (selectedListingId) {
        fetchCalendarData(selectedListingId, currentMonthKey);
      }
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel reservation");
    } finally {
      setCancelling(false);
    }
  };

  // Generate calendar days for active month grid
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    const cells: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayKey = bookingDateKey(now);

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(Date.UTC(year, month - 2, dayNum));
      const key = bookingDateKey(prevDate);
      cells.push({
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const curDate = new Date(Date.UTC(year, month - 1, d));
      const key = bookingDateKey(curDate);
      cells.push({
        dateKey: key,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: key === todayKey,
      });
    }

    // Next month padding to fill rows of 7
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(Date.UTC(year, month, d));
      const key = bookingDateKey(nextDate);
      cells.push({
        dateKey: key,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: key === todayKey,
      });
    }

    return cells;
  }, [year, month, now]);

  // Selected property details
  const selectedListing = useMemo(() => {
    if (calendarData?.listing) return calendarData.listing;
    return listings.find((l) => l.id === selectedListingId) || null;
  }, [calendarData, listings, selectedListingId]);

  if (calendarScope === "all") {
    return (
      <AdminAllPropertiesCalendar
        initialData={initialAllCalendarData}
        onSelectProperty={handleSelectSingleProperty}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-16">
      {/* 7.2 — Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1>
              Reservation Calendar
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#727272]">
            Authoritative property availability, confirmed stays, pending holds, and blocked dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => selectedListingId && fetchCalendarData(selectedListingId, currentMonthKey)}
            disabled={loading || !selectedListingId}
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
            onClick={() => selectedListingId && fetchCalendarData(selectedListingId, currentMonthKey)}
            className="font-semibold underline ml-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* 7.3 — Property Selector Bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-[var(--surface-secondary)] shrink-0 border border-[var(--border)]">
            {selectedListing?.photos?.[0] ? (
              <Image
                src={selectedListing.photos[0]}
                alt={selectedListing.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">
                {selectedListing?.title || "Select a Property"}
              </h2>
              {selectedListing?.status && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {selectedListing.status}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
              {selectedListing ? (
                <>
                  {selectedListing.city || "Unknown City"} • Host: {selectedListing.host?.name || "Unknown"} (
                  {selectedListing.host?.email || ""}) • Base Rate: {formatPrice(selectedListing.price, "SAR")}/night
                </>
              ) : (
                "Search and select a property to view availability"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={returnToAllProperties}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-4 py-2.5 text-xs font-semibold shadow-2xs transition-all"
          >
            All Properties
          </button>
          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-secondary)]/80 text-foreground px-4 py-2.5 text-xs font-semibold shadow-2xs transition-all"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Change Property</span>
          </button>
        </div>
      </div>

      {/* 7.4 — Calendar Controls & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => navigateMonth("prev")}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              title="Previous Month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigateMonth("today")}
              className="px-3 py-1 text-xs font-semibold hover:bg-[var(--surface-secondary)] rounded-lg transition-colors text-foreground"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => navigateMonth("next")}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              title="Next Month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground font-mono">
            {MONTH_NAMES[month - 1]} {year}
          </h3>
        </div>

        {/* View Switcher & Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <button
            type="button"
            onClick={() => setShowConfirmed((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showConfirmed
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)] opacity-60"
            }`}
          >
            ● Confirmed
          </button>

          <button
            type="button"
            onClick={() => setShowHolds((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showHolds
                ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                : "bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)] opacity-60"
            }`}
          >
            ⏳ Holds (24h)
          </button>

          <button
            type="button"
            onClick={() => setShowBlocked((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showBlocked
                ? "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
                : "bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)] opacity-60"
            }`}
          >
            🚫 Blocked
          </button>

          <button
            type="button"
            onClick={() => setShowPricing((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showPricing
                ? "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                : "bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)] opacity-60"
            }`}
          >
            Rates
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 ml-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setSingleViewMode("month")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === "month"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-foreground"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setSingleViewMode("year")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === "year"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-foreground"
              }`}
            >
              Year
            </button>
          </div>
        </div>
      </div>

      {/* 7.5 — Calendar View */}
      {viewMode === "month" ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-center py-2.5">
            {WEEKDAY_NAMES.map((day) => (
              <div key={day} className="text-xs font-bold text-[var(--muted-foreground)]">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border)] bg-[var(--border)]/20">
            {calendarCells.map((cell) => {
              const isBlocked =
                showBlocked &&
                calendarData?.blockedDates?.includes(cell.dateKey);

              // Find active bookings on this date
              const dayBookings = (calendarData?.bookings || []).filter((b) => {
                if (b.isPendingHold && !showHolds) return false;
                if (!b.isPendingHold && !showConfirmed) return false;
                return cell.dateKey >= b.startDate && cell.dateKey < b.endDate;
              });

              // Daily pricing
              const customPrice = calendarData?.customPrices?.[cell.dateKey];
              const displayPrice = customPrice ?? selectedListing?.price ?? null;

              return (
                <div
                  key={cell.dateKey}
                  className={`min-h-[115px] p-2 flex flex-col justify-between transition-colors ${
                    !cell.isCurrentMonth
                      ? "bg-[var(--surface-secondary)]/30 opacity-40"
                      : isBlocked
                      ? "bg-rose-50/40 dark:bg-rose-950/20"
                      : "bg-[var(--surface)]"
                  } ${cell.isToday ? "ring-2 ring-inset ring-[var(--accent)]" : ""}`}
                >
                  {/* Top Bar: Date Number and Nightly Rate */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold text-xs ${
                        cell.isToday
                          ? "w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] flex items-center justify-center font-bold"
                          : cell.isCurrentMonth
                          ? "text-foreground"
                          : "text-zinc-400"
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {showPricing && displayPrice !== null && cell.isCurrentMonth && (
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                        {formatPrice(displayPrice, "SAR")}
                      </span>
                    )}
                  </div>

                  {/* Middle / Bottom Content: Bookings and Blocked status */}
                  <div className="flex flex-col gap-1 mt-1.5 flex-1 justify-end">
                    {/* Blocked Marker */}
                    {isBlocked && (
                      <div className="px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold flex items-center gap-1">
                        <span>🚫</span>
                        <span className="truncate">Blocked</span>
                      </div>
                    )}

                    {/* Bookings / Holds on this date */}
                    {dayBookings.map((b) => {
                      const isCheckIn = cell.dateKey === b.startDate;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setPreviewBooking(b)}
                          className={`w-full text-left px-2 py-1 rounded-md text-[11px] font-semibold transition-all shadow-2xs truncate flex items-center justify-between ${
                            b.isPendingHold
                              ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800"
                              : "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800"
                          }`}
                          title={`${b.user.name || "Guest"} • ${b.isPendingHold ? "Pending Hold" : "Confirmed"} • ${b.startDate} to ${b.endDate}`}
                        >
                          <span className="truncate">
                            {b.isPendingHold ? "⏳ " : "👤 "}
                            {b.user.name || "Guest"}
                          </span>
                          {isCheckIn && (
                            <span className="text-[9px] px-1 rounded bg-black/10 shrink-0 ml-1">
                              In
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Year Overview: 12 Mini Calendars */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MONTH_NAMES.map((name, idx) => {
            const m = idx + 1;
            const daysCount = new Date(year, m, 0).getDate();
            const firstDay = new Date(year, m - 1, 1).getDay();

            return (
              <div
                key={name}
                onClick={() => {
                  const nextKey = `${year}-${String(m).padStart(2, "0")}`;
                  setCurrentMonthKey(nextKey);
                  setViewMode("month");
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("view", "single");
                  params.set("calendarView", "month");
                  params.set("month", nextKey);
                  router.push(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
                  if (selectedListingId) {
                    fetchCalendarData(selectedListingId, nextKey);
                  }
                }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs hover:border-[var(--accent)] cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-2">
                  <span className="text-xs font-bold text-foreground">{name}</span>
                  <span className="text-[10px] text-[var(--accent)] font-semibold">View</span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                  {WEEKDAY_NAMES.map((w) => (
                    <span key={w} className="text-[9px] text-zinc-400 font-semibold">
                      {w[0]}
                    </span>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <span key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysCount }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateK = `${year}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const isBlocked = calendarData?.blockedDates?.includes(dateK);
                    const hasBooking = (calendarData?.bookings || []).some(
                      (b) => dateK >= b.startDate && dateK < b.endDate,
                    );

                    let bgClass = "text-foreground";
                    if (hasBooking) {
                      bgClass = "bg-emerald-500 text-white rounded font-bold";
                    } else if (isBlocked) {
                      bgClass = "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded";
                    }

                    return (
                      <span key={dayNum} className={`py-0.5 text-[9px] ${bgClass}`}>
                        {dayNum}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Reservation Details Modal (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {previewBooking && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                      previewBooking.isPendingHold
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    }`}
                  >
                    {previewBooking.isPendingHold ? "Pending Hold (24h)" : "Confirmed Reservation"}
                  </span>
                  <span className="text-xs font-mono text-[var(--muted-foreground)]">
                    Ref: {previewBooking.id.slice(0, 10)}...
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-1">
                  Reservation Details
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setPreviewBooking(null)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Hold Expiry Alert (If Pending Hold) */}
            {previewBooking.isPendingHold && (
              <div className="mt-4 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span className="text-base">⏳</span>
                <div>
                  <p className="font-semibold">
                    Holding Dates: {previewBooking.countdownText || "Expires soon"}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    This reservation request will automatically expire and release the dates if not accepted by the host.
                  </p>
                </div>
              </div>
            )}

            {/* Guest & Host Information */}
            <div className="mt-5 grid grid-cols-2 gap-4 border-b border-[var(--border)] pb-4 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Guest
                </span>
                <p className="font-bold text-foreground mt-1">
                  {previewBooking.user.name || "Unknown Guest"}
                </p>
                <p className="text-[var(--muted-foreground)]">{previewBooking.user.email || "No email"}</p>
                {previewBooking.user.phone && (
                  <p className="text-[var(--muted-foreground)]">{previewBooking.user.phone}</p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Booking Mode
                </span>
                <p className="font-bold text-foreground mt-1">
                  {previewBooking.bookingType.replace(/_/g, " ")}
                </p>
                <p className="text-[var(--muted-foreground)]">
                  Policy: {previewBooking.cancellationPolicy || "Flexible"}
                </p>
              </div>
            </div>

            {/* Stay Dates & Nights */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-b border-[var(--border)] pb-4 text-xs">
              <div className="rounded-xl bg-[var(--surface-secondary)]/50 p-2.5">
                <span className="text-[10px] text-[var(--muted-foreground)] block">Check-In</span>
                <span className="font-bold text-foreground text-sm font-mono">{previewBooking.startDate}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-secondary)]/50 p-2.5">
                <span className="text-[10px] text-[var(--muted-foreground)] block">Check-Out</span>
                <span className="font-bold text-foreground text-sm font-mono">{previewBooking.endDate}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-secondary)]/50 p-2.5">
                <span className="text-[10px] text-[var(--muted-foreground)] block">Duration</span>
                <span className="font-bold text-foreground text-sm">
                  {previewBooking.nights} night{previewBooking.nights === 1 ? "" : "s"} • {previewBooking.guests} guest{previewBooking.guests === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="mt-4 flex items-center justify-between border-b border-[var(--border)] pb-4 text-xs">
              <div>
                <span className="text-[11px] text-[var(--muted-foreground)]">Total Price</span>
                <p className="text-xl font-black text-foreground font-mono">
                  {formatPrice(previewBooking.totalPrice || 0, previewBooking.currency || "SAR")}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[var(--muted-foreground)]">Nightly Rate</span>
                <p className="text-sm font-bold text-foreground font-mono">
                  {formatPrice(previewBooking.nightlyPrice || 0, previewBooking.currency || "SAR")}/night
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancelModalBooking(previewBooking);
                }}
                className="px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 text-xs font-semibold transition-all"
              >
                Cancel Reservation
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewBooking(null)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)] transition-all"
                >
                  Close
                </button>
                <Link
                  href={`/admin/bookings/all?search=${encodeURIComponent(previewBooking.id)}`}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs font-semibold shadow-2xs transition-all"
                >
                  View Booking Details →
                </Link>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Administrative Cancellation Confirmation Modal (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {cancelModalBooking && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <h3 className="text-base font-bold text-foreground">
                  Cancel Reservation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 text-xs text-[var(--muted-foreground)] space-y-2">
              <p>
                Are you sure you want to administratively cancel this reservation for{" "}
                <strong className="text-foreground">{cancelModalBooking.user.name || "Guest"}</strong>?
              </p>
              <p className="text-rose-600 dark:text-rose-400 font-semibold">
                ⚠️ Dates will be freed immediately and notifications will be dispatched to both the guest and the host.
              </p>
            </div>

            {cancelError && (
              <div className="mt-3 p-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {cancelError}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Host property damage / Administrative override"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Internal Notes (Optional)
                </label>
                <textarea
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional context for the audit log"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                disabled={cancelling}
                className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground text-xs font-semibold hover:bg-[var(--surface-secondary)] transition-all"
              >
                Keep Reservation
              </button>
              <button
                type="button"
                onClick={handlePerformCancel}
                disabled={cancelling || !cancelReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          Property Selector Modal (Uses ModalOverlay)
          ───────────────────────────────────────────────────────────────────────────── */}
      {selectorOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">
                Select Property for Calendar
              </h3>
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-3 relative">
              <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, city, host name, or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            {/* Listings List */}
            <div className="mt-4 overflow-y-auto flex-1 divide-y divide-[var(--border)] pr-1">
              {isSearchingProperties ? (
                <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  Searching properties...
                </div>
              ) : listings.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  No properties found matching your search.
                </div>
              ) : (
                listings.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleSelectListing(l)}
                    className={`w-full text-left py-3 px-2 rounded-xl flex items-center justify-between gap-3 hover:bg-[var(--surface-secondary)] transition-colors ${
                      l.id === selectedListingId ? "bg-[var(--surface-secondary)]/80" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                        {l.photos?.[0] && (
                          <Image
                            src={l.photos[0]}
                            alt={l.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{l.title}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                          {l.city || "Unknown City"} • Host: {l.host?.name || "Unknown"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatPrice(l.price, "SAR")}/night
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)] block">
                        {l.bookingCount} bookings
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
