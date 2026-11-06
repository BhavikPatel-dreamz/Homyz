"use client";

import React, { useState } from "react";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AnalyticsAreaChart } from "../charts/analytics-area-chart";
import { AnalyticsDonutChart, type DonutSegment } from "../charts/analytics-donut-chart";
import type { OccupancyAnalyticsData } from "@/services/admin-analytics/occupancy.service";

interface OccupancyTabProps {
  occupancyData: OccupancyAnalyticsData;
  timeframeLabel: string;
  comparisonLabel: string;
}

type OccupancyView = "rate" | "booked" | "bookable";

const fmtSAR = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return "—";
  return `SAR ${Math.round(cents / 100).toLocaleString("en-US")}`;
};

const fmtPct = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(1)}%`;
};

export function OccupancyTab({
  occupancyData,
  timeframeLabel,
  comparisonLabel,
}: OccupancyTabProps) {
  const [occView, setOccView] = useState<OccupancyView>("rate");

  const { kpis, dailyTrends, byPropertyType, topUtilizedProperties } = occupancyData;

  // Chart series mapping
  const chartSeries = dailyTrends.map((d) => {
    let value: number | null = 0;
    if (occView === "rate") value = d.occupancyRatePercentage;
    else if (occView === "booked") value = d.bookedNights;
    else if (occView === "bookable") value = d.bookableNights;

    return {
      dateKey: d.dateKey,
      label: d.label,
      value,
    };
  });

  const chartColor = occView === "rate" ? "sky" : occView === "booked" ? "amber" : "emerald";

  // Donut segments for room nights distribution: Booked vs. Available vs. Host Blocked
  const inventorySegments: DonutSegment[] = [
    {
      id: "booked",
      label: "Booked Nights",
      value: kpis.bookedNights.current,
      color: "#0284C7", // sky-600
    },
    {
      id: "available",
      label: "Available Unbooked",
      value: kpis.availableNights.current,
      color: "#059669", // emerald-600
    },
    {
      id: "blocked",
      label: "Host Blocked",
      value: kpis.blockedNights.current,
      color: "#F59E0B", // amber-500
    },
  ];

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. Main Occupancy & Revenue KPIs (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <AdminStatCard
          label="Marketplace Occupancy"
          value={fmtPct(kpis.occupancyRatePercentage.current)}
          delta={
            kpis.occupancyRatePercentage.percentageChange !== null
              ? {
                  value: kpis.occupancyRatePercentage.percentageChange,
                  isPercentagePoint: kpis.occupancyRatePercentage.isPercentagePoint,
                }
              : null
          }
          comparisonText={
            occupancyData.isHistoricalAvailabilityEstimated
              ? `${comparisonLabel} (estimated availability)`
              : comparisonLabel
          }
          accentColor="sky"
        />
        <AdminStatCard
          label="Average Daily Rate (ADR)"
          value={fmtSAR(kpis.averageDailyRateCents.current)}
          delta={
            kpis.averageDailyRateCents.percentageChange !== null
              ? { value: kpis.averageDailyRateCents.percentageChange }
              : null
          }
          comparisonText="Per sold room night"
          accentColor="amber"
        />
        <AdminStatCard
          label="RevPAR"
          value={fmtSAR(kpis.revParCents.current)}
          delta={
            kpis.revParCents.percentageChange !== null
              ? { value: kpis.revParCents.percentageChange }
              : null
          }
          comparisonText="Revenue / bookable night"
          accentColor="violet"
        />
        <AdminStatCard
          label="Booked Room Nights"
          value={kpis.bookedNights.current.toLocaleString()}
          delta={
            kpis.bookedNights.percentageChange !== null
              ? { value: kpis.bookedNights.percentageChange }
              : null
          }
          comparisonText="Stays executed"
          accentColor="sky"
        />
        <AdminStatCard
          label="Bookable Nights"
          value={kpis.bookableNights.current.toLocaleString()}
          delta={
            kpis.bookableNights.percentageChange !== null
              ? { value: kpis.bookableNights.percentageChange }
              : null
          }
          comparisonText={
            occupancyData.isHistoricalAvailabilityEstimated
              ? "Estimated from creation dates"
              : "Excludes host blocks"
          }
          accentColor="emerald"
        />
        <AdminStatCard
          label="Host Blocked Nights"
          value={kpis.blockedNights.current.toLocaleString()}
          delta={
            kpis.blockedNights.percentageChange !== null
              ? { value: kpis.blockedNights.percentageChange, isExpense: true }
              : null
          }
          comparisonText="Unavailable calendar days"
          accentColor="amber"
        />
      </div>

      {/* 2. Main Occupancy Chart (65%) & Inventory Distribution (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Occupancy Curve (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-medium text-zinc-900 tracking-tight">
                Occupancy &amp; Room Night Demand
              </h2>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Hospitality capacity utilization across {timeframeLabel.toLowerCase()}.
              </p>
            </div>

            {/* View Selector */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              {(
                [
                  { id: "rate", label: "Occupancy %" },
                  { id: "booked", label: "Booked Nights" },
                  { id: "bookable", label: "Bookable Inventory" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOccView(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    occView === tab.id
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
            valueFormatter={(v) => (occView === "rate" ? `${v.toFixed(1)}%` : `${v} nights`)}
          />
        </div>

        {/* Right Side: Total Inventory Nights Distribution (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-2xs">
          <h2 className="text-base font-medium text-zinc-900 tracking-tight mb-1">
            Total Inventory Night Allocation
          </h2>
          <p className="text-xs font-normal text-zinc-500 mb-6">
            Calendar capacity divided into confirmed stays, available nights, and manual blocks.
          </p>

          <AnalyticsDonutChart
            segments={inventorySegments}
            size={180}
            centerTitle={`${kpis.totalCalendarNights.current.toLocaleString()}`}
            centerSubtitle="Total Nights"
            valueFormatter={(v) => `${v.toLocaleString()} nights`}
          />
        </div>
      </div>

      {/* 3. Property Type Breakdown & Top Utilized Properties Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Property Type Breakdown (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <AdminSectionHeader title="Performance by Property Type" />
          <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 text-zinc-500 border-b border-zinc-200/60 font-medium">
                <tr>
                  <th className="p-3.5">Property Type</th>
                  <th className="p-3.5">Listings</th>
                  <th className="p-3.5">Booked Nights</th>
                  <th className="p-3.5">Bookable Nights</th>
                  <th className="p-3.5">Occupancy Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-normal text-zinc-700">
                {byPropertyType.map((pt) => (
                  <tr key={pt.propertyType} className="hover:bg-zinc-50/40">
                    <td className="p-3.5 font-medium text-zinc-900">{pt.propertyType}</td>
                    <td className="p-3.5">{pt.listingsCount}</td>
                    <td className="p-3.5">{pt.bookedNights.toLocaleString()}</td>
                    <td className="p-3.5">{pt.bookableNights.toLocaleString()}</td>
                    <td className="p-3.5 font-medium text-zinc-900">
                      {fmtPct(pt.occupancyRatePercentage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most Utilized Properties (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <AdminSectionHeader title="Most Utilized Properties" />
          <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
            <div className="divide-y divide-zinc-100">
              {topUtilizedProperties.map((p, idx) => (
                <div key={p.listingId} className="flex items-center justify-between p-4 hover:bg-zinc-50/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-medium text-zinc-600 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <h3 className="text-xs font-medium text-zinc-900 truncate">
                        {p.title}
                      </h3>
                      <p className="text-[11px] font-normal text-zinc-400 truncate">
                        {p.city || "Saudi Arabia"} · Base ADR: {fmtSAR(p.adrCents)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-zinc-900">
                      {fmtPct(p.occupancyRatePercentage)}
                    </div>
                    <p className="text-[10px] font-normal text-zinc-400">
                      {p.bookedNights} / {p.bookableNights} nights
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

