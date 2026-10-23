"use client";

import React from "react";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import type { InsightsTab } from "@/services/host-insights.service";

interface InsightsHeaderProps {
  activeTab: InsightsTab;
  listings: Array<{ id: string; title: string }>;
  selectedListingId: string | null;
  onListingChange: (listingId: string | null) => void;
  selectedPeriod: DateRangePreset;
  onPeriodChange: (period: DateRangePreset) => void;
  startDate?: string;
  endDate?: string;
  onCustomDateChange: (startDate: string, endDate: string) => void;
  periodLabel: string;
}

const PERIOD_OPTIONS: Array<{ id: DateRangePreset; label: string }> = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "last_3_months", label: "Last 3 months" },
  { id: "last_6_months", label: "Last 6 months" },
  { id: "last_12_months", label: "Last 12 months" },
  { id: "year_to_date", label: "Year to date" },
  { id: "custom", label: "Custom range" },
];

export function InsightsHeader({
  activeTab,
  listings,
  selectedListingId,
  onListingChange,
  selectedPeriod,
  onPeriodChange,
  startDate,
  endDate,
  onCustomDateChange,
  periodLabel,
}: InsightsHeaderProps) {
  const isSuperhostTab = activeTab === "superhost";

  return (
    <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Host Analytics</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1F1F1F] sm:text-4xl">Insights</h1>
        <p className="mt-1 text-sm text-[#727272]">
          Track guest feedback, hosting performance {periodLabel}.
        </p>
      </div>

      {/* Shared Filter Controls */}
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Listing Selector (Not applicable to host-level Superhost) */}
          {!isSuperhostTab && (
            <div className="group relative inline-flex items-center shrink-0">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#727272]">
                Property:
              </span>
              <select
                aria-label="Filter insights by property"
                value={selectedListingId || ""}
                onChange={(e) => onListingChange(e.target.value || null)}
                className="appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-18 pr-8.5 py-1.5 text-sm font-medium text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none max-w-[240px] truncate"
              >
                <option value="">All listings</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          )}

          {/* Reporting Period Filter */}
          {!isSuperhostTab ? (
            <div className="group relative inline-flex items-center shrink-0">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#727272]">
                Period:
              </span>
              <select
                aria-label="Filter insights by reporting period"
                value={selectedPeriod}
                onChange={(e) => onPeriodChange(e.target.value as DateRangePreset)}
                className="appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-15 pr-8.5 py-1.5 text-sm font-medium text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D7D7D7] bg-[#F3F4F5] px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F]">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>12-Month Platform Assessment Window</span>
            </div>
          )}
        </div>

        {!isSuperhostTab && selectedPeriod === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1F1F1F] sm:justify-end">
            <label className="flex items-center gap-1.5">
              <span className="text-[#727272]">From</span>
              <input
                aria-label="Insights custom start date"
                type="date"
                value={startDate || ""}
                onChange={(event) => onCustomDateChange(event.target.value, endDate || "")}
                className="rounded-full border border-[#D7D7D7] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-[#727272]">To</span>
              <input
                aria-label="Insights custom end date"
                type="date"
                value={endDate || ""}
                onChange={(event) => onCustomDateChange(startDate || "", event.target.value)}
                className="rounded-full border border-[#D7D7D7] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
