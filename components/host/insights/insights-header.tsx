"use client";

import React from "react";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import type { InsightsTab } from "@/services/host-insights.service";
import { PropertySelector } from "@/components/host/reporting/property-selector";

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
        <p className="text-sm font-medium text-[#727272]">Host Analytics</p>
        <h1 className="mt-1">Insights</h1>
        <p className="mt-1 text-sm text-[#727272]">
          Track guest feedback, hosting performance {periodLabel}.
        </p>
      </div>

      {/* Shared Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Listing Selector (Not applicable to host-level Superhost) */}
        {!isSuperhostTab && (
          <PropertySelector
            listings={listings}
            selectedListingId={selectedListingId}
            onSelect={onListingChange}
            className="w-full sm:w-auto"
          />
        )}

        {/* Reporting Period Filter */}
        {!isSuperhostTab ? (
          <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-2xs focus-within:border-zinc-950 focus-within:ring-2 focus-within:ring-zinc-950/10">
            <span className="text-xs text-zinc-500">Period:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => onPeriodChange(e.target.value as DateRangePreset)}
              aria-label="Insights reporting period"
              className="bg-transparent font-semibold focus:outline-none"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <span>12-Month Platform Assessment Window</span>
          </div>
        )}
      </div>
    </div>
  );
}
