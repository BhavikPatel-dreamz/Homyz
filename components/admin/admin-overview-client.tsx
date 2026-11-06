"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminBusinessOverviewData } from "@/services/admin-business-overview.service";
import { AdminPageHeader } from "./ui/admin-page-header";
import { AdminStatCard } from "./ui/admin-stat-card";
import { AdminSectionHeader } from "./ui/admin-section-header";
import { AdminActionCard } from "./ui/admin-action-card";
import { AdminStatusBadge } from "./ui/admin-status-badge";

interface AdminOverviewClientProps {
  initialData: AdminBusinessOverviewData;
}

const fmtSAR = (cents: number) => {
  const sar = Math.round(cents / 100);
  return `SAR ${sar.toLocaleString("en-US")}`;
};

const fmtCompactSAR = (cents: number) => {
  const units = cents / 100;
  if (units >= 1_000_000) return `SAR ${(units / 1_000_000).toFixed(1)}M`;
  if (units >= 10_000) return `SAR ${(units / 1_000).toFixed(0)}k`;
  if (units >= 1_000) return `SAR ${(units / 1_000).toFixed(1).replace(".0", "")}k`;
  return `SAR ${Math.round(units)}`;
};

export function AdminOverviewClient({ initialData }: AdminOverviewClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<AdminBusinessOverviewData>(initialData);
  const [chartMetric, setChartMetric] = useState<"revenue" | "bookings">("revenue");
  const [chartView, setChartView] = useState<"bar" | "line">("bar");
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(data.timeframe.period || "30d");

  const handlePeriodChange = (period: "7d" | "30d" | "this_month" | "90d") => {
    setSelectedPeriod(period);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/overview?period=${period}`);
        if (!res.ok) throw new Error("Failed to load overview");
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
      } catch {
        router.refresh();
      }
    });
  };

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/overview?period=${selectedPeriod}`);
        if (!res.ok) throw new Error("Failed to refresh");
        const json = await res.json();
        if (json.data) {
          setData(json.data);
        }
      } catch {
        router.refresh();
      }
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ["Metric", "Value", "Delta"],
      ["Gross Booking Value", fmtSAR(data.kpi.grossBookingValueCents), `${data.kpi.grossBookingValueDelta ?? 0}%`],
      ["Confirmed Bookings", String(data.kpi.confirmedBookingsCount), `${data.kpi.confirmedBookingsDelta ?? 0}%`],
      ["Platform Revenue", fmtSAR(data.kpi.platformRevenueCents), `${data.kpi.platformRevenueDelta ?? 0}%`],
      ["Active Listings", String(data.kpi.activeListingsCount), `${data.kpi.activeListingsDelta ?? 0}%`],
      ["Registered Guests", String(data.kpi.registeredGuestsCount), `${data.kpi.registeredGuestsDelta ?? 0}%`],
      ["Active Hosts", String(data.kpi.activeHostsCount), `${data.kpi.activeHostsDelta ?? 0}%`],
      [],
      ["Date", "Revenue", "Bookings"],
      ...data.chartPoints.map((p) => [p.date, fmtSAR(p.revenueCents), String(p.bookingsCount)]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `homyz-admin-overview-${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chart maximum and scaling
  const chartPoints = data.chartPoints || [];
  const maxRevenue = useMemo(() => {
    const raw = Math.max(1000, ...chartPoints.map((p) => p.revenueCents));
    return Math.ceil(raw / 100000) * 100000 || 500000;
  }, [chartPoints]);

  const maxBookings = useMemo(() => {
    const raw = Math.max(5, ...chartPoints.map((p) => p.bookingsCount));
    return Math.ceil(raw / 5) * 5;
  }, [chartPoints]);

  // SVG Line Chart Spline generator
  const lineChartData = useMemo(() => {
    if (chartView !== "line" || chartPoints.length === 0) return null;
    const svgW = 600;
    const svgH = 180;
    const padX = 16;
    const padY = 16;
    const usableW = svgW - padX * 2;
    const usableH = svgH - padY * 2;
    const n = chartPoints.length;

    const coords = chartPoints.map((pt, i) => {
      const x = padX + (n <= 1 ? usableW / 2 : (i / (n - 1)) * usableW);
      const ratio =
        chartMetric === "revenue"
          ? Math.min(1, Math.max(0, pt.revenueCents / maxRevenue))
          : Math.min(1, Math.max(0, pt.bookingsCount / maxBookings));
      const y = svgH - padY - ratio * usableH;
      return { x, y, ...pt };
    });

    if (coords.length <= 1) return null;

    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    const areaPath = `${linePath} L ${last.x} ${svgH - padY} L ${first.x} ${svgH - padY} Z`;

    return { svgW, svgH, coords, linePath, areaPath };
  }, [chartView, chartPoints, chartMetric, maxRevenue, maxBookings]);

  return (
    <div className="flex flex-col gap-7 font-sans text-zinc-900 pb-16">
      {/* ── SECTION A: Page Heading & Controls ── */}
      <AdminPageHeader
        title="Overview"
        description="Monitor marketplace performance, financial activity, and operational health."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Timeframe Presets */}
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 shadow-2xs">
              {(
                [
                  { key: "7d", label: "7D" },
                  { key: "30d", label: "30D" },
                  { key: "this_month", label: "Month" },
                  { key: "90d", label: "90D" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handlePeriodChange(tab.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                    selectedPeriod === tab.key
                      ? "bg-zinc-900 text-white shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh Action */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              title="Refresh overview metrics"
              className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <svg
                className={`size-4 ${isPending ? "animate-spin text-amber-600" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>

            {/* Export Report Action */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-all shadow-2xs cursor-pointer"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export Report</span>
            </button>
          </div>
        }
      />

      {/* ── SECTION B: Primary Business KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <AdminStatCard
          label="Total Booking Value"
          value={fmtCompactSAR(data.kpi.grossBookingValueCents)}
          subtitle={data.timeframe.comparisonLabel}
          delta={
            data.kpi.grossBookingValueDelta !== null
              ? { value: data.kpi.grossBookingValueDelta }
              : null
          }
          iconColor="amber"
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
        />

        <AdminStatCard
          label="Confirmed Bookings"
          value={data.kpi.confirmedBookingsCount}
          subtitle={data.timeframe.comparisonLabel}
          delta={
            data.kpi.confirmedBookingsDelta !== null
              ? { value: data.kpi.confirmedBookingsDelta }
              : null
          }
          iconColor="emerald"
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />

        <AdminStatCard
          label="Platform Revenue"
          value={fmtCompactSAR(data.kpi.platformRevenueCents)}
          subtitle="3% Host fee"
          delta={
            data.kpi.platformRevenueDelta !== null
              ? { value: data.kpi.platformRevenueDelta }
              : null
          }
          iconColor="violet"
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />

        <AdminStatCard
          label="Active Listings"
          value={data.kpi.activeListingsCount}
          subtitle="Published properties"
          delta={
            data.kpi.activeListingsDelta !== null
              ? { value: data.kpi.activeListingsDelta }
              : null
          }
          iconColor="sky"
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
        />

        <AdminStatCard
          label="Registered Guests"
          value={data.kpi.registeredGuestsCount}
          subtitle="Customer accounts"
          delta={
            data.kpi.registeredGuestsDelta !== null
              ? { value: data.kpi.registeredGuestsDelta }
              : null
          }
          iconColor="zinc"
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          }
        />

        <AdminStatCard
          label="Active Hosts"
          value={data.kpi.activeHostsCount}
          subtitle="Verified hosts"
          delta={
            data.kpi.activeHostsDelta !== null
              ? { value: data.kpi.activeHostsDelta }
              : null
          }
          iconColor="amber"
          icon={
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          }
        />
      </div>

      {/* ── SECTION C: Revenue & Booking Analytics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column (~65% width): Main Interactive Analytics Chart */}
        <div className="lg:col-span-8 flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
          {/* Chart Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-normal text-zinc-500">
                  {chartMetric === "revenue" ? "Realized Revenue" : "Booking Volume"}
                </span>
                <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                  {data.timeframe.label}
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 mt-0.5">
                {chartMetric === "revenue"
                  ? fmtSAR(data.kpi.grossBookingValueCents)
                  : `${data.kpi.confirmedBookingsCount} bookings`}
              </p>
            </div>

            {/* Metric & View Switchers */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Metric Toggle */}
              <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50/70 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setChartMetric("revenue")}
                  className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                    chartMetric === "revenue"
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric("bookings")}
                  className={`rounded-lg px-3 py-1 transition-all cursor-pointer ${
                    chartMetric === "bookings"
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Bookings
                </button>
              </div>

              {/* View Toggle (Bar / Line) */}
              <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50/70 p-0.5">
                <button
                  type="button"
                  onClick={() => setChartView("bar")}
                  title="Bar view"
                  className={`flex size-7 items-center justify-center rounded-lg transition-all cursor-pointer ${
                    chartView === "bar"
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-400 hover:text-zinc-700"
                  }`}
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setChartView("line")}
                  title="Line view"
                  className={`flex size-7 items-center justify-center rounded-lg transition-all cursor-pointer ${
                    chartView === "line"
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-400 hover:text-zinc-700"
                  }`}
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="relative w-full h-[220px] sm:h-[240px] flex pt-2 overflow-visible">
            {/* SVG Defs */}
            <svg className="size-0 absolute" aria-hidden="true">
              <defs>
                <linearGradient id="adminBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5D061" />
                  <stop offset="100%" stopColor="#3E382A" />
                </linearGradient>
                <linearGradient id="adminLineArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5D061" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#F5D061" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Y-Axis */}
            <div className="w-12 shrink-0 flex flex-col justify-between text-right pr-2 text-[10px] font-normal text-zinc-400 select-none pb-6">
              {[1, 0.75, 0.5, 0.25, 0].map((step, idx) => (
                <span key={idx} className="leading-none whitespace-nowrap">
                  {chartMetric === "revenue"
                    ? fmtCompactSAR(maxRevenue * step)
                    : Math.round(maxBookings * step)}
                </span>
              ))}
            </div>

            {/* Chart Grid & Elements */}
            <div className="relative flex-1 flex flex-col justify-between overflow-visible">
              {/* Dotted Gridlines */}
              <div className="absolute inset-x-0 inset-y-0 pb-6 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-full border-b border-dashed border-zinc-200/60" />
                ))}
              </div>

              {/* Bar View */}
              {chartView === "bar" && (
                <div className="relative z-10 size-full pb-6 flex items-end justify-between gap-1 sm:gap-1.5 px-1 overflow-visible">
                  {chartPoints.map((pt, idx) => {
                    const val = chartMetric === "revenue" ? pt.revenueCents : pt.bookingsCount;
                    const max = chartMetric === "revenue" ? maxRevenue : maxBookings;
                    const pct = Math.min(100, Math.max(0, (val / max) * 100));
                    const isHovered = hoveredPointIdx === idx;

                    return (
                      <div
                        key={pt.date}
                        onMouseEnter={() => setHoveredPointIdx(idx)}
                        onMouseLeave={() => setHoveredPointIdx(null)}
                        className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer group overflow-visible"
                      >
                        {/* Hover Tooltip */}
                        {isHovered && (
                          <div
                            className="absolute z-50 pointer-events-none rounded-xl bg-zinc-900/95 backdrop-blur-xs px-3 py-1.5 text-center text-white shadow-xl border border-zinc-700/60 whitespace-nowrap -translate-x-1/2 left-1/2 animate-in fade-in zoom-in-95 duration-100"
                            style={{ bottom: `calc(${pct}% + 8px)` }}
                          >
                            <p className="text-[10px] font-normal text-zinc-300 leading-tight">
                              {pt.label}
                            </p>
                            <p className="text-xs font-medium text-[#FCDF9C] mt-0.5 leading-tight">
                              {fmtSAR(pt.revenueCents)}
                            </p>
                            <p className="text-[9.5px] font-normal text-zinc-400 mt-0.5 leading-tight">
                              {pt.bookingsCount} {pt.bookingsCount === 1 ? "booking" : "bookings"}
                            </p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 size-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-zinc-900" />
                          </div>
                        )}

                        {/* Bar Pillar */}
                        {pct > 0 ? (
                          <div
                            style={{ height: `${pct}%` }}
                            className={`w-full max-w-[20px] sm:max-w-[26px] rounded-t-[4px] transition-all duration-300 ${
                              isHovered ? "brightness-110 scale-x-105" : ""
                            }`}
                          >
                            <div
                              className="size-full rounded-t-[4px]"
                              style={{
                                background:
                                  "linear-gradient(180deg, #F5D061 0%, #3E382A 100%)",
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-[2px] w-full max-w-[20px] sm:max-w-[26px] bg-zinc-200 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Line View */}
              {chartView === "line" && lineChartData && (
                <div className="relative z-10 size-full pb-6 overflow-visible">
                  <svg
                    viewBox={`0 0 ${lineChartData.svgW} ${lineChartData.svgH}`}
                    className="size-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <path d={lineChartData.areaPath} fill="url(#adminLineArea)" />
                    <path
                      d={lineChartData.linePath}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {lineChartData.coords.map((c, idx) => {
                      const isHovered = hoveredPointIdx === idx;
                      return (
                        <circle
                          key={c.date}
                          cx={c.x}
                          cy={c.y}
                          r={isHovered ? 5.5 : 3}
                          fill="#FFFFFF"
                          stroke="#D97706"
                          strokeWidth={isHovered ? 2.5 : 2}
                          className="cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredPointIdx(idx)}
                          onMouseLeave={() => setHoveredPointIdx(null)}
                        />
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* X-Axis Labels */}
              <div className="w-full flex items-center justify-between text-[10px] font-normal text-zinc-400 pt-2 border-t border-zinc-200/80">
                {chartPoints
                  .filter((_, idx, arr) => {
                    if (arr.length <= 7) return true;
                    if (idx === 0 || idx === arr.length - 1) return true;
                    const step = Math.max(1, Math.floor(arr.length / 5));
                    return idx % step === 0;
                  })
                  .map((p) => (
                    <span key={p.date} className="truncate">
                      {p.label}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (~35% width): Supporting Insights */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          {/* Card 1: Booking Status Distribution */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
            <h3 className="text-xs sm:text-sm font-medium text-zinc-800 mb-3">
              Booking Status Distribution
            </h3>
            <div className="space-y-2.5">
              {data.bookingStatusDistribution.map((item) => (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-normal text-zinc-600 truncate">{item.label}</span>
                    </div>
                    <span className="font-medium text-zinc-900 shrink-0">
                      {item.count} <span className="text-zinc-400 font-normal">({item.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Revenue Source Breakdown */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
            <h3 className="text-xs sm:text-sm font-medium text-zinc-800 mb-3">
              Revenue Source Breakdown
            </h3>
            <div className="space-y-2">
              {data.revenueSourceBreakdown.map((item) => (
                <div key={item.source} className="flex items-center justify-between text-xs py-1 border-b border-zinc-100 last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-normal text-zinc-600 truncate">{item.source}</span>
                  </div>
                  <span className="font-medium text-zinc-900 shrink-0">
                    {fmtSAR(item.amountCents)}{" "}
                    <span className="text-zinc-400 font-normal">({item.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Pending Financial Actions */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
            <h3 className="text-xs sm:text-sm font-medium text-zinc-800 mb-2.5">
              Pending Financial Actions
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                href="/admin/bookings/payouts"
                className="flex flex-col p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors border border-zinc-100"
              >
                <span className="text-zinc-500 text-[11px] font-normal">Pending Payouts</span>
                <span className="font-medium text-zinc-900 mt-0.5">
                  {fmtCompactSAR(data.pendingFinancialActions.pendingPayoutsCents)}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {data.pendingFinancialActions.pendingPayoutsCount} queued
                </span>
              </Link>

              <Link
                href="/admin/bookings/refunds?status=PENDING"
                className="flex flex-col p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors border border-zinc-100"
              >
                <span className="text-zinc-500 text-[11px] font-normal">Pending Refunds</span>
                <span className="font-medium text-zinc-900 mt-0.5">
                  {fmtCompactSAR(data.pendingFinancialActions.pendingRefundsCents)}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {data.pendingFinancialActions.pendingRefundsCount} requests
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION D: Operational Attention ("Needs your attention") ── */}
      <div className="space-y-3.5">
        <AdminSectionHeader
          title="Needs your attention"
          description="Operational workflows requiring verification, compliance review, or dispute resolution."
          badge={data.operationalAttention.filter((i) => i.count > 0).length}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {data.operationalAttention.map((item) => (
            <AdminActionCard
              key={item.id}
              title={item.title}
              count={item.count}
              description={item.description}
              href={item.href}
              severity={item.severity}
              icon={
                <svg className="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
            />
          ))}
        </div>
      </div>

      {/* ── SECTION E: Marketplace Performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Recent Bookings Activity Table (~65% width) */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-medium text-zinc-900 tracking-tight">
                Recent Booking Activity
              </h2>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Latest guest reservations made across active listings.
              </p>
            </div>
            <Link
              href="/admin/bookings/all"
              className="text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
            >
              View all bookings →
            </Link>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-xs text-zinc-700">
              <thead className="border-b border-zinc-100 text-[11px] font-normal text-zinc-400">
                <tr>
                  <th className="pb-3 font-normal">Listing</th>
                  <th className="pb-3 font-normal">Guest</th>
                  <th className="pb-3 font-normal">Stay Dates</th>
                  <th className="pb-3 font-normal">Amount</th>
                  <th className="pb-3 font-normal">Status</th>
                  <th className="pb-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-normal">
                {data.recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400 font-normal">
                      No recent bookings in this period.
                    </td>
                  </tr>
                ) : (
                  data.recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          {b.listingPhoto ? (
                            <img
                              src={b.listingPhoto}
                              alt={b.listingTitle}
                              className="size-9 rounded-lg object-cover shrink-0 border border-zinc-100"
                            />
                          ) : (
                            <div className="size-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              </svg>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 truncate max-w-[180px]">
                              {b.listingTitle}
                            </p>
                            <p className="text-[11px] text-zinc-400 font-normal truncate">
                              {[b.city, b.country].filter(Boolean).join(", ")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <p className="font-medium text-zinc-800">{b.guestName}</p>
                        <p className="text-[10px] text-zinc-400 font-normal truncate max-w-[120px]">
                          {b.guestEmail}
                        </p>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap text-zinc-600 font-normal">
                        {b.startDate} → {b.endDate}
                        <span className="text-[10px] text-zinc-400 block font-normal">
                          {b.nights} {b.nights === 1 ? "night" : "nights"}
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap font-medium text-zinc-900">
                        {fmtSAR(b.amountCents)}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <AdminStatusBadge status={b.status} size="sm" />
                      </td>
                      <td className="py-3 pl-2 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/bookings?search=${b.id}`}
                          className="inline-flex items-center text-xs font-medium text-zinc-600 hover:text-amber-700 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Performing Listings (~35% width) */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-medium text-zinc-900 tracking-tight">
              Top Properties
            </h2>
            <Link
              href="/admin/listings"
              className="text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
            >
              All listings →
            </Link>
          </div>

          <div className="space-y-3">
            {data.topListings.map((prop, idx) => (
              <div
                key={prop.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-zinc-50 transition-colors border border-zinc-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-500 shrink-0">
                    {idx + 1}
                  </span>
                  {prop.photo ? (
                    <img
                      src={prop.photo}
                      alt={prop.title}
                      className="size-10 rounded-lg object-cover shrink-0 border border-zinc-100"
                    />
                  ) : (
                    <div className="size-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-xs text-zinc-900 truncate">
                      {prop.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 font-normal truncate">
                      {[prop.city, prop.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-zinc-900">
                    {fmtCompactSAR(prop.revenueCents)}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-normal">
                    {prop.bookingsCount} stays
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION F & G: Financial Summary & Recent Audit Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Financial Summary Card (~50% width) */}
        <div className="lg:col-span-6 flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-medium text-zinc-900 tracking-tight">
                Financial Summary
              </h2>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Settlement obligations and platform fee recognition.
              </p>
            </div>
            <Link
              href="/admin/bookings/payments"
              className="text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
            >
              Finance ledger →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-500 text-[11px] font-normal">Gross Bookings</span>
              <p className="text-base font-medium text-zinc-900 mt-1">
                {fmtSAR(data.financialSummary.grossBookingsCents)}
              </p>
              <span className="text-[10px] text-zinc-400 font-normal">Total reserved GMV</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-500 text-[11px] font-normal">Platform Fees (3%)</span>
              <p className="text-base font-medium text-emerald-700 mt-1">
                {fmtSAR(data.financialSummary.platformFeesCents)}
              </p>
              <span className="text-[10px] text-zinc-400 font-normal">Platform recognized income</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-500 text-[11px] font-normal">Host Payout Obligations</span>
              <p className="text-base font-medium text-zinc-900 mt-1">
                {fmtSAR(data.financialSummary.hostPayoutObligationsCents)}
              </p>
              <span className="text-[10px] text-zinc-400 font-normal">Net payable to hosts</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-500 text-[11px] font-normal">Total Refunded Volume</span>
              <p className="text-base font-medium text-rose-700 mt-1">
                {fmtSAR(data.financialSummary.refundVolumeCents)}
              </p>
              <span className="text-[10px] text-zinc-400 font-normal">Guest refunds issued</span>
            </div>
          </div>
        </div>

        {/* Recent Audit Events Feed (~50% width) */}
        <div className="lg:col-span-6 flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-medium text-zinc-900 tracking-tight">
                Recent Audit Events
              </h2>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Administrative actions, role updates, and mutations logged in real time.
              </p>
            </div>
            <Link
              href="/admin/activity-logs"
              className="text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors"
            >
              All logs →
            </Link>
          </div>

          <div className="divide-y divide-zinc-100 text-xs">
            {data.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-zinc-400 font-normal">
                No recent activity recorded.
              </p>
            ) : (
              data.recentActivity.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                        log.status === "FAILURE"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-normal text-zinc-700 truncate max-w-[220px]">
                      {log.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 shrink-0 font-normal">
                    <span>{log.actorEmail}</span>
                    <span suppressHydrationWarning>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

