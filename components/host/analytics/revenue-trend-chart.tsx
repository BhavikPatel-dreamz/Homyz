"use client";

import React, { useState, useMemo } from "react";
import { PercentageChangeBadge } from "./percentage-change-badge";

export type TrendMetricMode = "net" | "gross" | "fees";

export interface TrendDataPoint {
  dateKey: string;
  label: string;
  accommodationRevenueCents: number;
  netHostEarningsCents: number;
  hostServiceFeesCents: number;
  qualifyingBookingsCount: number;
}

interface RevenueTrendChartProps {
  trend: TrendDataPoint[];
  currentNetCents: number;
  previousNetCents: number;
  currency?: string;
  periodLabel: string;
  comparisonLabel: string;
  className?: string;
}

const fmtCurrency = (cents: number, curr = "SAR") => {
  const val = Math.round(cents / 100);
  return `${curr} ${val.toLocaleString("en-US")}`;
};

const fmtAxis = (cents: number, curr = "SAR") => {
  const val = Math.round(cents / 100);
  if (val >= 1000) {
    const k = val / 1000;
    return `${curr} ${k % 1 === 0 ? k : k.toFixed(1).replace(".0", "")}K`;
  }
  return `${curr} ${val}`;
};

export function RevenueTrendChart({
  trend,
  currentNetCents,
  previousNetCents,
  currency = "SAR",
  periodLabel,
  comparisonLabel,
  className = "",
}: RevenueTrendChartProps) {
  const [metricMode, setMetricMode] = useState<TrendMetricMode>("net");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Comparison metrics
  const differenceCents = currentNetCents - previousNetCents;
  const percentageDelta =
    previousNetCents > 0
      ? Math.round((differenceCents / previousNetCents) * 100)
      : null;

  // Compute points according to active metric mode
  const activePoints = useMemo(() => {
    return trend.map((pt, idx) => {
      let valueCents = pt.netHostEarningsCents;
      if (metricMode === "gross") {
        valueCents = pt.accommodationRevenueCents;
      } else if (metricMode === "fees") {
        valueCents = pt.hostServiceFeesCents;
      }
      return {
        id: pt.dateKey || `pt-${idx}`,
        dateKey: pt.dateKey,
        label: pt.label,
        value: valueCents,
        bookings: pt.qualifyingBookingsCount,
      };
    });
  }, [trend, metricMode]);

  // Peak day and active days
  const peakDay = useMemo(() => {
    if (!activePoints.length) return null;
    return activePoints.reduce((prev, curr) =>
      curr.value > (prev ? prev.value : 0) ? curr : prev,
    );
  }, [activePoints]);

  const activeDaysCount = useMemo(() => {
    return activePoints.filter((p) => p.value > 0).length;
  }, [activePoints]);

  // Clean Y-axis scale
  const yTicks = useMemo(() => {
    const maxVal = Math.max(100000, ...activePoints.map((p) => p.value));
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
  }, [activePoints]);

  const chartCeil = yTicks[0] || 100000;

  return (
    <div
      className={`rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-xs ${className}`}
    >
      {/* SVG Gradient Defs */}
      <svg className="w-0 h-0 absolute">
        <defs>
          <linearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5D061" />
            <stop offset="100%" stopColor="#3E382A" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Header Row */}
      <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h2 className="text-sm font-medium text-zinc-800">
              Actual realized revenue ·{" "}
              <span className="text-zinc-500 font-normal">{periodLabel}</span>
            </h2>
          </div>

          <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            {metricMode === "net"
              ? "Net realized host earnings"
              : metricMode === "gross"
                ? "Eligible accommodation revenue"
                : "Host service fees (platform)"}
          </p>

          <p className="mt-1 text-3xl sm:text-4xl font-medium tracking-tight text-zinc-950">
            {fmtCurrency(currentNetCents, currency)}
          </p>

          <p className="mt-1 text-xs text-zinc-500 font-normal">
            Completed-stay settlement eligibility, not a bank-transfer
            confirmation.
          </p>
        </div>

        {/* Comparison Badge Card */}
        <div className="flex w-full flex-col items-start rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3.5 sm:w-auto sm:min-w-[220px] sm:items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-normal text-zinc-500">
              {comparisonLabel || "Comparison period"}
            </span>
            <PercentageChangeBadge value={percentageDelta} />
          </div>
          <p className="mt-1.5 text-xs text-zinc-600 font-normal">
            Previous net earnings:{" "}
            <span className="font-medium text-zinc-900">
              {fmtCurrency(previousNetCents, currency)}
            </span>
          </p>
          <p
            className={`mt-0.5 text-xs font-medium ${
              differenceCents >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {differenceCents >= 0 ? "+" : ""}
            {fmtCurrency(differenceCents, currency)} {differenceCents >= 0 ? "increase" : "decrease"}
          </p>
        </div>
      </div>

      {/* Toolbar: Metric Pills & Stats */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Metric Switcher Pills */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-zinc-100/80 p-1 sm:flex-nowrap sm:rounded-full sm:gap-1.5">
          <button
            type="button"
            onClick={() => setMetricMode("net")}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition cursor-pointer sm:px-3.5 ${
              metricMode === "net"
                ? "bg-[#1A1A1A] text-white shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            Net Earnings
          </button>
          <button
            type="button"
            onClick={() => setMetricMode("gross")}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition cursor-pointer sm:px-3.5 ${
              metricMode === "gross"
                ? "bg-[#1A1A1A] text-white shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            Gross Earnings
          </button>
          <button
            type="button"
            onClick={() => setMetricMode("fees")}
            className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition cursor-pointer sm:px-3.5 ${
              metricMode === "fees"
                ? "bg-[#1A1A1A] text-white shadow-2xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
            }`}
          >
            Fees (Platform)
          </button>
        </div>

        {/* Legend / Info Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-normal">
          {peakDay && peakDay.value > 0 && (
            <span>
              Peak Day:{" "}
              <strong className="font-medium text-zinc-900">
                {fmtCurrency(peakDay.value, currency)}
              </strong>
            </span>
          )}
          <span>
            Active Days:{" "}
            <strong className="font-medium text-zinc-900">
              {activeDaysCount}
            </strong>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-[#F5D061]" />
            <span>{periodLabel}</span>
          </span>
        </div>
      </div>

      {/* Chart Area with Gridlines & Bars */}
      <div className="relative mt-6 flex h-[230px] w-full min-w-0 pt-2 sm:h-[280px]">
        {/* Y-Axis */}
        <div className="flex w-11 shrink-0 select-none flex-col justify-between pb-6 pr-2 text-right text-[10px] font-normal text-zinc-400 sm:w-14 sm:pr-2.5 sm:text-[11px]">
          {yTicks.map((tick, i) => (
            <span key={i} className="leading-none whitespace-nowrap">
              {fmtAxis(tick, currency)}
            </span>
          ))}
        </div>

        {/* Canvas Area */}
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

          {/* Vertical Bars */}
          <div className="relative z-10 size-full pb-6 flex items-end justify-between gap-1 sm:gap-2 px-1">
            {activePoints.map((point, idx) => {
              const pct = Math.min(
                100,
                Math.max(0, (point.value / chartCeil) * 100),
              );
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={point.id}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
                >
                  {/* Floating Tooltip */}
                  {isHovered && point.value > 0 && (
                    <div
                      className="absolute left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-in rounded-xl border border-zinc-700/60 bg-[#1A1A1A]/95 px-3 py-2 text-center text-white shadow-2xl backdrop-blur-sm duration-100 fade-in zoom-in-95"
                      style={{
                        bottom: pct > 72 ? undefined : `calc(${pct}% + 10px)`,
                        top: pct > 72 ? "8px" : undefined,
                      }}
                    >
                      <p className="text-[11px] font-normal text-zinc-300 leading-tight">
                        {point.label}
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-[#FCDF9C] mt-1 leading-tight">
                        {fmtCurrency(point.value, currency)}
                      </p>
                      {point.bookings > 0 && (
                        <p className="text-[10px] font-normal text-zinc-400 mt-0.5 leading-tight">
                          {point.bookings} booking
                          {point.bookings === 1 ? "" : "s"}
                        </p>
                      )}
                      {pct <= 72 && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px size-0 border-x-4 border-x-transparent border-t-4 border-t-[#1A1A1A]" />
                      )}
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
          <div className="w-full flex items-center justify-between text-[11px] font-normal text-zinc-400 pt-1.5 border-t border-zinc-200">
            {activePoints
              .filter((_, idx, arr) => {
                if (idx === 0 || idx === arr.length - 1) return true;
                const step = Math.max(1, Math.ceil(arr.length / 4));
                return idx % step === 0;
              })
              .map((p) => (
                <span key={p.id} className="max-w-[4rem] truncate sm:max-w-none">
                  {p.label}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
