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
  const selectedPeriodLabel = PERIOD_OPTIONS.find((opt) => opt.id === selectedPeriod)?.label || "Select period";

  return (
    <div className="flex flex-col gap-5 border-b border-[#E5E5E5] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-lg xl:max-w-xl">
        <p className="text-xs sm:text-sm font-medium text-[#727272]">Host Analytics</p>
        <h1 className="mt-1 text-2xl min-[480px]:text-3xl sm:text-4xl font-medium tracking-tight text-[#1F1F1F]">
          Insights
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm font-normal text-[#727272] leading-relaxed">
          Track guest feedback, hosting performance, and key opportunities {periodLabel}.
        </p>
      </div>

      {/* Shared Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0 w-full sm:w-auto">
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
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center w-full sm:w-auto">
            <div className="relative inline-block w-full sm:w-auto text-left">
              <div className="group flex h-11 sm:h-12 w-full sm:w-auto sm:min-w-[180px] lg:min-w-[195px] xl:min-w-[210px] shrink-0 items-center justify-between gap-2.5 sm:gap-3 rounded-full border border-[#D7D7D7] bg-white px-3 sm:px-3.5 text-left text-xs sm:text-sm font-medium transition-all shadow-2xs hover:border-[#1F1F1F] focus-within:border-[#1F1F1F] focus-within:ring-2 focus-within:ring-[#1F1F1F]/5 cursor-pointer">
                <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
                  {/* Calendar Icon Badge */}
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1F1F1F] text-white">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1 truncate">
                    <p className="truncate text-sm font-normal text-[#1F1F1F]">
                      {selectedPeriodLabel}
                    </p>
                    <p className="truncate text-xs font-normal text-[#727272]">
                      Reporting period
                    </p>
                  </div>
                </div>

                <svg
                  className="h-4 w-4 shrink-0 text-[#727272] transition-colors group-hover:text-[#1F1F1F]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>

                <select
                  value={selectedPeriod}
                  onChange={(e) => onPeriodChange(e.target.value as DateRangePreset)}
                  aria-label="Insights reporting period"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedPeriod === "custom" && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex h-11 sm:h-12 w-full sm:w-auto items-center justify-between gap-1.5 rounded-full border border-[#D7D7D7] bg-white px-3.5 shadow-2xs hover:border-[#1F1F1F] focus-within:border-[#1F1F1F]">
                  <span className="text-[11px] font-normal text-[#727272]">From:</span>
                  <input
                    type="date"
                    value={startDate || ""}
                    onChange={(e) => onCustomDateChange(e.target.value, endDate || "")}
                    className="bg-transparent text-xs sm:text-sm font-medium text-[#1F1F1F] focus:outline-none cursor-pointer"
                    aria-label="Custom start date"
                  />
                </div>
                <span className="text-xs text-[#727272] self-center">to</span>
                <div className="flex h-11 sm:h-12 w-full sm:w-auto items-center justify-between gap-1.5 rounded-full border border-[#D7D7D7] bg-white px-3.5 shadow-2xs hover:border-[#1F1F1F] focus-within:border-[#1F1F1F]">
                  <span className="text-[11px] font-normal text-[#727272]">To:</span>
                  <input
                    type="date"
                    value={endDate || ""}
                    onChange={(e) => onCustomDateChange(startDate || "", e.target.value)}
                    className="bg-transparent text-xs sm:text-sm font-medium text-[#1F1F1F] focus:outline-none cursor-pointer"
                    aria-label="Custom end date"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="inline-flex h-11 sm:h-12 items-center gap-2.5 rounded-full border border-[#EDEDED] bg-white px-4 py-2 text-xs font-medium text-[#727272] shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>12-Month Assessment Window</span>
          </div>
        )}
      </div>
    </div>
  );
}
