"use client";

import React from "react";
import Link from "next/link";
import { DatePeriodPicker, type DatePeriodPickerState } from "@/components/host/reporting/date-period-picker";

interface AnalyticsPageHeaderProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  listings: Array<{ id: string; title: string }>;
  selectedListingId: string | null;
  onListingChange: (listingId: string | null) => void;
  periodPickerState: DatePeriodPickerState;
  onPeriodChange: (next: DatePeriodPickerState) => void;
  periodDisplayLabel: string;
  onOpenCompare: () => void;
  hasActiveComparison?: boolean;
  onClearComparison?: () => void;
  loading?: boolean;
  className?: string;
}

export function AnalyticsPageHeader({
  eyebrow = "DASHBOARD PLUS",
  title = "Advanced Earnings Analytics",
  subtitle = "Understand your revenue, profitability, and financial performance across your listings.",
  listings,
  selectedListingId,
  onListingChange,
  periodPickerState,
  onPeriodChange,
  periodDisplayLabel,
  onOpenCompare,
  hasActiveComparison = false,
  onClearComparison,
  loading = false,
  className = "",
}: AnalyticsPageHeaderProps) {
  return (
    <header className={`border-b border-zinc-200/80 pb-6 ${className}`}>
      {/* Eyebrow */}
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-800">
        {eyebrow}
      </span>

      {/* Main Title Row */}
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
            {title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-500 font-normal">
            {subtitle}
          </p>
        </div>

        {/* Action navigation links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-zinc-700">
          <Link
            href="/host/operations"
            className="inline-flex items-center gap-1.5 hover:text-zinc-950 underline underline-offset-4 transition"
          >
            <span aria-hidden="true">🏢</span>
            <span>Property operations</span>
          </Link>
          <Link
            href="/host/earnings"
            className="inline-flex items-center gap-1.5 hover:text-zinc-950 underline underline-offset-4 transition"
          >
            <span aria-hidden="true">↩</span>
            <span>Back to earnings</span>
          </Link>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Listing Selector Dropdown */}
        <div className="relative w-full sm:w-auto">
          <select
            aria-label="Filter analytics by property"
            value={selectedListingId ?? ""}
            onChange={(e) => onListingChange(e.target.value || null)}
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 outline-none transition hover:border-zinc-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 sm:w-auto sm:max-w-[280px] sm:text-sm"
          >
            <option value="">
              All listings · {listings.length} properties total
            </option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title}
              </option>
            ))}
          </select>
        </div>

        {/* Date Period Picker */}
        <div className="relative w-full sm:w-auto">
          <DatePeriodPicker
            value={periodPickerState}
            onChange={onPeriodChange}
            displayLabel={periodDisplayLabel}
            disabled={loading}
            className="w-full"
          />
        </div>

        {/* Compare Periods Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCompare}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition cursor-pointer sm:min-h-0 sm:text-sm ${
              hasActiveComparison
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-400"
            }`}
          >
            <span aria-hidden="true">📊</span>
            <span>Compare periods</span>
          </button>

          {hasActiveComparison && onClearComparison && (
            <button
              type="button"
              onClick={onClearComparison}
              className="text-xs text-zinc-500 hover:text-rose-600 underline underline-offset-2 transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
