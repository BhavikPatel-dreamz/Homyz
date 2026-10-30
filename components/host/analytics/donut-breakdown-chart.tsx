"use client";

import React, { useMemo } from "react";

export interface DonutBreakdownSegment {
  label: string;
  amount?: number;
  percentage: number;
  color: string;
}

interface DonutBreakdownChartProps {
  segments: DonutBreakdownSegment[];
  centerLabel: string;
  centerSubtitle?: string;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
  currency?: string;
  className?: string;
}

export function DonutBreakdownChart({
  segments,
  centerLabel,
  centerSubtitle,
  size = 110,
  strokeWidth = 9,
  showLegend = false,
  currency = "SAR",
  className = "",
}: DonutBreakdownChartProps) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89

  const totalValue = segments.reduce(
    (sum, s) => sum + (s.amount !== undefined ? s.amount : s.percentage),
    0,
  );

  const normalized = useMemo(() => {
    if (totalValue <= 0) {
      return segments.map((s) => ({ ...s, effectivePct: 0 }));
    }
    return segments.map((s) => {
      const val = s.amount !== undefined ? s.amount : s.percentage;
      const pct = (val / totalValue) * 100;
      return {
        ...s,
        effectivePct: pct > 0 ? Math.max(3, pct) : 0,
        displayPct: Math.round(pct),
      };
    });
  }, [segments, totalValue]);

  let accumulatedPct = 0;

  // Currency parser for center text
  const parsed = useMemo(() => {
    const trimmed = centerLabel.trim();
    const match = trimmed.match(/^([^\d\s]+|\D+)?\s*([\d,.]+.*)$/);
    const prefix = match?.[1]?.trim() || "";
    const number = match?.[2]?.trim() || trimmed;
    return { prefix, number, isMultiLetterPrefix: prefix.length > 1 };
  }, [centerLabel]);

  return (
    <div className={`flex flex-col items-center gap-4 sm:flex-row sm:items-center ${className}`}>
      {/* SVG Donut Circle */}
      <div
        className="relative flex items-center justify-center shrink-0"
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

          {/* Slices */}
          {totalValue > 0 &&
            normalized.map((segment, idx) => {
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

        {/* Center Text (never clipped, neatly stacked) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1 pointer-events-none select-none">
          {parsed.isMultiLetterPrefix ? (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[8px] font-normal text-zinc-400 leading-none mb-0.5">
                {parsed.prefix}
              </span>
              <span className="text-xs sm:text-[13px] font-medium tracking-tight text-zinc-950 leading-none">
                {parsed.number}
              </span>
              {centerSubtitle && (
                <span className="text-[8px] font-normal text-zinc-400 leading-none mt-1">
                  {centerSubtitle}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center leading-tight">
              <span className="text-xs sm:text-[13px] font-medium tracking-tight text-zinc-950 leading-tight">
                {centerLabel}
              </span>
              {centerSubtitle && (
                <span className="text-[8px] font-normal text-zinc-400 mt-0.5 leading-tight">
                  {centerSubtitle}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Optional Legend on Right */}
      {showLegend && (
        <div className="w-full min-w-0 flex-1 space-y-1.5">
          {segments.map((segment, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 text-xs leading-tight"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="truncate text-zinc-600 font-normal" title={segment.label}>
                  {segment.label}
                </span>
              </div>
              <div className="shrink-0 text-right font-medium text-zinc-900 whitespace-nowrap pl-1">
                {segment.amount !== undefined && (
                  <span>
                    {currency}{" "}
                    {Math.round(segment.amount / 100).toLocaleString("en-US")}
                  </span>
                )}
                <span className="text-zinc-400 font-normal ml-1">
                  {segment.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
