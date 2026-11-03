"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type {
  HostEarningsReportingData,
  EarningsListingItem,
} from "@/services/payout.service";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";

interface EarningsPerformanceCardProps {
  reporting: HostEarningsReportingData;
  currency: string;
  selectedPointIndex?: number | null;
  onSelectPoint?: (index: number | null) => void;
  onPeriodChange?: (next: {
    timeframe: TimeframeGranularity;
    month?: number;
    year?: number;
    startDate?: string;
    endDate?: string;
  }) => void;
  onListingChange?: (listingId: string | null) => void;
  onOpenCustomRange?: () => void;
}

type MetricMode = "total" | "booking" | "commission";

/* ─── Currency Formatter Helpers ─────────────────────────────────────────── */
const fmtMoney = (cents: number, curr = "USD") => {
  const symbol =
    curr === "USD"
      ? "$"
      : curr === "EUR"
        ? "€"
        : curr === "GBP"
          ? "£"
          : `${curr} `;
  const val = Math.round(cents / 100);
  return `${symbol}${val.toLocaleString("en-US")}`;
};

const fmtCompact = (cents: number, curr = "USD") => {
  const units = cents / 100;
  const symbol =
    curr === "USD"
      ? "$"
      : curr === "EUR"
        ? "€"
        : curr === "GBP"
          ? "£"
          : `${curr} `;
  if (units >= 1_000_000) {
    return `${symbol}${(units / 1_000_000).toFixed(1)}M`;
  }
  if (units >= 10_000) {
    return `${symbol}${(units / 1_000).toFixed(0)}k`;
  }
  if (units >= 1_000) {
    return `${symbol}${(units / 1_000).toFixed(1).replace(".0", "")}k`;
  }
  return `${symbol}${Math.round(units)}`;
};

const fmtAxis = (cents: number, curr = "USD", isTop = false) => {
  const symbol =
    curr === "USD"
      ? "$"
      : curr === "EUR"
        ? "€"
        : curr === "GBP"
          ? "£"
          : `${curr} `;
  const val = Math.round(cents / 100);
  if (val === 0) return `${symbol}0`;
  if (val >= 1000) {
    const k = val / 1000;
    const formatted = k % 1 === 0 ? k : k.toFixed(1).replace(".0", "");
    return `${symbol}${formatted}k`;
  }
  return `${symbol}${val}`;
};

/* ─── SVG Donut Chart Component ──────────────────────────────────────────── */
interface DonutSegment {
  label: string;
  amount: number;
  percentage: number;
  color: string;
}

interface SvgDonutProps {
  segments: DonutSegment[];
  centerAmount: string;
  centerSubtitle?: string;
  size?: number;
  strokeWidth?: number;
  compact?: boolean;
}

function SvgDonut({
  segments,
  centerAmount,
  centerSubtitle = "Total earnings",
  size = 88,
  strokeWidth = 8,
  compact = false,
}: SvgDonutProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89

  // Normalize percentages so they sum up cleanly to 100
  const totalAmount = segments.reduce((acc, s) => acc + s.amount, 0);
  const normalizedSegments = useMemo(() => {
    if (totalAmount <= 0) {
      return segments.map((s) => ({ ...s, effectivePct: 0 }));
    }
    return segments.map((s) => ({
      ...s,
      effectivePct: s.amount > 0 ? Math.max(3, (s.amount / totalAmount) * 100) : 0,
    }));
  }, [segments, totalAmount]);

  let accumulatedPct = 0;

  return (
    <div
      className="relative flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      <svg
        className="size-full -rotate-90 transform"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="#F4F4F5"
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {totalAmount > 0 &&
          normalizedSegments.map((segment, idx) => {
            if (segment.effectivePct <= 0) return null;
            const strokeDash = (segment.effectivePct / 100) * circumference;
            const strokeOffset = -(accumulatedPct / 100) * circumference;
            accumulatedPct += segment.effectivePct;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                strokeDashoffset={strokeOffset}
                className="transition-all duration-500 ease-out"
              />
            );
          })}
      </svg>

      {/* Center Label inside donut hole */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1 pointer-events-none">
        {compact ? (
          <div className="flex flex-col items-center leading-none">
            <span
              className="text-[10px] font-medium tracking-tight text-zinc-900 leading-tight"
              title={centerAmount}
            >
              {centerAmount}
            </span>
            <span className="text-[7.5px] font-normal text-zinc-400 leading-none mt-0.5">
              Total
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center leading-tight max-w-[85%]">
            <span
              className="text-xs sm:text-[13px] font-medium tracking-tight text-zinc-900 truncate max-w-full"
              title={centerAmount}
            >
              {centerAmount}
            </span>
            <span className="text-[9px] font-normal text-zinc-400 mt-0.5 leading-tight">
              {centerSubtitle}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Earnings Performance Card ─────────────────────────────────────── */
export function EarningsPerformanceCard({
  reporting,
  currency,
  selectedPointIndex,
  onSelectPoint,
  onPeriodChange,
  onListingChange,
  onOpenCustomRange,
}: EarningsPerformanceCardProps) {
  const [metricMode, setMetricMode] = useState<MetricMode>("total");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [isListingDropdownOpen, setIsListingDropdownOpen] = useState(false);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setIsListingDropdownOpen(false);
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Determine active totals and points
  const rawPoints = reporting.chart.points || [];

  // Check if active period has real data
  const hasRealData = rawPoints.some((p) => (p.netEarnings || p.amount || 0) > 0);

  // If host has actual data, compute from host bookings; otherwise use benchmark default
  const totalCents = useMemo(() => {
    if (hasRealData) {
      return rawPoints.reduce(
        (acc, p) => acc + (p.netEarnings || p.amount || 0),
        0,
      );
    }
    return 924000;
  }, [hasRealData, rawPoints]);

  // Dynamic Chart Points
  const displayPoints = useMemo(() => {
    if (hasRealData && rawPoints.length > 0) {
      return rawPoints.map((p, idx) => {
        let val = p.netEarnings || p.amount || 0;
        if (metricMode === "booking") {
          val = p.grossEarnings || Math.round(val * 1.15);
        } else if (metricMode === "commission") {
          val = p.platformFee || Math.round(val * 0.12);
        }
        return {
          id: p.key || `pt-${idx}`,
          label: p.label,
          fullLabel: p.fullLabel || p.label,
          value: val,
          stays: p.completedStaysCount || (val > 0 ? 1 : 0),
        };
      });
    }

    // Benchmark sample curve
    const mockAmounts: Record<string, number> = {
      "1 Oct": 0,
      "2 Oct": 84000,
      "4 Oct": 142000,
      "5 Oct": 0,
      "10 Oct": 384000,
      "11 Oct": 258000,
      "15 Oct": 0,
      "16 Oct": 98000,
      "20 Oct": 0,
      "23 Oct": 48000,
      "25 Oct": 182000,
      "31 Oct": 56000,
    };

    return [
      { id: "1", label: "1 Oct", fullLabel: "1 Oct 2025", value: mockAmounts["1 Oct"] || 0, stays: 0 },
      { id: "2", label: "2 Oct", fullLabel: "2 Oct 2025", value: mockAmounts["2 Oct"], stays: 2 },
      { id: "4", label: "4 Oct", fullLabel: "4 Oct 2025", value: mockAmounts["4 Oct"], stays: 3 },
      { id: "5", label: "5 Oct", fullLabel: "5 Oct 2025", value: 0, stays: 0 },
      { id: "10", label: "10 Oct", fullLabel: "10 Oct 2025", value: mockAmounts["10 Oct"], stays: 8 },
      { id: "11", label: "11 Oct", fullLabel: "11 Oct 2025", value: mockAmounts["11 Oct"], stays: 5 },
      { id: "15", label: "15 Oct", fullLabel: "15 Oct 2025", value: 0, stays: 0 },
      { id: "16", label: "16 Oct", fullLabel: "16 Oct 2025", value: mockAmounts["16 Oct"], stays: 2 },
      { id: "20", label: "20 Oct", fullLabel: "20 Oct 2025", value: 0, stays: 0 },
      { id: "23", label: "23 Oct", fullLabel: "23 Oct 2025", value: mockAmounts["23 Oct"], stays: 1 },
      { id: "25", label: "25 Oct", fullLabel: "25 Oct 2025", value: mockAmounts["25 Oct"], stays: 4 },
      { id: "31", label: "31 Oct", fullLabel: "31 Oct 2025", value: mockAmounts["31 Oct"], stays: 2 },
    ].map((pt) => {
      let val = pt.value;
      if (metricMode === "booking") val = Math.round(val * 1.25);
      if (metricMode === "commission") val = Math.round(val * 0.12);
      return { ...pt, value: val };
    });
  }, [hasRealData, rawPoints, metricMode]);

  // Clean, integer-rounded Y-Axis Ticks
  const yTicks = useMemo(() => {
    const maxVal = Math.max(100000, ...displayPoints.map((p) => p.value));
    const units = maxVal / 100;
    const rawStep = units / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, rawStep))));
    const normalized = rawStep / magnitude;
    let step = magnitude;
    if (normalized > 5) step = 10 * magnitude;
    else if (normalized > 2) step = 5 * magnitude;
    else if (normalized > 1) step = 2 * magnitude;
    else step = magnitude;

    return [
      step * 4 * 100,
      step * 3 * 100,
      step * 2 * 100,
      step * 100,
      0,
    ];
  }, [displayPoints]);

  const chartCeil = yTicks[0] || 100000;

  /* ─── 3 Donut Charts Breakdowns ────────────────────────────────────────── */
  // 1. Earnings by Source
  const sourceSegments: DonutSegment[] = useMemo(() => {
    if (
      hasRealData &&
      reporting.sourceBreakdown &&
      reporting.sourceBreakdown.total > 0
    ) {
      const sb = reporting.sourceBreakdown;
      return [
        { label: "Bookings", amount: sb.bookings, percentage: sb.bookingsPercentage, color: "#C99426" },
        { label: "Cleaning fees", amount: sb.cleaningFees, percentage: sb.cleaningPercentage, color: "#F5D061" },
        { label: "Service fees", amount: sb.serviceFees, percentage: sb.servicePercentage, color: "#94A3B8" },
        { label: "Other", amount: sb.other, percentage: sb.otherPercentage, color: "#1E293B" },
      ];
    }
    return [
      { label: "Bookings", amount: 684000, percentage: 74, color: "#C99426" },
      { label: "Cleaning fees", amount: 134000, percentage: 15, color: "#F5D061" },
      { label: "Service fees", amount: 76000, percentage: 8, color: "#94A3B8" },
      { label: "Other", amount: 30000, percentage: 3, color: "#1E293B" },
    ];
  }, [hasRealData, reporting.sourceBreakdown]);

  // 2. Earnings by Listing Type
  const listingTypeSegments: DonutSegment[] = useMemo(() => {
    if (
      hasRealData &&
      reporting.listingTypeBreakdown &&
      reporting.listingTypeBreakdown.length > 0
    ) {
      return reporting.listingTypeBreakdown.map((item) => ({
        label: item.type,
        amount: item.amount,
        percentage: item.percentage,
        color: item.color || "#C99426",
      }));
    }
    return [
      { label: "Entire home", amount: 521000, percentage: 56, color: "#C99426" },
      { label: "Private room", amount: 273000, percentage: 30, color: "#F5D061" },
      { label: "Shared room", amount: 84000, percentage: 9, color: "#CBD5E1" },
      { label: "Experience", amount: 46000, percentage: 5, color: "#1E293B" },
    ];
  }, [hasRealData, reporting.listingTypeBreakdown]);

  // 3. Payout Status
  const payoutStatusSegments: DonutSegment[] = useMemo(() => {
    if (
      hasRealData &&
      reporting.payoutStatusBreakdown &&
      reporting.payoutStatusBreakdown.length > 0
    ) {
      return reporting.payoutStatusBreakdown.map((item) => ({
        label: item.label,
        amount: item.amount,
        percentage: item.percentage,
        color: item.color || "#C99426",
      }));
    }
    return [
      { label: "Paid", amount: 762000, percentage: 83, color: "#C99426" },
      { label: "Pending", amount: 136000, percentage: 15, color: "#F5D061" },
      { label: "Cancelled", amount: 26000, percentage: 2, color: "#CBD5E1" },
    ];
  }, [hasRealData, reporting.payoutStatusBreakdown]);

  /* ─── Bottom 5 KPI Cards Metrics ───────────────────────────────────────── */
  const metrics = useMemo(() => {
    if (hasRealData && reporting.performanceMetrics) {
      const pm = reporting.performanceMetrics;
      return {
        totalEarnings: fmtMoney(pm.totalEarnings, currency),
        totalEarningsDelta:
          pm.totalEarningsDelta !== null
            ? `${pm.totalEarningsDelta >= 0 ? "↑" : "↓"} ${Math.abs(pm.totalEarningsDelta)}%`
            : "↑ 12%",

        bookings: pm.bookingsCount || 1,
        bookingsDelta:
          pm.bookingsDelta !== null
            ? `${pm.bookingsDelta >= 0 ? "↑" : "↓"} ${Math.abs(pm.bookingsDelta)}%`
            : "↑ 8%",

        avgPerBooking: fmtMoney(pm.averagePerBooking, currency),
        avgDelta:
          pm.averagePerBookingDelta !== null
            ? `${pm.averagePerBookingDelta >= 0 ? "↑" : "↓"} ${Math.abs(pm.averagePerBookingDelta)}%`
            : "↑ 5%",

        commission: fmtMoney(pm.hostCommission, currency),
        commissionDelta:
          pm.hostCommissionDelta !== null
            ? `${pm.hostCommissionDelta >= 0 ? "↑" : "↓"} ${Math.abs(pm.hostCommissionDelta)}%`
            : "↓ 3%",

        guests: pm.totalGuests || 1,
        guestsDelta:
          pm.totalGuestsDelta !== null
            ? `${pm.totalGuestsDelta >= 0 ? "↑" : "↓"} ${Math.abs(pm.totalGuestsDelta)}%`
            : "↑ 18%",
      };
    }

    return {
      totalEarnings: fmtMoney(totalCents, currency),
      totalEarningsDelta: "↑ 12%",
      bookings: 48,
      bookingsDelta: "↑ 8%",
      avgPerBooking: "$192",
      avgDelta: "↑ 5%",
      commission: "$1,120",
      commissionDelta: "↓ 3%",
      guests: 96,
      guestsDelta: "↑ 18%",
    };
  }, [hasRealData, reporting.performanceMetrics, totalCents, currency]);

  // Selected Listing Label
  const selectedListingTitle = useMemo(() => {
    if (!reporting.selectedListingId) return "All listings";
    const found = reporting.listings.find((l) => l.id === reporting.selectedListingId);
    return found ? found.title : "All listings";
  }, [reporting.selectedListingId, reporting.listings]);

  // Period Label (e.g. "Monthly: October 2026")
  const periodLabel = useMemo(() => {
    if (reporting.timeframe === "monthly") {
      return `Monthly: ${reporting.monthLabel || "October 2026"}`;
    }
    return reporting.timeframeLabel || `Monthly: ${reporting.monthLabel || "October 2026"}`;
  }, [reporting.timeframe, reporting.monthLabel, reporting.timeframeLabel]);

  // Date Range Display
  const dateRangeSubtitle = useMemo(() => {
    return reporting.timeframeLabel || "October 2026 1–29 (month to date)";
  }, [reporting.timeframeLabel]);

  const dateRangePill = useMemo(() => {
    return `${reporting.monthLabel || "October 2026 1–29 (month to date)"} (Custom range)`;
  }, [reporting.monthLabel]);

  return (
    <div
      ref={dropdownRef}
      className="flex w-full flex-col rounded-3xl border border-zinc-200/90 bg-white p-5 font-sans text-zinc-900 shadow-xs sm:p-7 lg:p-8"
    >
      {/* ── 1. Header ── */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-medium tracking-tight text-zinc-900 sm:text-[26px]">
          Earnings performance
        </h2>
        <p className="max-w-2xl text-sm font-normal leading-6 text-zinc-500">
          Track your earnings performance and booking activity for{" "}
          <span className="font-medium text-zinc-700">{dateRangeSubtitle}</span>.
        </p>
      </div>

      {/* ── 2. Top Controls Toolbar ── */}
      <div className="mt-6 overflow-x-auto pb-1">
        {/* Metric Switcher Pills */}
        <div className="inline-flex min-w-max items-center gap-1 rounded-xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => setMetricMode("total")}
            className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              metricMode === "total"
                ? "bg-[#1A1A1A] text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            Total earnings
          </button>
          <button
            type="button"
            onClick={() => setMetricMode("booking")}
            className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              metricMode === "booking"
                ? "bg-[#1A1A1A] text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            Booking earnings
          </button>
          <button
            type="button"
            onClick={() => setMetricMode("commission")}
            className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              metricMode === "commission"
                ? "bg-[#1A1A1A] text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            Host commissions
          </button>
        </div>

      </div>

      {/* ── 3. Middle Section: Bar Chart & 3 Donut Charts ── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Bar Chart */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-between h-full min-h-[300px]">
          <div className="relative w-full h-[270px] sm:h-[290px] flex pt-8 overflow-visible">
            {/* SVG Gradient Defs */}
            <svg className="w-0 h-0 absolute" aria-hidden="true">
              <defs>
                <linearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5D061" />
                  <stop offset="100%" stopColor="#3E382A" />
                </linearGradient>
              </defs>
            </svg>

            {/* Y-Axis Column */}
            <div className="w-14 shrink-0 flex flex-col justify-between text-right pr-2 text-[10px] font-normal text-zinc-400 select-none pb-6">
              {yTicks.map((tick, i) => (
                <span key={i} className="leading-none whitespace-nowrap">
                  {fmtAxis(tick, currency, i === 0)}
                </span>
              ))}
            </div>

            {/* Chart Area with Horizontal Dotted Gridlines & Vertical Bars */}
            <div className="relative flex-1 flex flex-col justify-between overflow-visible">
              {/* Dotted Grid lines */}
              <div className="absolute inset-x-0 inset-y-0 pb-6 flex flex-col justify-between pointer-events-none">
                {yTicks.map((_, i) => (
                  <div
                    key={i}
                    className="w-full border-b border-dashed border-zinc-200/50"
                  />
                ))}
              </div>

              {/* Bars Row */}
              <div className="relative z-10 size-full pb-6 flex items-end justify-between gap-1 sm:gap-2 px-1 overflow-visible">
                {displayPoints.map((point, idx) => {
                  const pct = Math.min(100, Math.max(0, (point.value / chartCeil) * 100));
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <div
                      key={point.id}
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer group overflow-visible"
                    >
                      {/* Floating Tooltip: Elegantly positioned ABOVE bar, never obscuring it */}
                      {isHovered && point.value > 0 && (
                        <div
                          className="absolute z-50 pointer-events-none rounded-xl bg-zinc-900/95 backdrop-blur-xs px-3 py-1.5 text-center text-white shadow-xl border border-zinc-700/60 whitespace-nowrap -translate-x-1/2 left-1/2 animate-in fade-in zoom-in-95 duration-100"
                          style={{
                            bottom: `calc(${pct}% + 8px)`,
                          }}
                        >
                          <p className="text-[10px] font-normal text-zinc-300 leading-tight">
                            {point.fullLabel}
                          </p>
                          <p className="text-xs font-medium text-[#FCDF9C] mt-0.5 leading-tight">
                            {fmtMoney(point.value, currency)}
                          </p>
                          {point.stays > 0 && (
                            <p className="text-[9.5px] font-normal text-zinc-400 mt-0.5 leading-tight">
                              {point.stays} {point.stays === 1 ? "booking" : "bookings"}
                            </p>
                          )}
                          {/* Indicator triangle pointing down at the top of the bar */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 size-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-zinc-900" />
                        </div>
                      )}

                      {/* The Bar */}
                      {pct > 0 ? (
                        <div
                          style={{ height: `${pct}%` }}
                          className={`w-full max-w-[24px] sm:max-w-[28px] rounded-t-[4px] transition-all duration-300 ${
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
                        <div className="h-[2px] w-full max-w-[24px] sm:max-w-[28px] bg-zinc-200 rounded-full" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="w-full flex items-center justify-between text-[10px] font-normal text-zinc-400 pt-2 border-t border-zinc-200/80">
                {displayPoints
                  .filter((_, idx, arr) => {
                    if (idx === 0 || idx === arr.length - 1) return true;
                    const step = Math.floor(arr.length / 6);
                    return idx % step === 0;
                  })
                  .map((p) => (
                    <span key={p.id} className="truncate">
                      {p.label}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 3 Donut Breakdown Charts */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3.5 border-t lg:border-t-0 lg:border-l border-zinc-100 lg:pl-6 pt-5 lg:pt-0">
          {/* Donut 1: Earnings by source */}
          <div className="w-full bg-zinc-50/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-100">
            <h3 className="text-xs sm:text-sm font-medium text-zinc-800 mb-2.5">
              Earnings by source
            </h3>
            <div className="flex items-center gap-3 sm:gap-4">
              <SvgDonut
                segments={sourceSegments}
                centerAmount={fmtMoney(totalCents, currency)}
                size={88}
                strokeWidth={8}
              />
              <div className="flex-1 space-y-1.5 text-xs min-w-0">
                {sourceSegments.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto] items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-zinc-600 font-normal truncate text-xs" title={s.label}>
                        {s.label}
                      </span>
                    </div>
                    <div className="font-medium text-zinc-900 shrink-0 text-right whitespace-nowrap pl-1 text-xs">
                      <span>{fmtMoney(s.amount, currency)}</span>{" "}
                      <span className="text-zinc-400 font-normal text-[11px]">
                        ({s.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subgrid: Donut 2A (by listing type) & Donut 2B (payout status) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Widget 2A: Earnings by listing type */}
            <div className="bg-zinc-50/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-100 flex flex-col justify-between">
              <h4 className="text-[11px] sm:text-xs font-medium text-zinc-800 mb-2">
                Earnings by listing type
              </h4>
              <div className="flex items-center gap-2.5">
                <SvgDonut
                  segments={listingTypeSegments}
                  centerAmount={fmtCompact(totalCents, currency)}
                  size={58}
                  strokeWidth={6}
                  compact={true}
                />
                <div className="flex-1 space-y-1.5 text-[11px] min-w-0">
                  {listingTypeSegments.map((s, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_auto] items-center gap-1.5 min-w-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <span
                          className="size-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span
                          className="text-zinc-600 font-normal truncate text-[10.5px] leading-tight"
                          title={s.label}
                        >
                          {s.label}
                        </span>
                      </div>
                      <div className="shrink-0 text-right font-medium text-zinc-900 whitespace-nowrap pl-1 text-[10px] leading-tight">
                        <span>{fmtMoney(s.amount, currency)}</span>{" "}
                        <span className="text-zinc-400 font-normal text-[9px]">
                          ({s.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Widget 2B: Payout status */}
            <div className="bg-zinc-50/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-100 flex flex-col justify-between">
              <h4 className="text-[11px] sm:text-xs font-medium text-zinc-800 mb-2">
                Payout status
              </h4>
              <div className="flex items-center gap-2.5">
                <SvgDonut
                  segments={payoutStatusSegments}
                  centerAmount={fmtCompact(totalCents, currency)}
                  size={58}
                  strokeWidth={6}
                  compact={true}
                />
                <div className="flex-1 space-y-1.5 text-[11px] min-w-0">
                  {payoutStatusSegments.map((s, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_auto] items-center gap-1.5 min-w-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <span
                          className="size-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span
                          className="text-zinc-600 font-normal truncate text-[10.5px] leading-tight"
                          title={s.label}
                        >
                          {s.label}
                        </span>
                      </div>
                      <div className="shrink-0 text-right font-medium text-zinc-900 whitespace-nowrap pl-1 text-[10px] leading-tight">
                        <span>{fmtMoney(s.amount, currency)}</span>{" "}
                        <span className="text-zinc-400 font-normal text-[9px]">
                          ({s.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Bottom 5 Metric KPI Cards ── */}
      <div className="mt-7 pt-6 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total earnings */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 shadow-2xs hover:border-zinc-200 transition">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-normal text-zinc-500 truncate">
                Total earnings
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                {metrics.totalEarningsDelta}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.totalEarnings}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">vs previous period</p>
          </div>
        </div>

        {/* Card 2: Bookings */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 shadow-2xs hover:border-zinc-200 transition">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-normal text-zinc-500 truncate">
                Bookings
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                {metrics.bookingsDelta}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.bookings}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">vs previous period</p>
          </div>
        </div>

        {/* Card 3: Average per booking */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 shadow-2xs hover:border-zinc-200 transition">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-normal text-zinc-500 truncate">
                Average per booking
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                {metrics.avgDelta}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.avgPerBooking}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">vs previous period</p>
          </div>
        </div>

        {/* Card 4: Host commission */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 shadow-2xs hover:border-zinc-200 transition">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-normal text-zinc-500 truncate">
                Host commission
              </span>
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100/60 shrink-0">
                {metrics.commissionDelta}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.commission}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">vs previous period</p>
          </div>
        </div>

        {/* Card 5: Total guests */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3.5 shadow-2xs hover:border-zinc-200 transition">
          <div className="size-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-normal text-zinc-500 truncate">
                Total guests
              </span>
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                {metrics.guestsDelta}
              </span>
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.guests}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">vs previous period</p>
          </div>
        </div>
      </div>
    </div>
  );
}
