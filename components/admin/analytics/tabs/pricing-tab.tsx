"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import type {
  DailyPricingRecommendation,
  PricingRecommendationResult,
} from "@/services/pricing-intelligence/pricing-contracts";

interface PricingTabProps {
  initialCurrency?: string;
  listings?: Array<{ id: string; title: string; city: string | null }>;
}

export function PricingTab({ initialCurrency = "SAR", listings = [] }: PricingTabProps) {
  const [selectedListingId, setSelectedListingId] = useState<string>(listings[0]?.id || "");
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [result, setResult] = useState<PricingRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const fetchRecommendations = useCallback(async (listingId: string, days: number) => {
    if (!listingId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/admin/analytics/pricing?listingId=${listingId}&horizonDays=${days}`
      );
      if (res.ok) {
        const json = await res.json();
        setResult(json.data ?? json);
        setSelectedDates(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedListingId) {
      fetchRecommendations(selectedListingId, horizonDays);
    }
  }, [fetchRecommendations, selectedListingId, horizonDays]);

  // Handle single or batch acceptance
  const handleAcceptSelected = async (targetDates?: Array<{ dateKey: string; priceCents: number }>) => {
    if (!result) return;
    setIsApplying(true);

    const datesToApply =
      targetDates ||
      result.recommendations
        .filter((r) => selectedDates.has(r.dateKey) && !r.isBooked)
        .map((r) => ({ dateKey: r.dateKey, priceCents: r.recommendedPriceCents }));

    if (datesToApply.length === 0) {
      setIsApplying(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/admin/analytics/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ACCEPT",
          listingId: result.listingId,
          dates: datesToApply,
          reason: "Administrator accepted dynamic pricing recommendations",
        }),
      });

      if (res.ok) {
        setActionSuccessMessage(`Successfully applied pricing adjustments for ${datesToApply.length} date(s).`);
        setTimeout(() => setActionSuccessMessage(null), 4000);
        await fetchRecommendations(result.listingId, horizonDays);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const toggleSelectDate = (dateKey: string) => {
    const next = new Set(selectedDates);
    if (next.has(dateKey)) {
      next.delete(dateKey);
    } else {
      next.add(dateKey);
    }
    setSelectedDates(next);
  };

  const selectAllEligible = () => {
    if (!result) return;
    const eligible = result.recommendations.filter(
      (r) => !r.isBooked && r.recommendedPriceCents !== r.currentPriceCents
    );
    setSelectedDates(new Set(eligible.map((r) => r.dateKey)));
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* 1. Header & Property Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AdminSectionHeader
            title="Intelligent Dynamic Pricing Recommendations"
            subtitle="Market demand pacing, weekend surge factors, and constraint-guarded rate optimization"
            className="mb-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {listings.length > 0 && (
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground font-normal cursor-pointer"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.city || "KSA"})
                </option>
              ))}
            </select>
          )}

          <div className="inline-flex rounded-xl bg-[var(--surface-secondary)] p-1 border border-[var(--border)] text-xs">
            {[14, 30, 60].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setHorizonDays(days)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                  horizonDays === days
                    ? "bg-[var(--surface)] text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccessMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs font-normal text-emerald-900 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-normal cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {loading && !result ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          Evaluating booking lead times, Saudi weekend demand, and occupancy bounds...
        </div>
      ) : result ? (
        <div className="flex flex-col gap-6">
          {/* 2. Top-line Pricing KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Base Weekday Price</span>
              <div className="text-lg sm:text-xl font-medium text-foreground mt-1">
                {result.currency} {Math.round(result.basePriceCents / 100).toLocaleString()}
              </div>
              <span className="text-[11px] text-muted-foreground font-normal mt-1 inline-block">
                Listing reference rate
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Revenue Opportunity</span>
              <div className="text-lg sm:text-xl font-medium text-emerald-700 mt-1">
                +{result.currency}{" "}
                {Math.round(result.summary.potentialRevenueOpportunityCents / 100).toLocaleString()}
              </div>
              <span className="text-[11px] text-muted-foreground font-normal mt-1 inline-block">
                Across {result.summary.recommendedAdjustmentsCount} recommended dates
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Average Delta</span>
              <div className="text-lg sm:text-xl font-medium text-foreground mt-1">
                {result.summary.averageDeltaPercentage > 0 ? "+" : ""}
                {result.summary.averageDeltaPercentage}%
              </div>
              <span className="text-[11px] text-muted-foreground font-normal mt-1 inline-block">
                Bounded by +/-{result.constraintsSummary.maxDailyChangePercentage}% limit
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Confirmed Stays</span>
              <div className="text-lg sm:text-xl font-medium text-foreground mt-1">
                {result.summary.lockedBookedDatesCount} Locked
              </div>
              <span className="text-[11px] text-emerald-700 font-medium mt-1 inline-block">
                Existing reservations protected
              </span>
            </div>
          </div>

          {/* 3. Safety & Constraints Banner */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-4 text-xs font-normal text-muted-foreground leading-relaxed shadow-2xs">
            <div className="flex items-center gap-2 font-medium text-foreground mb-1">
              <svg className="size-4 text-[var(--accent)] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Multi-Layer Pricing Safeguards Active</span>
            </div>
            <p>
              Prices are strictly bounded by host floor (
              {result.constraintsSummary.hostFloorPriceCents
                ? `${result.currency} ${Math.round(result.constraintsSummary.hostFloorPriceCents / 100)}`
                : "None"}
              ), host ceiling (
              {result.constraintsSummary.hostCeilingPriceCents
                ? `${result.currency} ${Math.round(result.constraintsSummary.hostCeilingPriceCents / 100)}`
                : "None"}
              ), and maximum +/-{result.constraintsSummary.maxDailyChangePercentage}% daily change limits.
              Automatic price application is <span className="font-medium text-foreground">disabled by default</span>; changes take effect only upon host or admin review and confirmation. Confirmed reservations are permanently price-locked.
            </p>
          </div>

          {/* 4. Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllEligible}
                className="px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
              >
                Select All Recommended ({result.summary.recommendedAdjustmentsCount})
              </button>
              {selectedDates.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDates(new Set())}
                  className="px-2.5 py-1.5 text-xs font-normal text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear Selection ({selectedDates.size})
                </button>
              )}
            </div>

            {selectedDates.size > 0 && (
              <button
                type="button"
                onClick={() => handleAcceptSelected()}
                disabled={isApplying}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>{isApplying ? "Applying Changes..." : `Apply Changes to ${selectedDates.size} Date(s)`}</span>
              </button>
            )}
          </div>

          {/* 5. Recommendations Table */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-secondary)] text-muted-foreground border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Scheduled Price</th>
                    <th className="px-4 py-3 font-medium">Recommended</th>
                    <th className="px-4 py-3 font-medium">Variance</th>
                    <th className="px-4 py-3 font-medium">Demand Signal</th>
                    <th className="px-4 py-3 font-medium">Market Factor</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-foreground">
                  {result.recommendations.map((rec) => {
                    const isSelected = selectedDates.has(rec.dateKey);
                    const isAdjusted = rec.recommendedPriceCents !== rec.currentPriceCents;

                    return (
                      <tr
                        key={rec.dateKey}
                        className={`transition-colors ${
                          rec.isBooked
                            ? "bg-[var(--surface-secondary)]/30 opacity-75"
                            : isSelected
                              ? "bg-[var(--surface-secondary)]/60"
                              : "hover:bg-[var(--surface-secondary)]/40"
                        }`}
                      >
                        <td className="px-4 py-3">
                          {!rec.isBooked && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectDate(rec.dateKey)}
                              className="size-3.5 rounded-sm border-[var(--border)] text-[var(--accent)] focus:ring-0 cursor-pointer"
                            />
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{rec.dayLabel}</span>
                            {rec.isWeekend && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-medium">
                                Weekend
                              </span>
                            )}
                            {rec.hasManualOverride && (
                              <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 text-[10px] font-medium">
                                Override
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {result.currency} {Math.round(rec.currentPriceCents / 100).toLocaleString()}
                        </td>

                        <td className="px-4 py-3 font-medium">
                          {rec.isBooked ? (
                            <span className="text-muted-foreground italic">Booked & Locked</span>
                          ) : (
                            <span className={isAdjusted ? "text-foreground font-medium" : "text-muted-foreground"}>
                              {result.currency} {Math.round(rec.recommendedPriceCents / 100).toLocaleString()}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {rec.isBooked ? (
                            <span className="text-muted-foreground">—</span>
                          ) : rec.deltaPercentage > 0 ? (
                            <span className="text-emerald-700 font-medium">+{rec.deltaPercentage}%</span>
                          ) : rec.deltaPercentage < 0 ? (
                            <span className="text-rose-700 font-medium">{rec.deltaPercentage}%</span>
                          ) : (
                            <span className="text-muted-foreground">0%</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {rec.isBooked ? (
                            <AdminStatusBadge variant="neutral">RESERVED</AdminStatusBadge>
                          ) : (
                            <AdminStatusBadge
                              variant={
                                rec.demandSignal === "HIGH_DEMAND_WEEKEND" || rec.demandSignal === "PEAK_SEASONAL_SURGE"
                                  ? "success"
                                  : rec.demandSignal === "LOW_OCCUPANCY_STIMULATION" || rec.demandSignal === "LAST_MINUTE_UNSOLD"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {rec.demandSignal.replace(/_/g, " ")}
                            </AdminStatusBadge>
                          )}
                        </td>

                        <td className="px-4 py-3 text-[11px] text-muted-foreground max-w-xs truncate" title={rec.explanation}>
                          {rec.explanation}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {!rec.isBooked && isAdjusted && (
                            <button
                              type="button"
                              onClick={() =>
                                handleAcceptSelected([
                                  { dateKey: rec.dateKey, priceCents: rec.recommendedPriceCents },
                                ])
                              }
                              disabled={isApplying}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Apply
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

