"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";

export interface BookingSummaryData {
  totalBookings: number;
  pendingRequests: number;
  confirmedBookings: number;
  upcomingBookings: number;
  activeStays: number;
  completedBookings: number;
  canceledBookings: number;
  paymentIssues: number;
  grossBookingValue: number;
  currency: string;
}

export interface PendingRequestItem {
  id: string;
  submissionId: string | null;
  status: string;
  bookingType: string;
  startDate: string;
  endDate: string;
  guests: number;
  totalPrice: number | null;
  currency: string;
  createdAt: string;
  expiresAt: string;
  countdownText: string;
  isUrgent: boolean;
  isExpired: boolean;
  hoursRemaining: number;
  minutesRemaining: number;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    photos: string[];
    host: {
      id: string;
      name: string | null;
      email: string | null;
    };
  };
}

export interface RecentBookingItem {
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
  currency: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    photos: string[];
    host: {
      id: string;
      name: string | null;
      email: string | null;
    };
  };
}

export interface BookingActivityItem {
  id: string;
  action: string;
  description: string;
  bookingId: string | null;
  actorEmail: string | null;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
}

interface AdminBookingDashboardClientProps {
  initialSummary: BookingSummaryData;
  initialPendingRequests: PendingRequestItem[];
  initialRecentBookings: RecentBookingItem[];
  initialRecentActivity: BookingActivityItem[];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
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

export function AdminBookingDashboardClient({
  initialSummary,
  initialPendingRequests,
  initialRecentBookings,
  initialRecentActivity,
}: AdminBookingDashboardClientProps) {
  const { formatPrice } = useCurrency();

  const [summary, setSummary] = useState<BookingSummaryData>(initialSummary);
  const [pendingRequests, setPendingRequests] = useState<PendingRequestItem[]>(initialPendingRequests);
  const [recentBookings, setRecentBookings] = useState<RecentBookingItem[]>(initialRecentBookings);
  const [recentActivity, setRecentActivity] = useState<BookingActivityItem[]>(initialRecentActivity);

  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedBooking, setSelectedBooking] = useState<RecentBookingItem | PendingRequestItem | null>(null);

  const loadData = useCallback(async (selectedPeriod: string, from?: string, to?: string) => {
    setIsRefreshing(true);
    setError(null);

    try {
      let summaryUrl = `/api/v1/admin/bookings/summary?period=${encodeURIComponent(selectedPeriod)}`;
      if (selectedPeriod === "custom" && from && to) {
        summaryUrl += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      }

      const [summaryRes, pendingRes, activityRes] = await Promise.all([
        fetch(summaryUrl),
        fetch("/api/v1/admin/bookings/pending?limit=5"),
        fetch("/api/v1/admin/bookings/activity?limit=10"),
      ]);

      if (!summaryRes.ok) throw new Error("Failed to load booking summary metrics");
      const summaryJson = await summaryRes.json();
      if (summaryJson.success && summaryJson.data) {
        setSummary(summaryJson.data);
      }

      if (pendingRes.ok) {
        const pendingJson = await pendingRes.json();
        if (pendingJson.success && Array.isArray(pendingJson.data)) {
          setPendingRequests(pendingJson.data);
        }
      }

      if (activityRes.ok) {
        const activityJson = await activityRes.json();
        if (activityJson.success && Array.isArray(activityJson.data)) {
          setRecentActivity(activityJson.data);
        }
      }
    } catch (err: any) {
      console.error("[AdminBookingDashboard] Error refreshing dashboard:", err);
      setError(err?.message || "An error occurred while fetching dashboard data.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (newPeriod !== "custom") {
      loadData(newPeriod);
    }
  };

  const handleApplyCustomDate = () => {
    if (customFrom && customTo) {
      loadData("custom", customFrom, customTo);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12">
      {/* 3.2 — Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Booking Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Monitor and manage reservations across Homyz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              disabled={isRefreshing}
              className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground pl-3 pr-8 py-2 text-xs font-semibold shadow-2xs outline-none hover:border-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Date: Today</option>
              <option value="last7days">Date: Last 7 Days</option>
              <option value="last30days">Date: Last 30 Days</option>
              <option value="thismonth">Date: This Month</option>
              <option value="custom">Date: Custom Range</option>
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

          {/* Custom Date Inputs if selected */}
          {period === "custom" && (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground px-2.5 py-1.5 text-xs outline-none"
              />
              <span className="text-xs text-[var(--muted-foreground)]">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground px-2.5 py-1.5 text-xs outline-none"
              />
              <button
                type="button"
                onClick={handleApplyCustomDate}
                className="rounded-xl bg-[var(--primary)] text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            </div>
          )}

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => loadData(period, customFrom, customTo)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </button>

       

          {/* View All Bookings Navigation */}
          <Link
            href="/admin/bookings/all"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>View All Bookings</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadData(period, customFrom, customTo)}
            className="font-semibold underline ml-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3.3 — Summary KPI Cards (Eight Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Bookings */}
        <Link
          href="/admin/bookings/all?tab=all"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-[var(--accent)] hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Total Bookings</span>
            <span className="p-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {summary.totalBookings}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              {period === "all" ? "All-time bookings created" : "Created in selected period"}
            </p>
          </div>
        </Link>

        {/* Card 2: Pending Requests */}
        <Link
          href="/admin/bookings/all?tab=pending"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Pending Requests</span>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {summary.pendingRequests}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Awaiting host approval (24h window)
            </p>
          </div>
        </Link>

        {/* Card 3: Confirmed Bookings */}
        <Link
          href="/admin/bookings/all?tab=confirmed"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-emerald-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Confirmed Bookings</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {summary.confirmedBookings}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Confirmed reservations
            </p>
          </div>
        </Link>

        {/* Card 4: Upcoming Bookings */}
        <Link
          href="/admin/bookings/all?tab=upcoming"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-blue-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Upcoming Bookings</span>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
              {summary.upcomingBookings}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Confirmed stays arriving in future
            </p>
          </div>
        </Link>

        {/* Card 5: Active Stays */}
        <Link
          href="/admin/bookings/all?tab=active"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-indigo-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Active Stays</span>
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 font-mono">
              {summary.activeStays}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Currently in-house guests today
            </p>
          </div>
        </Link>

        {/* Card 6: Completed Bookings */}
        <Link
          href="/admin/bookings/all?tab=completed"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-[var(--accent)] hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Completed Bookings</span>
            <span className="p-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
              {summary.completedBookings}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Successfully finished trips
            </p>
          </div>
        </Link>

        {/* Card 7: Canceled Bookings */}
        <Link
          href="/admin/bookings/all?tab=cancelled"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-rose-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Canceled Bookings</span>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {summary.canceledBookings}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Canceled by guest, host, or system
            </p>
          </div>
        </Link>

        {/* Card 8: Payment Issues */}
        <Link
          href="/admin/bookings/all?tab=all&paymentStatus=FAILED"
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs hover:border-red-400 hover:shadow-sm transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Payment Issues</span>
            <span className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-red-600 dark:text-red-400 font-mono">
              {summary.paymentIssues}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
              Failed payments or capture errors
            </p>
          </div>
        </Link>
      </div>

      {/* 3.4 — Pending Booking Requests Section */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Pending Booking Requests
              </h2>
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                  {pendingRequests.length} Urgent
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Host approvals awaiting action. Ordered with most urgent 24-hour response deadlines first.
            </p>
          </div>

          <Link
            href="/admin/bookings/all?tab=pending"
            className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <span>View All Pending</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">
            <svg className="w-8 h-8 mx-auto text-[var(--muted-foreground)] mb-2 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No pending booking requests requiring attention.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 whitespace-nowrap">Booking ID</th>
                  <th className="py-3 px-3">Property</th>
                  <th className="py-3 px-3">Guest</th>
                  <th className="py-3 px-3">Host</th>
                  <th className="py-3 px-3 whitespace-nowrap">Dates</th>
                  <th className="py-3 px-3 whitespace-nowrap">Requested</th>
                  <th className="py-3 px-3 whitespace-nowrap">Approval Deadline</th>
                  <th className="py-3 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {pendingRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                    onClick={() => setSelectedBooking(req)}
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                      #{req.id.slice(-8)}
                    </td>

                    <td className="py-3.5 px-3 max-w-[180px]">
                      <span className="font-semibold text-foreground truncate block">{req.listing.title}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] truncate block">{req.listing.city || "—"}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-medium text-foreground block">{req.user.name || "Guest"}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] block">{req.user.email}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-medium text-foreground block">{req.listing.host.name || "Host"}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] block">{req.listing.host.email}</span>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(req.startDate)} → {formatDate(req.endDate)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
                      {formatDateTime(req.createdAt)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          req.isExpired
                            ? "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                            : req.isUrgent
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 animate-pulse"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {req.countdownText}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                        PENDING
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBooking(req);
                        }}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-[var(--surface-secondary)] transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3.5 — Recent Bookings Section */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              Recent Bookings
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Latest reservation records created across the platform.
            </p>
          </div>

          <Link
            href="/admin/bookings/all"
            className="text-xs font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1 shrink-0"
          >
            <span>View All Bookings</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {recentBookings.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--muted-foreground)]">
            No recent bookings found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 whitespace-nowrap">Booking ID</th>
                  <th className="py-3 px-3">Property</th>
                  <th className="py-3 px-3">Guest</th>
                  <th className="py-3 px-3">Host</th>
                  <th className="py-3 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 whitespace-nowrap">Payment</th>
                  <th className="py-3 px-3 whitespace-nowrap">Total Amount</th>
                  <th className="py-3 px-3 whitespace-nowrap">Created</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                    onClick={() => setSelectedBooking(b)}
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-foreground whitespace-nowrap">
                      #{b.id.slice(-8)}
                    </td>

                    <td className="py-3.5 px-3 max-w-[180px]">
                      <span className="font-semibold text-foreground truncate block">{b.listing.title}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] truncate block">{b.listing.city || "—"}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-medium text-foreground block">{b.user.name || "Guest"}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] block">{b.user.email}</span>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-medium text-foreground block">{b.listing.host.name || "Host"}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] block">{b.listing.host.email}</span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          b.status === "CONFIRMED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : b.status === "CANCELLED"
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold ${
                          b.paymentStatus === "CAPTURED" || b.paymentStatus === "PAID"
                            ? "bg-emerald-100/60 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : b.paymentStatus === "FAILED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {b.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap font-mono font-semibold text-foreground">
                      {formatPrice(b.totalPrice ?? 0, b.currency)}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap text-[11px] text-[var(--muted-foreground)]">
                      {formatDate(b.createdAt)}
                    </td>

                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBooking(b);
                        }}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-[var(--surface-secondary)] transition-all"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3.6 — Recent Booking Activity Timeline */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-2xs">
        <div className="border-b border-[var(--border-subtle)] pb-4 mb-4">
          <h2 className="text-sm sm:text-base font-bold text-foreground">
            Recent Booking Activity
          </h2>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Immutable audit trail of recent booking state transitions and events.
          </p>
        </div>

        {recentActivity.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
            No booking activity recorded yet.
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {recentActivity.map((event, idx) => {
                const isLast = idx === recentActivity.length - 1;
                return (
                  <li key={event.id}>
                    <div className="relative pb-6">
                      {!isLast && (
                        <span
                          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-[var(--border-subtle)]"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-start space-x-3">
                        <div>
                          <div className="h-8 w-8 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)]">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">
                              {event.action.replace(/_/g, " ")}
                            </p>
                            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                              {event.description}
                              {event.actorEmail && (
                                <span className="ml-1.5 text-zinc-500">
                                  by <strong className="text-foreground">{event.actorEmail}</strong>
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right text-[11px] whitespace-nowrap text-[var(--muted-foreground)]">
                            {formatDateTime(event.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

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
                  Property
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
                    Guest
                  </span>
                  <p className="font-bold text-foreground">{selectedBooking.user.name || "Guest"}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{selectedBooking.user.email}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1">{selectedBooking.guests} Guests</p>
                </div>

                <div className="rounded-xl bg-[var(--surface-secondary)] p-3 border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)] block mb-1">
                    Status & Mode
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[var(--accent-foreground)] w-fit">
                      {selectedBooking.status}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                      {selectedBooking.bookingType}
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
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
              <Link
                href={`/admin/bookings/all?search=${encodeURIComponent(selectedBooking.id)}`}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Find in All Bookings →
              </Link>

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

