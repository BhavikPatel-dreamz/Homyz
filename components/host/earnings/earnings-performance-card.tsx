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
type ChartType = "bar" | "line";

/* ─── Currency Formatter Helpers ─────────────────────────────────────────── */
const fmtMoney = (cents: number, curr = "SAR") => {
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

const fmtCompact = (cents: number, curr = "SAR") => {
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

const fmtAxis = (cents: number, curr = "SAR") => {
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

/* ─── Architectural Villa & Palm Header Illustration ─────────────────────── */
function VillaPalmBanner() {
  return (
    <div className="relative shrink-0 hidden md:block w-48 sm:w-56 h-16 sm:h-20 overflow-hidden rounded-2xl select-none pointer-events-none">
      <svg
        viewBox="0 0 240 80"
        className="size-full object-cover"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="warmSky" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF7" stopOpacity="0" />
            <stop offset="35%" stopColor="#FEF3C7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="duneFront" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#FCD34D" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="villaWall" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F3F4F6" />
          </linearGradient>
          <linearGradient id="villaRoof" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="warmWindow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Sky glow */}
        <rect width="240" height="80" fill="url(#warmSky)" />

        {/* Soft background desert dune */}
        <path
          d="M0 65 Q 60 48, 120 58 T 240 50 L 240 80 L 0 80 Z"
          fill="#FEF3C7"
          opacity="0.6"
        />

        {/* Foreground rolling dune */}
        <path
          d="M0 72 Q 80 56, 160 66 T 240 60 L 240 80 L 0 80 Z"
          fill="url(#duneFront)"
        />

        {/* Palm Tree 1 (Left) */}
        <g transform="translate(142, 34) scale(0.65)">
          {/* Trunk */}
          <path
            d="M10 40 Q 14 20 8 0"
            stroke="#78350F"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Fronds */}
          <path d="M8 0 Q -6 -6 -12 2" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 0 Q -2 -14 -4 -18" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 0 Q 8 -16 12 -18" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 0 Q 20 -8 24 2" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 0 Q 18 10 22 14" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* Palm Tree 2 (Taller, Center-Left) */}
        <g transform="translate(158, 28) scale(0.75)">
          {/* Trunk */}
          <path
            d="M10 44 Q 6 22 12 0"
            stroke="#78350F"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Fronds */}
          <path d="M12 0 Q -4 -8 -10 0" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 0 Q 2 -16 0 -22" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 0 Q 14 -18 18 -22" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 0 Q 26 -10 30 0" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 0 Q 24 8 26 14" stroke="#15803D" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Modern A-Frame Villa Architecture */}
        <g transform="translate(178, 30)">
          {/* Main structure shadow */}
          <polygon points="20,40 54,40 46,14 20,40" fill="#000000" opacity="0.08" />

          {/* Main A-frame roof */}
          <polygon points="25,4 48,38 2,38" fill="url(#villaRoof)" />
          {/* Villa facade / glass wall */}
          <polygon points="25,9 43,37 7,37" fill="url(#villaWall)" />

          {/* Large glowing A-frame window */}
          <polygon points="25,12 39,34 11,34" fill="url(#warmWindow)" opacity="0.95" />
          {/* Window mullions */}
          <line x1="25" y1="12" x2="25" y2="34" stroke="#1E293B" strokeWidth="1" />
          <line x1="16" y1="26" x2="34" y2="26" stroke="#1E293B" strokeWidth="0.8" />

          {/* Side wing structure */}
          <rect x="42" y="20" width="16" height="18" rx="1" fill="#FFFFFF" />
          <polygon points="41,20 59,20 56,16 41,16" fill="url(#villaRoof)" />
          <rect x="46" y="24" width="8" height="10" rx="0.5" fill="url(#warmWindow)" />
        </g>
      </svg>
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
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Raw chart points from payout service
  const rawPoints = reporting.chart.points || [];

  // Metric-specific totals
  const totalNetEarnings = useMemo(() => {
    return reporting.performanceMetrics?.totalEarnings ??
      rawPoints.reduce((acc, p) => acc + (p.netEarnings || p.amount || 0), 0);
  }, [reporting.performanceMetrics, rawPoints]);

  const totalGrossEarnings = useMemo(() => {
    return rawPoints.reduce((acc, p) => acc + (p.grossEarnings || p.netEarnings || p.amount || 0), 0);
  }, [rawPoints]);

  const totalCommission = useMemo(() => {
    return reporting.performanceMetrics?.hostCommission ??
      rawPoints.reduce((acc, p) => acc + (p.platformFee || 0), 0);
  }, [reporting.performanceMetrics, rawPoints]);

  // Active headline amount based on selected tab
  const activeHeadlineCents = useMemo(() => {
    if (metricMode === "booking") return totalGrossEarnings;
    if (metricMode === "commission") return totalCommission;
    return totalNetEarnings;
  }, [metricMode, totalGrossEarnings, totalCommission, totalNetEarnings]);

  const activeHeadlineLabel = useMemo(() => {
    if (metricMode === "booking") return "Booking earnings";
    if (metricMode === "commission") return "Host commissions";
    return "Total earnings";
  }, [metricMode]);

  // Dynamic Chart Points tailored to active metric mode
  const displayPoints = useMemo(() => {
    return rawPoints.map((p, idx) => {
      let val = p.netEarnings || p.amount || 0;
      if (metricMode === "booking") {
        val = p.grossEarnings || val;
      } else if (metricMode === "commission") {
        val = p.platformFee || 0;
      }
      return {
        id: p.key || `pt-${idx}`,
        label: p.label,
        fullLabel: p.fullLabel || p.label,
        value: val,
        stays: p.completedStaysCount || (val > 0 ? 1 : 0),
      };
    });
  }, [rawPoints, metricMode]);

  // Clean, dynamic Y-Axis Ticks
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

  // Dynamic bar max width based on point count (matching old chart & revenue-trend-chart)
  const barMaxWidthClass = useMemo(() => {
    const count = displayPoints.length;
    if (count <= 14) return "max-w-[24px] sm:max-w-[28px]";
    if (count <= 21) return "max-w-[18px] sm:max-w-[22px]";
    return "max-w-[12px] sm:max-w-[16px]";
  }, [displayPoints.length]);

  /* ─── 3 Donut Charts Breakdowns (Strictly Reconciled) ───────────────────── */
  // 1. Earnings by Source (Net Host Revenue Components)
  const sourceSegments: DonutSegment[] = useMemo(() => {
    if (reporting.sourceBreakdown && reporting.sourceBreakdown.total > 0) {
      const sb = reporting.sourceBreakdown;
      const segs: DonutSegment[] = [
        { label: "Hostings", amount: sb.bookings, percentage: sb.bookingsPercentage, color: "#D97706" },
        { label: "Cleaning fees", amount: sb.cleaningFees, percentage: sb.cleaningPercentage, color: "#FCD34D" },
      ];
      if (sb.other > 0 || sb.otherPercentage > 0) {
        segs.push({ label: "Other", amount: sb.other, percentage: sb.otherPercentage, color: "#1E293B" });
      }
      return segs;
    }
    return [
      { label: "Hostings", amount: totalNetEarnings, percentage: 100, color: "#D97706" },
      { label: "Cleaning fees", amount: 0, percentage: 0, color: "#FCD34D" },
      { label: "Other", amount: 0, percentage: 0, color: "#1E293B" },
    ];
  }, [reporting.sourceBreakdown, totalNetEarnings]);

  // 2. Earnings by Listing Type
  const listingTypeSegments: DonutSegment[] = useMemo(() => {
    if (reporting.listingTypeBreakdown && reporting.listingTypeBreakdown.length > 0) {
      return reporting.listingTypeBreakdown.map((item) => ({
        label: item.type,
        amount: item.amount,
        percentage: item.percentage,
        color: item.color || "#D97706",
      }));
    }
    return [
      { label: "Entire home", amount: totalNetEarnings, percentage: 100, color: "#D97706" },
      { label: "Private room", amount: 0, percentage: 0, color: "#FCD34D" },
      { label: "Shared room", amount: 0, percentage: 0, color: "#CBD5E1" },
      { label: "Experience", amount: 0, percentage: 0, color: "#1E293B" },
    ];
  }, [reporting.listingTypeBreakdown, totalNetEarnings]);

  // 3. Payout Status
  const payoutStatusSegments: DonutSegment[] = useMemo(() => {
    if (reporting.payoutStatusBreakdown && reporting.payoutStatusBreakdown.length > 0) {
      return reporting.payoutStatusBreakdown.map((item) => ({
        label: item.label,
        amount: item.amount,
        percentage: item.percentage,
        color: item.color || "#10B981",
      }));
    }
    return [
      { label: "Paid", amount: 0, percentage: 0, color: "#10B981" },
      { label: "Pending", amount: totalNetEarnings, percentage: 100, color: "#F59E0B" },
      { label: "Cancelled", amount: 0, percentage: 0, color: "#EF4444" },
    ];
  }, [reporting.payoutStatusBreakdown, totalNetEarnings]);

  /* ─── Bottom 5 KPI Cards Metrics ───────────────────────────────────────── */
  const metrics = useMemo(() => {
    const pm = reporting.performanceMetrics;
    const isComp = Boolean(reporting.comparison?.enabled);

    return {
      totalEarnings: fmtMoney(pm?.totalEarnings ?? totalNetEarnings, currency),
      totalEarningsDelta: isComp && pm?.totalEarningsDelta !== null && pm?.totalEarningsDelta !== undefined
        ? pm.totalEarningsDelta
        : null,

      bookings: pm?.bookingsCount ?? 0,
      bookingsDelta: isComp && pm?.bookingsDelta !== null && pm?.bookingsDelta !== undefined
        ? pm.bookingsDelta
        : null,

      avgPerBooking: fmtMoney(pm?.averagePerBooking ?? 0, currency),
      avgDelta: isComp && pm?.averagePerBookingDelta !== null && pm?.averagePerBookingDelta !== undefined
        ? pm.averagePerBookingDelta
        : null,

      commission: fmtMoney(pm?.hostCommission ?? totalCommission, currency),
      commissionDelta: isComp && pm?.hostCommissionDelta !== null && pm?.hostCommissionDelta !== undefined
        ? pm.hostCommissionDelta
        : null,

      guests: pm?.totalGuests ?? 0,
      guestsDelta: isComp && pm?.totalGuestsDelta !== null && pm?.totalGuestsDelta !== undefined
        ? pm.totalGuestsDelta
        : null,
    };
  }, [reporting.performanceMetrics, reporting.comparison, totalNetEarnings, totalCommission, currency]);

  // Dynamic Date Range Subtitle
  const dateRangeSubtitle = useMemo(() => {
    return reporting.timeframeLabel || reporting.monthLabel || "November 2026 1 – 6 (month to date)";
  }, [reporting.timeframeLabel, reporting.monthLabel]);

  // Line Chart SVG Path generation (Cubic Spline with Area Fill)
  const lineChartData = useMemo(() => {
    if (chartType !== "line" || displayPoints.length === 0) return null;
    const svgW = 600;
    const svgH = 200;
    const padX = 24;
    const padY = 20;
    const usableW = svgW - padX * 2;
    const usableH = svgH - padY * 2;
    const n = displayPoints.length;

    const coords = displayPoints.map((pt, i) => {
      const x = padX + (n <= 1 ? usableW / 2 : (i / (n - 1)) * usableW);
      const ratio = Math.min(1, Math.max(0, pt.value / chartCeil));
      const y = svgH - padY - ratio * usableH;
      return { x, y, ...pt };
    });

    if (coords.length === 1) {
      const c = coords[0];
      return {
        svgW,
        svgH,
        coords,
        linePath: `M ${c.x - 20} ${c.y} L ${c.x + 20} ${c.y}`,
        areaPath: `M ${c.x - 20} ${svgH - padY} L ${c.x - 20} ${c.y} L ${c.x + 20} ${c.y} L ${c.x + 20} ${svgH - padY} Z`,
      };
    }

    // Cubic spline path
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
  }, [chartType, displayPoints, chartCeil]);

  return (
    <div className="flex w-full flex-col rounded-3xl border border-zinc-200/80 bg-white p-5 font-sans text-zinc-900 shadow-xs sm:p-7 lg:p-8">
      {/* ── 1. Header with Title, Date Range Subtitle & Warm Villa Banner ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-3.5">
          <div className="size-10 sm:size-11 rounded-2xl bg-amber-100/60 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/50">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="6" width="4" height="15" rx="1" />
              <rect x="18" y="2" width="4" height="19" rx="1" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-900">
              Earnings performance
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-normal text-zinc-500 leading-relaxed">
              Track your earnings, performance and booking activity for{" "}
              <span className="font-medium text-zinc-700">{dateRangeSubtitle}</span>.
            </p>
          </div>
        </div>

        {/* Villa Palm Illustration */}
        <VillaPalmBanner />
      </div>

      {/* ── 2. Metric Switcher Tabs ── */}
      <div className="mt-5 sm:mt-6 overflow-x-auto pb-1">
        <div className="inline-flex min-w-max items-center gap-1 rounded-full bg-zinc-100/80 p-1 border border-zinc-200/50">
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

      {/* ── 3. Middle Section: Primary Chart (Left) & 3 Donut Cards (Right) ── */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Primary Chart Card */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-between rounded-2xl border border-zinc-100/90 bg-white p-4 sm:p-5 shadow-2xs">
          {/* Top Row: Metric Headline & Chart Switcher */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-xs font-normal text-zinc-500">
                {activeHeadlineLabel}
              </span>
              <div className="flex items-center gap-2.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900">
                  {fmtMoney(activeHeadlineCents, currency)}
                </span>
                {reporting.comparison?.enabled && metrics.totalEarningsDelta !== null && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 shrink-0">
                    {metrics.totalEarningsDelta >= 0 ? "↑" : "↓"} {Math.abs(metrics.totalEarningsDelta)}% vs previous period
                  </span>
                )}
              </div>
            </div>

            {/* Chart Type Toggle (Bar / Line) */}
            <div className="inline-flex items-center rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setChartType("bar")}
                title="Bar chart view"
                className={`flex size-8 items-center justify-center rounded-lg transition-all cursor-pointer ${
                  chartType === "bar"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setChartType("line")}
                title="Line chart view"
                className={`flex size-8 items-center justify-center rounded-lg transition-all cursor-pointer ${
                  chartType === "line"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chart Display Area */}
          <div className="relative w-full h-[230px] sm:h-[250px] flex pt-4 overflow-visible">
            {/* SVG Defs */}
            <svg className="w-0 h-0 absolute" aria-hidden="true">
              <defs>
                <linearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5D061" />
                  <stop offset="100%" stopColor="#3E382A" />
                </linearGradient>
                <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F5D061" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#F5D061" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Y-Axis Column */}
            <div className="w-14 shrink-0 flex flex-col justify-between text-right pr-2 text-[10px] font-normal text-zinc-400 select-none pb-6">
              {yTicks.map((tick, i) => (
                <span key={i} className="leading-none whitespace-nowrap">
                  {fmtAxis(tick, currency)}
                </span>
              ))}
            </div>

            {/* Grid & Visual Elements */}
            <div className="relative flex-1 flex flex-col justify-between overflow-visible">
              {/* Dotted Grid lines */}
              <div className="absolute inset-x-0 inset-y-0 pb-6 flex flex-col justify-between pointer-events-none">
                {yTicks.map((_, i) => (
                  <div
                    key={i}
                    className="w-full border-b border-dashed border-zinc-200/60"
                  />
                ))}
              </div>

              {/* Chart Mode: Bar View */}
              {chartType === "bar" && (
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
                        {/* Floating Tooltip */}
                        {isHovered && (
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
                            <div className="absolute top-full left-1/2 -translate-x-1/2 size-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-zinc-900" />
                          </div>
                        )}

                        {/* The Bar */}
                        {pct > 0 ? (
                          <div
                            style={{ height: `${pct}%` }}
                            className={`w-full ${barMaxWidthClass} rounded-t-[4px] transition-all duration-300 ${
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
                          <div className={`h-[2px] w-full ${barMaxWidthClass} bg-zinc-200 rounded-full`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Chart Mode: Line Spline View */}
              {chartType === "line" && lineChartData && (
                <div className="relative z-10 size-full pb-6 overflow-visible">
                  <svg
                    viewBox={`0 0 ${lineChartData.svgW} ${lineChartData.svgH}`}
                    className="size-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    {/* Area fill */}
                    <path
                      d={lineChartData.areaPath}
                      fill="url(#lineAreaGradient)"
                    />
                    {/* Spline curve stroke */}
                    <path
                      d={lineChartData.linePath}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Points */}
                    {lineChartData.coords.map((c, idx) => {
                      const isHovered = hoveredPointIndex === idx;
                      return (
                        <g key={c.id}>
                          <circle
                            cx={c.x}
                            cy={c.y}
                            r={isHovered ? 6 : 3.5}
                            fill="#FFFFFF"
                            stroke="#D97706"
                            strokeWidth={isHovered ? 2.5 : 2}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredPointIndex(idx)}
                            onMouseLeave={() => setHoveredPointIndex(null)}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Tooltip for Line View */}
                  {hoveredPointIndex !== null && lineChartData.coords[hoveredPointIndex] && (
                    <div
                      className="absolute z-50 pointer-events-none rounded-xl bg-zinc-900/95 backdrop-blur-xs px-3 py-1.5 text-center text-white shadow-xl border border-zinc-700/60 whitespace-nowrap -translate-x-1/2 animate-in fade-in zoom-in-95 duration-100"
                      style={{
                        left: `${(lineChartData.coords[hoveredPointIndex].x / lineChartData.svgW) * 100}%`,
                        top: `calc(${(lineChartData.coords[hoveredPointIndex].y / lineChartData.svgH) * 100}% - 52px)`,
                      }}
                    >
                      <p className="text-[10px] font-normal text-zinc-300 leading-tight">
                        {lineChartData.coords[hoveredPointIndex].fullLabel}
                      </p>
                      <p className="text-xs font-medium text-[#FCDF9C] mt-0.5 leading-tight">
                        {fmtMoney(lineChartData.coords[hoveredPointIndex].value, currency)}
                      </p>
                      {lineChartData.coords[hoveredPointIndex].stays > 0 && (
                        <p className="text-[9.5px] font-normal text-zinc-400 mt-0.5 leading-tight">
                          {lineChartData.coords[hoveredPointIndex].stays}{" "}
                          {lineChartData.coords[hoveredPointIndex].stays === 1 ? "booking" : "bookings"}
                        </p>
                      )}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 size-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-zinc-900" />
                    </div>
                  )}
                </div>
              )}

              {/* X-Axis Labels */}
              <div className="w-full flex items-center justify-between text-[10px] font-normal text-zinc-400 pt-2 border-t border-zinc-200/80">
                {displayPoints
                  .filter((_, idx, arr) => {
                    if (arr.length <= 7) return true;
                    if (idx === 0 || idx === arr.length - 1) return true;
                    const step = Math.max(1, Math.floor(arr.length / 5));
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

        {/* Right Column: 3 Donut Breakdown Cards */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3.5">
          {/* Donut 1: Earnings by source */}
          <div className="w-full bg-zinc-50/60 p-3.5 sm:p-4 rounded-2xl border border-zinc-100">
            <div className="flex items-center gap-2 mb-2.5">
              <svg className="size-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <h3 className="text-xs sm:text-sm font-medium text-zinc-800">
                Earnings by source
              </h3>
            </div>
            <div className="flex items-center gap-3.5 sm:gap-4">
              <SvgDonut
                segments={sourceSegments}
                centerAmount={fmtMoney(totalNetEarnings, currency)}
                size={92}
                strokeWidth={9}
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

          {/* Subgrid: Donut 2 & Donut 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
            {/* Widget 2: Earnings by listing type */}
            <div className="bg-zinc-50/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-100 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="size-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <h4 className="text-[11px] sm:text-xs font-medium text-zinc-800">
                  Earnings by listing type
                </h4>
              </div>
              <div className="flex items-center gap-2.5">
                <SvgDonut
                  segments={listingTypeSegments}
                  centerAmount={fmtCompact(totalNetEarnings, currency)}
                  size={76}
                  strokeWidth={7.5}
                  compact={true}
                />
                <div className="flex-1 space-y-1.5 text-[11px] min-w-0">
                  {listingTypeSegments.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto] items-center gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <span
                          className="size-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-zinc-600 font-normal truncate text-[10.5px] leading-tight" title={s.label}>
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

            {/* Widget 3: Payout status */}
            <div className="bg-zinc-50/60 p-3 sm:p-3.5 rounded-2xl border border-zinc-100 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="size-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <h4 className="text-[11px] sm:text-xs font-medium text-zinc-800">
                  Payout status
                </h4>
              </div>
              <div className="flex items-center gap-2.5">
                <SvgDonut
                  segments={payoutStatusSegments}
                  centerAmount={fmtCompact(totalNetEarnings, currency)}
                  size={76}
                  strokeWidth={7.5}
                  compact={true}
                />
                <div className="flex-1 space-y-1.5 text-[11px] min-w-0">
                  {payoutStatusSegments.map((s, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto] items-center gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <span
                          className="size-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-zinc-600 font-normal truncate text-[10.5px] leading-tight" title={s.label}>
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
              aria-hidden="true"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-normal text-zinc-500 truncate">
                Total earnings
              </span>
              {metrics.totalEarningsDelta !== null && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                  {metrics.totalEarningsDelta >= 0 ? "↑" : "↓"} {Math.abs(metrics.totalEarningsDelta)}%
                </span>
              )}
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.totalEarnings}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
              {reporting.comparison?.enabled ? "vs previous period" : "For active period"}
            </p>
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
              aria-hidden="true"
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
              {metrics.bookingsDelta !== null && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                  {metrics.bookingsDelta >= 0 ? "↑" : "↓"} {Math.abs(metrics.bookingsDelta)}%
                </span>
              )}
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.bookings}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
              {reporting.comparison?.enabled ? "vs previous period" : "For active period"}
            </p>
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
              aria-hidden="true"
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
              {metrics.avgDelta !== null && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                  {metrics.avgDelta >= 0 ? "↑" : "↓"} {Math.abs(metrics.avgDelta)}%
                </span>
              )}
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.avgPerBooking}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
              {reporting.comparison?.enabled ? "vs previous period" : "For active period"}
            </p>
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
              aria-hidden="true"
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
              {metrics.commissionDelta !== null && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100/60 shrink-0">
                  {metrics.commissionDelta >= 0 ? "↑" : "↓"} {Math.abs(metrics.commissionDelta)}%
                </span>
              )}
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.commission}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
              {reporting.comparison?.enabled ? "vs previous period" : "For active period"}
            </p>
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
              aria-hidden="true"
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
              {metrics.guestsDelta !== null && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100/60 shrink-0">
                  {metrics.guestsDelta >= 0 ? "↑" : "↓"} {Math.abs(metrics.guestsDelta)}%
                </span>
              )}
            </div>
            <p className="text-lg sm:text-xl font-medium tracking-tight text-zinc-900 mt-1 truncate">
              {metrics.guests}
            </p>
            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
              {reporting.comparison?.enabled ? "vs previous period" : "For active period"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
