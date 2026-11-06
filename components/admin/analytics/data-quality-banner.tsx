"use client";

import React, { useState } from "react";
import type { DataQualityWarning } from "@/services/admin-analytics/analytics-contracts";
import { getWarningIdentifier } from "@/services/admin-analytics/warning-normalization";

interface DataQualityBannerProps {
  warnings: DataQualityWarning[];
  className?: string;
}

const METRIC_LABELS: Record<string, string> = {
  bookable_nights: "Bookable Nights",
  occupancy_rate: "Occupancy Rate",
  revpar: "RevPAR",
  platform_commission: "Platform Commission",
  net_host_payouts: "Net Host Payouts",
  gross_booking_value: "Gross Booking Value",
};

export function DataQualityBanner({ warnings, className = "" }: DataQualityBannerProps) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  if (!warnings || warnings.length === 0) return null;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div
      className={`w-full flex flex-col gap-2.5 font-sans ${className}`}
      role="region"
      aria-label="Data quality and historical notices"
    >
      {warnings.map((w) => {
        const id = getWarningIdentifier(w);
        const isExpanded = !!expandedIds[id];
        const hasMetrics = Array.isArray(w.affectedMetrics) && w.affectedMetrics.length > 0;
        const isHistoricalNotice = w.code === "HISTORICAL_AVAILABILITY_ESTIMATED";

        const primaryText = isHistoricalNotice
          ? "Historical availability data may be incomplete. Some occupancy metrics are estimated."
          : w.message;

        return (
          <div
            key={id}
            className="w-full rounded-xl border border-amber-200/90 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/20 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs text-amber-900 dark:text-amber-200 transition-all shadow-2xs"
          >
            {/* Primary Compact Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-h-[44px] sm:min-h-[48px]">
              {/* Left Side: Icon + Title + Primary Text */}
              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                <div className="size-6 rounded-lg bg-amber-100/90 dark:bg-amber-900/40 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <svg
                    className="size-3.5 text-amber-600 dark:text-amber-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0 leading-relaxed sm:leading-normal">
                  <span className="font-medium text-amber-950 dark:text-amber-100 text-[13px] shrink-0">
                    Marketplace Notice:
                  </span>
                  <span className="font-normal text-amber-900/90 dark:text-amber-200/90 text-xs sm:text-[13px]">
                    {primaryText}
                  </span>
                </div>
              </div>

              {/* Right Side: View / Hide details Button */}
              <div className="flex items-center shrink-0 self-end sm:self-center pl-8.5 sm:pl-0">
                <button
                  type="button"
                  onClick={() => toggleExpanded(id)}
                  aria-expanded={isExpanded}
                  aria-controls={`warning-details-${id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-white/85 hover:bg-white dark:bg-amber-900/40 dark:border-amber-700/60 dark:hover:bg-amber-900/60 px-2.5 py-1 text-xs font-medium text-amber-900 dark:text-amber-200 transition-colors cursor-pointer"
                >
                  <span>{isExpanded ? "Hide details" : "View details"}</span>
                  <svg
                    className={`size-3 text-amber-700 dark:text-amber-300 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expandable Details Section */}
            {isExpanded && (
              <div
                id={`warning-details-${id}`}
                className="mt-2.5 pt-3 border-t border-amber-200/70 dark:border-amber-800/40 flex flex-col gap-3 text-xs text-amber-900/90 dark:text-amber-200/90"
              >
                {/* Context & Limitations Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-amber-950 dark:text-amber-100 text-[11px] uppercase tracking-wider">
                      Why metrics are estimated
                    </span>
                    <p className="font-normal text-amber-900/90 dark:text-amber-200/80 leading-relaxed text-[12px]">
                      {isHistoricalNotice
                        ? "Previous calendar blocks were not recorded in earlier system versions. As a result, historical bookable inventory is reconstructed using listing creation dates and current block rules."
                        : w.message}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-amber-950 dark:text-amber-100 text-[11px] uppercase tracking-wider">
                      Historical record limitations
                    </span>
                    <p className="font-normal text-amber-900/90 dark:text-amber-200/80 leading-relaxed text-[12px]">
                      {isHistoricalNotice
                        ? "Past manual unblocks, temporary owner blocks, and cancelled hold periods cannot be fully reconstructed. Figures for earlier historical periods may differ slightly from actual past availability."
                        : "Data quality indicators apply to the selected timeframe. Metrics may adjust as additional operational records are processed."}
                    </p>
                  </div>
                </div>

                {/* Affected Metrics (Badges only shown when expanded and metrics exist) */}
                {hasMetrics && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-200/40 dark:border-amber-800/20">
                    <span className="font-medium text-amber-950 dark:text-amber-100 text-xs mr-1">
                      Affected metrics:
                    </span>
                    {w.affectedMetrics.map((metric) => (
                      <span
                        key={metric}
                        className="inline-flex items-center rounded-md bg-amber-100/90 dark:bg-amber-900/50 border border-amber-300/70 dark:border-amber-700/50 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-200 shadow-2xs"
                      >
                        {METRIC_LABELS[metric] || metric.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
