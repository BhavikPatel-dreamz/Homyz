"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCurrency } from "@/lib/currency-context";

interface AdminAnalyticsClientProps {
  initialOverview: any;
  initialProperties: any[];
  initialHosts: any[];
  initialPeriod: string;
}

export function AdminAnalyticsClient({
  initialOverview,
  initialProperties,
  initialHosts,
  initialPeriod,
}: AdminAnalyticsClientProps) {
  const { formatPrice } = useCurrency();
  const [period, setPeriod] = useState<string>(initialPeriod || "30d");
  const [overview, setOverview] = useState<any>(initialOverview);
  const [properties, setProperties] = useState<any[]>(initialProperties);
  const [hosts, setHosts] = useState<any[]>(initialHosts);
  const [loading, setLoading] = useState(false);

  // Property Table Search & Pagination
  const [propSearch, setPropSearch] = useState("");
  const [propPage, setPropPage] = useState(1);

  // Host Table Search & Pagination
  const [hostSearch, setHostSearch] = useState("");
  const [hostPage, setHostPage] = useState(1);

  const fetchOverview = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/bookings/analytics/overview?period=${p}`);
      const json = await res.json();
      const data = json.data ?? json;
      setOverview(data);
    } catch (err) {
      console.error("[AdminAnalyticsClient] Overview error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    fetchOverview(newPeriod);
  };

  const primaryCurrency = Object.keys(overview.kpi?.currencies || {})[0] || "SAR";
  const currencyData = overview.kpi?.currencies?.[primaryCurrency] || {
    grossCaptured: 0,
    refunded: 0,
    netCollected: 0,
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bookings"
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              ← Bookings Hub
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-[var(--muted-foreground)]">Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Booking & Financial Analytics
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Understand booking performance, cancellations, refunds, and financial trends across Homyz.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/bookings/reports"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Generate Reports</span>
          </Link>
          <Link
            href="/admin/bookings/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Payments</span>
          </Link>
          <button
            type="button"
            onClick={() => fetchOverview(period)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <span>{loading ? "Updating..." : "Refresh Data"}</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)] w-full sm:w-max">
        {[
          { id: "today", label: "Today" },
          { id: "7d", label: "Last 7 Days" },
          { id: "30d", label: "Last 30 Days" },
          { id: "this_month", label: "This Month" },
          { id: "last_month", label: "Last Month" },
          { id: "90d", label: "Last 90 Days" },
          { id: "this_year", label: "This Year" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handlePeriodChange(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              period === tab.id
                ? "bg-[var(--surface)] text-foreground shadow-2xs font-bold"
                : "text-[var(--muted-foreground)] hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-[var(--muted-foreground)]">
            Total Bookings
          </span>
          <p className="text-xl font-black text-foreground mt-1">
            {overview.kpi?.totalBookings?.toLocaleString() || 0}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
            Confirmed
          </span>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {overview.kpi?.confirmedBookings?.toLocaleString() || 0}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Completed Stays
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {overview.kpi?.completedBookings?.toLocaleString() || 0}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
            Cancellation Rate
          </span>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {overview.kpi?.cancellationRate}%
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
            Gross Captured
          </span>
          <p className="text-lg font-black text-foreground mt-1">
            {formatPrice(currencyData.grossCaptured / 100)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
            Successful Refunds
          </span>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatPrice(currencyData.refunded / 100)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-3xs uppercase font-bold tracking-wider text-[var(--accent)]">
            Net Collected
          </span>
          <p className="text-lg font-black text-foreground mt-1">
            {formatPrice(currencyData.netCollected / 100)}
          </p>
        </div>
      </div>

      {/* Main Trends & Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Trends Visual (2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Booking Activity Trends</h3>
                <p className="text-3xs text-[var(--muted-foreground)]">Daily volume of new, confirmed, and completed reservations</p>
              </div>
              <span className="text-3xs font-mono text-[var(--muted-foreground)] bg-[var(--surface-secondary)] px-2.5 py-1 rounded-lg">
                Period: {period}
              </span>
            </div>

            {/* Time Series Bar Chart */}
            <div className="h-48 flex items-end gap-1.5 pt-4 pb-2 border-b border-[var(--border)] overflow-x-auto">
              {overview.bookingTrends?.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">
                  No booking events recorded in this time window.
                </div>
              ) : (
                overview.bookingTrends?.map((point: any) => {
                  const maxCount = Math.max(1, ...overview.bookingTrends.map((p: any) => p.newBookings));
                  const heightPercent = Math.min(100, Math.max(15, (point.newBookings / maxCount) * 100));

                  return (
                    <div key={point.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full mb-1 z-30 hidden rounded-md bg-[var(--primary)] text-primary-foreground px-2 py-1 text-3xs font-semibold shadow-lg group-hover:block whitespace-nowrap">
                        {point.date}: {point.newBookings} new ({point.confirmed} conf, {point.cancelled} canc)
                      </div>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full rounded-t-md bg-[var(--accent)] hover:opacity-80 transition-all"
                      />
                      <span className="text-4xs text-[var(--muted-foreground)] truncate max-w-full">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-3xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent)] inline-block" />
              <span>New Bookings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>Cancelled</span>
            </div>
          </div>
        </div>

        {/* Status Distribution (1 Column) */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Status Distribution</h3>
            <p className="text-3xs text-[var(--muted-foreground)] mb-4">Lifecycle breakdown across current cohort</p>

            <div className="flex flex-col gap-3">
              {[
                { label: "Confirmed", count: overview.statusDistribution?.CONFIRMED || 0, color: "bg-blue-500" },
                { label: "Completed", count: overview.statusDistribution?.COMPLETED || 0, color: "bg-emerald-500" },
                { label: "Pending", count: overview.statusDistribution?.PENDING || 0, color: "bg-amber-500" },
                { label: "Cancelled", count: overview.statusDistribution?.CANCELLED || 0, color: "bg-rose-500" },
              ].map((item) => {
                const total = Math.max(1, overview.kpi?.totalBookings || 1);
                const pct = ((item.count / total) * 100).toFixed(1);

                return (
                  <div key={item.label} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="text-3xs text-[var(--muted-foreground)]">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%` }} className={`h-full ${item.color} rounded-full`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] mt-4">
            <span className="text-3xs text-[var(--muted-foreground)] block">
              Active Disputes in Period: <strong>{overview.disputeAnalytics?.totalCases || 0}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Financial Performance Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Gateways Performance */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-foreground mb-1">Gateway Performance</h3>
          <p className="text-3xs text-[var(--muted-foreground)] mb-4">Provider capture distribution and attempts</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30">
              <span className="text-3xs text-[var(--muted-foreground)] block">Payment Attempts</span>
              <span className="text-base font-bold text-foreground mt-0.5 block">
                {overview.paymentPerformance?.totalAttempts || 0}
              </span>
            </div>
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30">
              <span className="text-3xs text-rose-600 block">Declined / Failed</span>
              <span className="text-base font-bold text-rose-600 mt-0.5 block">
                {overview.paymentPerformance?.failedAttempts || 0}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {Object.entries(overview.paymentPerformance?.providers || {}).map(([prov, data]: [string, any]) => (
              <div key={prov} className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs">
                <span className="font-bold text-foreground">{prov}</span>
                <span className="text-[var(--muted-foreground)]">
                  {data.count} charges • {formatPrice(data.volume / 100)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cancellation Reasons Breakdown */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-foreground mb-1">Cancellation Analysis</h3>
          <p className="text-3xs text-[var(--muted-foreground)] mb-4">Reported reasons for cancelled reservations</p>

          <div className="flex flex-col gap-2">
            {Object.keys(overview.cancellationAnalytics?.reasons || {}).length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)] py-6 text-center">
                Zero cancellations in this period.
              </p>
            ) : (
              Object.entries(overview.cancellationAnalytics?.reasons || {}).map(([reason, count]: [string, any]) => (
                <div key={reason} className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground truncate max-w-xs">{reason}</span>
                  <span className="text-3xs font-bold text-rose-600">{count} bookings</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Property Performance Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface-secondary)]/30">
          <div>
            <h3 className="text-sm font-bold text-foreground">Property Performance</h3>
            <p className="text-3xs text-[var(--muted-foreground)]">Volume, completions, and revenue by property</p>
          </div>
          <input
            type="text"
            placeholder="Search properties..."
            value={propSearch}
            onChange={(e) => setPropSearch(e.target.value)}
            className="h-8 px-3 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl text-foreground placeholder-[var(--muted-foreground)]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold uppercase text-3xs tracking-wider">
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4">Completed</th>
                <th className="py-3 px-4">Cancellations</th>
                <th className="py-3 px-4">Gross Captured</th>
                <th className="py-3 px-4">Refunded</th>
                <th className="py-3 px-4 text-right">Net Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[var(--muted-foreground)]">
                    No properties recorded yet.
                  </td>
                </tr>
              ) : (
                properties
                  .filter((p) => !propSearch || p.title.toLowerCase().includes(propSearch.toLowerCase()))
                  .map((p) => (
                    <tr key={p.listingId} className="hover:bg-[var(--surface-secondary)]/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground max-w-xs truncate">{p.title}</td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)]">{p.host?.name || "Host"}</td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)]">{p.city || "N/A"}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">{p.totalBookings}</td>
                      <td className="py-3 px-4 text-emerald-600">{p.completedStays}</td>
                      <td className="py-3 px-4 text-rose-600">{p.cancellations}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">{formatPrice(p.grossVolumeCents / 100)}</td>
                      <td className="py-3 px-4 text-rose-600">{formatPrice(p.refundVolumeCents / 100)}</td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">{formatPrice(p.netVolumeCents / 100)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Host Performance Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface-secondary)]/30">
          <div>
            <h3 className="text-sm font-bold text-foreground">Host Performance</h3>
            <p className="text-3xs text-[var(--muted-foreground)]">Host listing portfolios, bookings, and net payouts</p>
          </div>
          <input
            type="text"
            placeholder="Search hosts..."
            value={hostSearch}
            onChange={(e) => setHostSearch(e.target.value)}
            className="h-8 px-3 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-xl text-foreground placeholder-[var(--muted-foreground)]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold uppercase text-3xs tracking-wider">
                <th className="py-3 px-4">Host Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Listings</th>
                <th className="py-3 px-4">Total Bookings</th>
                <th className="py-3 px-4">Completed</th>
                <th className="py-3 px-4">Cancellations</th>
                <th className="py-3 px-4">Gross Bookings</th>
                <th className="py-3 px-4 text-right">Net Host Payouts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {hosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--muted-foreground)]">
                    No hosts recorded yet.
                  </td>
                </tr>
              ) : (
                hosts
                  .filter((h) => !hostSearch || (h.name && h.name.toLowerCase().includes(hostSearch.toLowerCase())))
                  .map((h) => (
                    <tr key={h.hostId} className="hover:bg-[var(--surface-secondary)]/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-foreground">{h.name || "Host"}</td>
                      <td className="py-3 px-4 text-[var(--muted-foreground)]">{h.email}</td>
                      <td className="py-3 px-4 text-foreground font-semibold">{h.listingCount}</td>
                      <td className="py-3 px-4 text-foreground font-semibold">{h.totalBookings}</td>
                      <td className="py-3 px-4 text-emerald-600">{h.completedStays}</td>
                      <td className="py-3 px-4 text-rose-600">{h.cancellations}</td>
                      <td className="py-3 px-4 font-semibold text-foreground">{formatPrice(h.grossBookingVolumeCents / 100)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatPrice(h.netHostPayoutsCents / 100)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

