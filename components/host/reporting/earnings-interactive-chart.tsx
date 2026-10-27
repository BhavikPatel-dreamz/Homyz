"use client";

import React, { useState, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { TooltipContentProps, TooltipValueType } from "recharts";
import type { HostEarningsChartPoint } from "@/services/payout.service";

export type ChartMetric = "net" | "gross" | "fees";

export interface EarningsInteractiveChartProps {
  points: HostEarningsChartPoint[];
  currency: string;
  timeframeLabel: string;
  comparisonLabel?: string | null;
  onSelectPoint?: (index: number | null) => void;
  selectedPointIndex?: number | null;
  selectedListingId?: string | null;
  /** The financial numerator represented by `grossEarnings`; defaults to the settlement chart's gross definition. */
  grossLabel?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  className?: string;
}

interface FormattedChartItem {
  index: number;
  key: string;
  label: string;
  fullLabel: string;
  startDateKey: string;
  endDateKey: string;
  primaryValue: number;
  secondaryValue: number;
  netEarnings: number;
  grossEarnings: number;
  platformFee: number;
  completedStaysCount: number;
  propertyBreakdown: HostEarningsChartPoint["propertyBreakdown"];
  secondaryAmount?: number;
  secondaryPlatformFee?: number;
}

const emptySubscribe = () => () => { };

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

export const fmtCompact = (cents: number, currency: string) => {
  const units = cents / 100;
  if (units >= 1_000_000) {
    return `${currency} ${(units / 1_000_000).toFixed(1)}M`;
  }
  if (units >= 1_000) {
    return `${currency} ${(units / 1_000).toFixed(0)}k`;
  }
  return `${currency} ${Math.round(units)}`;
};

export function EarningsInteractiveChart({
  points,
  currency,
  timeframeLabel,
  comparisonLabel,
  onSelectPoint,
  selectedPointIndex = null,
  selectedListingId = null,
  grossLabel = "Gross Earnings",
  emptyTitle = "No earnings recorded for this timeframe",
  emptyMessage = "Try adjusting the property filter or selecting a different reporting period.",
  className = "",
}: EarningsInteractiveChartProps) {
  const [activeMetric, setActiveMetric] = useState<ChartMetric>("net");
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hasComparison = Boolean(comparisonLabel);

  // Format data specifically for Recharts
  const chartData: FormattedChartItem[] = useMemo(() => {
    return points.map((p, index) => {
      const net = p.netEarnings || p.amount || 0;
      const gross = p.grossEarnings || 0;
      const fees = p.platformFee || 0;

      const primary =
        activeMetric === "net" ? net : activeMetric === "gross" ? gross : fees;

      const secondary =
        activeMetric === "net"
          ? p.secondaryAmount || 0
          : activeMetric === "gross"
            ? p.secondaryGrossEarnings || 0
            : p.secondaryPlatformFee || 0;

      return {
        index,
        key: p.key,
        label: p.label,
        fullLabel: p.fullLabel || p.label,
        startDateKey: p.startDateKey || p.key,
        endDateKey: p.endDateKey || p.key,
        primaryValue: primary,
        secondaryValue: secondary,
        netEarnings: net,
        grossEarnings: gross,
        platformFee: fees,
        completedStaysCount: p.completedStaysCount || 0,
        propertyBreakdown: p.propertyBreakdown || [],
        secondaryAmount: p.secondaryAmount,
      };
    });
  }, [points, activeMetric]);

  const maxAmount = useMemo(() => {
    let max = 1;
    for (const d of chartData) {
      if (d.primaryValue > max) max = d.primaryValue;
      if (d.secondaryValue > max) max = d.secondaryValue;
    }
    return max;
  }, [chartData]);

  const hasData = useMemo(() => {
    return chartData.some((d) => d.primaryValue > 0 || d.secondaryValue > 0);
  }, [chartData]);

  // Aggregate stats for toolbar pills
  const periodStats = useMemo(() => {
    let totalNet = 0;
    let totalGross = 0;
    let totalFees = 0;
    let activeDays = 0;
    let highestAmount = 0;

    for (const p of points) {
      const net = p.netEarnings || p.amount || 0;
      totalNet += net;
      totalGross += p.grossEarnings || 0;
      totalFees += p.platformFee || 0;
      if (net > 0) {
        activeDays++;
        if (net > highestAmount) highestAmount = net;
      }
    }

    return { totalNet, totalGross, totalFees, activeDays, highestAmount };
  }, [points]);

  // Y-axis tick intervals
  const yTicks = useMemo(() => {
    return [0, Math.round(maxAmount * 0.33), Math.round(maxAmount * 0.66), maxAmount];
  }, [maxAmount]);

  const selPoint =
    selectedPointIndex !== null && chartData[selectedPointIndex]
      ? chartData[selectedPointIndex]
      : null;

  // Custom Rich Recharts Tooltip
  const renderTooltip = ({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as unknown as FormattedChartItem;

    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 text-xs text-zinc-900 shadow-2xl transition-all min-w-[220px]">
        <p className="font-bold text-zinc-950 border-b border-zinc-100 pb-1.5 text-xs">
          {data.fullLabel}
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-[11px] font-semibold text-zinc-500">Net Host Earnings:</span>
          <span className="font-extrabold text-zinc-950 text-sm">
            {fmt(data.netEarnings, currency)}
          </span>
        </div>
        <div className="mt-1.5 space-y-1 text-[11px] text-zinc-600">
          <div className="flex justify-between gap-4">
            <span>{grossLabel}:</span>
            <span className="font-semibold text-zinc-900">{fmt(data.grossEarnings, currency)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Host Service Fees:</span>
            <span className="font-semibold text-rose-600">
              -{fmt(data.platformFee, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Completed Stays:</span>
            <span className="font-semibold text-zinc-900">
              {data.completedStaysCount} reservation{data.completedStaysCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Comparison Details in Tooltip */}
        {hasComparison && typeof data.secondaryAmount === "number" && (
          <div className="mt-2 border-t border-zinc-100 pt-1.5 text-[11px]">
            <div className="flex justify-between gap-4 text-zinc-500">
              <span>Comparison ({comparisonLabel}):</span>
              <span className="font-semibold">{fmt(data.secondaryAmount, currency)}</span>
            </div>
            <div className="mt-0.5 flex justify-between gap-4 font-bold">
              <span>Difference:</span>
              <span
                className={
                  data.netEarnings >= data.secondaryAmount
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {data.netEarnings >= data.secondaryAmount ? "+" : ""}
                {fmt(data.netEarnings - data.secondaryAmount, currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Chart Header Toolbar: Metric Selector, Quick Performance Stats & Legend ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEDED] pb-3">
        {/* Metric Selector Buttons */}
        <div className="flex items-center gap-1 rounded-full bg-[#F3F4F5] p-1 text-xs font-medium text-[#727272]">
          <button
            type="button"
            onClick={() => setActiveMetric("net")}
            className={`rounded-full px-2.5 sm:px-4 py-1.5 sm:text-sm text-xs transition-all cursor-pointer ${activeMetric === "net"
              ? "bg-[#1F1F1F] text-white shadow-2xs font-medium"
              : "text-[#727272] hover:text-[#1F1F1F]"
              }`}
          >
            <span>Net</span>
            <span className="hidden sm:inline"> Earnings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("gross")}
            className={`rounded-full px-2.5 sm:px-4 py-1.5 sm:text-sm text-xs transition-all cursor-pointer ${activeMetric === "gross"
              ? "bg-[#1F1F1F] text-white shadow-2xs font-medium"
              : "text-[#727272] hover:text-[#1F1F1F]"
              }`}
          >
            <span>Gross</span>
            <span className="hidden sm:inline"> Earnings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("fees")}
            className={`rounded-full px-2.5 sm:px-4 py-1.5 sm:text-sm text-xs transition-all cursor-pointer ${activeMetric === "fees"
              ? "bg-[#1F1F1F] text-white shadow-2xs font-medium"
              : "text-[#727272] hover:text-[#1F1F1F]"
              }`}
          >
            <span>Fees</span>
            <span className="hidden sm:inline"> (Platform)</span>
          </button>
        </div>

        {/* Quick Period Summary Pills */}
        <div className="hidden md:flex items-center gap-3 text-sm text-[#727272]">
          <div className="flex items-center gap-1.5 rounded-full bg-[#FAFAFA] px-3.5 py-1 border border-[#EDEDED] shadow-2xs">
            <span className="font-normal text-[#727272]">Peak Day:</span>
            <span className="font-medium text-[#1F1F1F]">{fmt(periodStats.highestAmount, currency)}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#FAFAFA] px-3.5 py-1 border border-[#EDEDED] shadow-2xs">
            <span className="font-normal text-[#727272]">Active Days:</span>
            <span className="font-medium text-[#1F1F1F]">{periodStats.activeDays}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-[#1F1F1F]" />
            <span className="text-[#1F1F1F] sm:text-sm text-xs">{timeframeLabel}</span>
          </div>
          {hasComparison && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#D7D7D7]" />
              <span className="text-[#727272] sm:text-sm text-xs">{comparisonLabel}</span>
            </div>
          )}
        </div>
      </div>

      {hasData ? (
        <div className="relative pt-2">
          {/* Recharts Container */}
          <div className="h-[230px] sm:h-[280px] lg:h-[320px] w-full min-w-0">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 15, right: 10, left: 0, bottom: 25 }}
                  barGap={4}
                  barCategoryGap={chartData.length > 20 ? "15%" : "25%"}
                  onMouseMove={(state) => {
                    if (typeof state.activeTooltipIndex === "number") {
                      setHoveredIndex(state.activeTooltipIndex);
                    }
                  }}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={(state) => {
                    if (
                      typeof state.activeTooltipIndex === "number" &&
                      onSelectPoint
                    ) {
                      const idx = state.activeTooltipIndex;
                      onSelectPoint(idx === selectedPointIndex ? null : idx);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="primaryBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#18181b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#09090b" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#27272a" stopOpacity={1} />
                      <stop offset="100%" stopColor="#18181b" stopOpacity={0.95} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f4f4f5"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={{ stroke: "#e4e4e7" }}
                    tickLine={false}
                    tick={{ fill: "#71717a", fontSize: 11, fontWeight: 500 }}
                    dy={10}
                    interval={chartData.length > 25 ? 3 : chartData.length > 14 ? 1 : 0}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 500 }}
                    tickFormatter={(val) => fmtCompact(val, currency)}
                    ticks={yTicks}
                    domain={[0, maxAmount]}
                    width={48}
                  />

                  <Tooltip
                    content={renderTooltip}
                    cursor={{ fill: "rgba(244, 244, 245, 0.6)", radius: 6 }}
                  />

                  {/* Comparison Bar (if enabled) */}
                  {hasComparison && (
                    <Bar
                      dataKey="secondaryValue"
                      fill="#d4d4d8"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={32}
                    />
                  )}

                  {/* Primary Bar with rounded tops and interactive cell highlights */}
                  <Bar
                    dataKey="primaryValue"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry, index) => {
                      const isSelected = selectedPointIndex === index;
                      const isHovered = hoveredIndex === index;

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            isSelected
                              ? "#09090b"
                              : isHovered
                                ? "url(#hoverBarGradient)"
                                : entry.primaryValue > 0
                                  ? "url(#primaryBarGradient)"
                                  : "#e4e4e7"
                          }
                          stroke={isSelected ? "#09090b" : "transparent"}
                          strokeWidth={isSelected ? 2 : 0}
                          className="transition-all duration-200"
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-50/50 rounded-2xl animate-pulse" />
            )}
          </div>

          {/* ── Section: Selected Bar / Period Details Panel (BELOW Chart) ── */}
          {selPoint && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 sm:p-5 text-zinc-900 shadow-2xs transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EDEDED] pb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">
                    Period Earnings Breakdown
                  </p>
                  <h4 className="text-base font-medium text-[#1F1F1F] sm:text-lg">
                    {selPoint.fullLabel}
                  </h4>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    href={`/host/earnings/paid?datePreset=custom&startDate=${selPoint.startDateKey}&endDate=${selPoint.endDateKey}&currency=${currency}${selectedListingId ? `&propertyId=${selectedListingId}` : ""}`}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1F1F1F] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
                  >
                    <span>View Transactions</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onSelectPoint && onSelectPoint(null)}
                    className="rounded-full border border-[#D7D7D7] bg-white px-3.5 py-2 text-xs font-medium text-[#727272] hover:text-[#1F1F1F] hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Financial KPI micro cards */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                <div className="rounded-2xl border border-[#EDEDED] bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">Net Earnings</p>
                  <p className="mt-1 text-base font-medium text-[#1F1F1F] sm:text-lg">
                    {fmt(selPoint.netEarnings, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#EDEDED] bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">{grossLabel}</p>
                  <p className="mt-1 text-base font-medium text-[#1F1F1F] sm:text-lg">
                    {fmt(selPoint.grossEarnings, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#EDEDED] bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">Host Service Fees</p>
                  <p className="mt-1 text-base font-medium text-rose-700 sm:text-lg">
                    -{fmt(selPoint.platformFee, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#EDEDED] bg-white p-3.5 shadow-2xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#727272]">Completed Stays</p>
                  <p className="mt-1 text-base font-medium text-[#1F1F1F] sm:text-lg">
                    {selPoint.completedStaysCount}
                  </p>
                </div>
              </div>

              {/* Property Breakdown (if present) */}
              {selPoint.propertyBreakdown && selPoint.propertyBreakdown.length > 0 && (
                <div className="mt-4 border-t border-[#EDEDED] pt-3">
                  <p className="text-xs font-medium text-[#1F1F1F]">Earnings by Property</p>
                  <div className="mt-2 divide-y divide-[#EDEDED] rounded-2xl border border-[#EDEDED] bg-white overflow-hidden text-xs">
                    {selPoint.propertyBreakdown.map((prop) => (
                      <div key={prop.listingId} className="flex items-center justify-between p-2.5 hover:bg-[#FAFAFA] transition-colors">
                        <span className="font-medium text-[#1F1F1F] truncate max-w-[240px] sm:max-w-md">
                          {prop.title}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[#727272]">
                            {prop.count} stay{prop.count === 1 ? "" : "s"}
                          </span>
                          <span className="font-medium text-[#1F1F1F]">
                            {fmt(prop.netEarnings || prop.amount, currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 py-12 text-center">
            <span className="size-10 rounded-full bg-[#D9D9D9] flex justify-center items-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </span>
          <p className="mt-2 text-base font-medium text-[#1f1f1f]">{emptyTitle}</p>
          <p className="mt-1 text-sm text-[#727272] max-w-xl">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
