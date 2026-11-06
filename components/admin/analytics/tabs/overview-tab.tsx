"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AdminActionCard } from "@/components/admin/ui/admin-action-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AnalyticsAreaChart } from "../charts/analytics-area-chart";
import type { UnifiedOverviewData } from "@/services/admin-analytics/overview.service";
import type { OccupancyAnalyticsData } from "@/services/admin-analytics/occupancy.service";

interface OverviewTabProps {
  overviewData: UnifiedOverviewData;
  occupancyData: OccupancyAnalyticsData;
  timeframeLabel: string;
  comparisonLabel: string;
}

type MetricView = "revenue" | "bookings" | "occupancy";

const fmtSAR = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return "—";
  return `SAR ${Math.round(cents / 100).toLocaleString("en-US")}`;
};

const fmtPct = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(1)}%`;
};

export function OverviewTab({
  overviewData,
  occupancyData,
  timeframeLabel,
  comparisonLabel,
}: OverviewTabProps) {
  const [metricView, setMetricView] = useState<MetricView>("revenue");

  const { kpis, chartPoints, operationalAttention, recentBookings, topListings } = overviewData;

  // Prepare chart series based on selected metricView
  const chartSeries = chartPoints.map((pt) => {
    let value: number | null = 0;
    if (metricView === "revenue") value = Math.round(pt.revenueCents / 100);
    else if (metricView === "bookings") value = pt.bookingsCount;
    else if (metricView === "occupancy") value = pt.occupancyRatePercentage;

    return {
      dateKey: pt.dateKey,
      label: pt.label,
      value,
    };
  });

  const chartColor =
    metricView === "revenue" ? "amber" : metricView === "bookings" ? "emerald" : "sky";

  const chartValueFormatter = (val: number) => {
    if (metricView === "revenue") return `SAR ${val.toLocaleString()}`;
    if (metricView === "occupancy") return `${val.toFixed(1)}%`;
    return `${val.toLocaleString()} bookings`;
  };

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. Primary Business KPIs Grid (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <AdminStatCard
          label="Gross Booking Value"
          value={fmtSAR(kpis.grossBookingValueCents.current)}
          delta={
            kpis.grossBookingValueCents.percentageChange !== null
              ? { value: kpis.grossBookingValueCents.percentageChange }
              : null
          }
          comparisonText={comparisonLabel}
          accentColor="amber"
        />
        <AdminStatCard
          label="Platform Revenue"
          value={fmtSAR(kpis.platformCommissionCents.current)}
          delta={
            kpis.platformCommissionCents.percentageChange !== null
              ? { value: kpis.platformCommissionCents.percentageChange }
              : null
          }
          comparisonText="Realized 3% fee"
          accentColor="emerald"
        />
        <AdminStatCard
          label="Captured Payments"
          value={fmtSAR(kpis.capturedCashCents.current)}
          delta={
            kpis.capturedCashCents.percentageChange !== null
              ? { value: kpis.capturedCashCents.percentageChange }
              : null
          }
          comparisonText="Net after refunds"
          accentColor="sky"
        />
        <AdminStatCard
          label="Confirmed Bookings"
          value={kpis.confirmedBookingsCount.current}
          delta={
            kpis.confirmedBookingsCount.percentageChange !== null
              ? { value: kpis.confirmedBookingsCount.percentageChange }
              : null
          }
          comparisonText="Stays booked"
          accentColor="amber"
        />
        <AdminStatCard
          label="Active Listings"
          value={kpis.activeListingsCount.current}
          delta={
            kpis.activeListingsCount.percentageChange !== null
              ? { value: kpis.activeListingsCount.percentageChange }
              : null
          }
          comparisonText="Published supply"
          accentColor="violet"
        />
        <AdminStatCard
          label="Occupancy Rate"
          value={fmtPct(kpis.occupancyRatePercentage.current)}
          delta={
            kpis.occupancyRatePercentage.percentageChange !== null
              ? {
                  value: kpis.occupancyRatePercentage.percentageChange,
                  isPercentagePoint: kpis.occupancyRatePercentage.isPercentagePoint,
                }
              : null
          }
          comparisonText="Bookable demand"
          accentColor="sky"
        />
      </div>

      {/* 2. Main Performance Chart (65%) & Supporting Insights Panel (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Chart Container (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-medium text-zinc-900 tracking-tight">
                Marketplace Velocity Trend
              </h2>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Daily volume and demand tracking across {timeframeLabel.toLowerCase()}.
              </p>
            </div>

            {/* Metric Switcher */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              {(
                [
                  { id: "revenue", label: "Financial Trend" },
                  { id: "bookings", label: "Bookings" },
                  { id: "occupancy", label: "Occupancy" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMetricView(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    metricView === tab.id
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AnalyticsAreaChart
            data={chartSeries}
            height={260}
            color={chartColor}
            valueFormatter={chartValueFormatter}
          />
        </div>

        {/* Right Side: Supporting Insights Panel (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-2xs flex flex-col justify-between h-full">
          <div>
            <h2 className="text-base font-medium text-zinc-900 tracking-tight mb-1">
              Marketplace Health Summary
            </h2>
            <p className="text-xs font-normal text-zinc-500 mb-5">
              Hospitality performance, dispute health, and support queue velocity.
            </p>

            <div className="divide-y divide-zinc-100 text-xs">
              <div className="flex items-center justify-between py-3">
                <span className="font-normal text-zinc-500">Average Daily Rate (ADR)</span>
                <span className="font-medium text-zinc-900">
                  {fmtSAR(occupancyData.kpis.averageDailyRateCents.current)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-normal text-zinc-500">Revenue per Available Room (RevPAR)</span>
                <span className="font-medium text-zinc-900">
                  {fmtSAR(occupancyData.kpis.revParCents.current)}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-normal text-zinc-500">Bookable Inventory Nights</span>
                <span className="font-medium text-zinc-900">
                  {occupancyData.kpis.bookableNights.current.toLocaleString()} nights
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-normal text-zinc-500">Active Support Backlog</span>
                <span className="font-medium text-zinc-900">
                  {kpis.activeBacklogCases} open cases
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="font-normal text-zinc-500">Unresolved Quality Disputes</span>
                <span className="font-medium text-amber-600">
                  {kpis.activeDisputesCount} active
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/admin/bookings/analytics"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-700 py-2.5 text-xs font-medium border border-zinc-200/70 transition-colors"
          >
            Open Advanced Analytics →
          </Link>
        </div>
      </div>

      {/* 3. Needs Your Attention Section */}
      <div className="flex flex-col gap-3">
        <AdminSectionHeader
          title="Needs Your Attention"
          badge={`${operationalAttention.reduce((sum, item) => sum + item.count, 0)} Items`}
        />
        {operationalAttention.length === 0 || operationalAttention.every((item) => item.count === 0) ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-6 text-center text-xs">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <p className="font-medium text-emerald-900">All Operations Clear</p>
            <p className="font-normal text-emerald-700 mt-0.5">
              No outstanding support tickets, unresolved disputes, or pending listing submissions requiring admin action.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {operationalAttention.map((item) => (
              <AdminActionCard
                key={item.id}
                title={item.title}
                count={item.count}
                severity={item.severity}
                href={item.href}
                actionLabel={item.actionLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Bookings & Top Listings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Bookings (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <AdminSectionHeader title="Recent Reservations in Period" />
          <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
            <div className="divide-y divide-zinc-100">
              {recentBookings.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  No reservations recorded in this period.
                </div>
              ) : (
                recentBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 hover:bg-zinc-50/60 transition-colors">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-900 truncate">
                          {b.guestName}
                        </span>
                        <AdminStatusBadge
                          label={b.status}
                          variant={b.status === "CONFIRMED" ? "success" : b.status === "COMPLETED" ? "neutral" : "warning"}
                        />
                      </div>
                      <p className="text-[11px] font-normal text-zinc-500 truncate mt-0.5">
                        {b.listingTitle} · {b.city || "Saudi Arabia"}
                      </p>
                      <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
                        {b.startDate} to {b.endDate} ({b.nights} nights)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium text-zinc-900">
                        {fmtSAR(b.amountCents)}
                      </div>
                      <Link
                        href={`/admin/bookings?search=${b.id}`}
                        className="text-[10px] font-medium text-amber-600 hover:underline mt-1 block"
                      >
                        Inspect Stay →
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Top Listings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <AdminSectionHeader title="Top Performing Inventory" />
          <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
            <div className="divide-y divide-zinc-100">
              {topListings.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  No property stay activity recorded.
                </div>
              ) : (
                topListings.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-zinc-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-medium text-zinc-600 shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="truncate">
                        <h3 className="text-xs font-medium text-zinc-900 truncate">
                          {p.title}
                        </h3>
                        <p className="text-[11px] font-normal text-zinc-400 truncate">
                          {p.city || "Saudi Arabia"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium text-zinc-900">
                        {fmtSAR(p.revenueCents)}
                      </div>
                      <p className="text-[10px] font-normal text-zinc-400">
                        {p.bookingsCount} stay(s)
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

