"use client";

import React from "react";

interface PercentageChangeBadgeProps {
  value: number | string | null | undefined;
  suffix?: string;
  className?: string;
  invertColors?: boolean; // For costs, where a decrease is positive (green) and increase is negative (rose)
}

export function PercentageChangeBadge({
  value,
  suffix = "",
  className = "",
  invertColors = false,
}: PercentageChangeBadgeProps) {
  if (value === null || value === undefined) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ${className}`}
      >
        —
      </span>
    );
  }

  const numVal =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/[^0-9.-]/g, ""));

  if (Number.isNaN(numVal) || numVal === 0) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ${className}`}
      >
        0%{suffix}
      </span>
    );
  }

  const isPositive = numVal > 0;
  const isFavorable = invertColors ? !isPositive : isPositive;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
        isFavorable
          ? "border border-emerald-100/80 bg-emerald-50 text-emerald-700"
          : "border border-rose-100/80 bg-rose-50 text-rose-700"
      } ${className}`}
    >
      <span aria-hidden="true">{isPositive ? "↑" : "↓"}</span>
      <span>
        {Math.abs(Math.round(numVal))}%{suffix}
      </span>
    </span>
  );
}

