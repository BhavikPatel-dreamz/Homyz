"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import type { DemandForecastResult, ForecastHorizon } from "@/services/admin-analytics/forecasting/forecast-contracts";

interface ForecastTabProps {
  initialCurrency?: string;
}

export function ForecastTab({ initialCurrency = "SAR" }: ForecastTabProps) {
  const [horizon, setHorizon] = useState<ForecastHorizon>("30d");
  const [currency, setCurrency] = useState(initialCurrency);
  const [forecast, setForecast] = useState<DemandForecastResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchForecast = useCallback(async (h: ForecastHorizon, cur: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/analytics/forecast?horizon=${h}&currency=${cur}`);
      if (res.ok) {
        const json = await res.json();
        setForecast(json.data ?? json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast(horizon, currency);
  }, [fetchForecast, horizon, currency]);

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. Header & Horizon Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AdminSectionHeader
            title="Predictive Demand & Revenue Forecasting"
            subtitle="Forward-looking reservation pace, pickup curves, and statistical capacity modeling"
            className="mb-0"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as ForecastHorizon[]).map((h) => (
            <button
              key={h}
              onClick={() => {
                setHorizon(h);
                fetchForecast(h, currency);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                horizon === h
                  ? "bg-foreground text-background shadow-xs"
                  : "border border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:text-foreground"
              }`}
            >
              Next {h === "7d" ? "7 Days" : h === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading && !forecast ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          Calculating statistical booking pickup curves and demand projections...
        </div>
      ) : forecast ? (
        <div className="flex flex-col gap-6">
          {/* 2. Top-line Forecast KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Projected Total GMV</span>
              <div className="text-lg sm:text-xl font-medium text-foreground mt-1">
                {currency} {Math.round(forecast.summary.totalExpectedGmvCents / 100).toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-700 font-medium mt-1 inline-block">
                Confirmed: {currency} {Math.round(forecast.summary.confirmedFutureGmvCents / 100).toLocaleString()}
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Projected Occupancy Rate</span>
              <div className="text-lg sm:text-xl font-medium text-foreground mt-1">
                {forecast.summary.projectedOccupancyPercentage}%
              </div>
              <span className="text-[11px] text-muted-foreground font-normal mt-1 inline-block">
                {forecast.summary.totalExpectedNights} expected room nights
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Expected Platform Margin</span>
              <div className="text-lg sm:text-xl font-medium text-foreground mt-1">
                {currency} {Math.round(forecast.summary.expectedPlatformCommissionCents / 100).toLocaleString()}
              </div>
              <span className="text-[11px] text-muted-foreground font-normal mt-1 inline-block">
                3.0% platform fee basis
              </span>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs text-muted-foreground font-normal">Current Booking Pace</span>
              <div className="flex items-center gap-2 mt-1">
                <AdminStatusBadge variant={forecast.summary.currentBookingPaceStatus === "AHEAD_OF_PACE" ? "success" : "neutral"}>
                  {forecast.summary.currentBookingPaceStatus === "AHEAD_OF_PACE" ? "Ahead of Pace" : "On Pace"}
                </AdminStatusBadge>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium mt-1 inline-block">
                +{forecast.summary.paceVariancePercentage}% vs historical pickup
              </span>
            </div>
          </div>

          {/* 3. Daily Forecast Timeline Table */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-foreground block">
                  Daily Demand Projection & Confidence Interval (Next {horizon})
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Solid lines represent confirmed future stays; dashed bounds indicate 80% prediction interval
                </span>
              </div>
              <AdminStatusBadge variant="info">Model: {forecast.modelVersion}</AdminStatusBadge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-secondary)] text-muted-foreground border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium text-right">Confirmed GMV</th>
                    <th className="px-4 py-3 font-medium text-right">Expected Pickup</th>
                    <th className="px-4 py-3 font-medium text-right">Projected Total</th>
                    <th className="px-4 py-3 font-medium text-right">Expected Occupancy</th>
                    <th className="px-4 py-3 font-medium text-right">80% Bound [Min – Max]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-foreground">
                  {forecast.dailyProjections.slice(0, 15).map((d) => (
                    <tr key={d.dateKey} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{d.dayLabel}</td>
                      <td className="px-4 py-3 text-right">
                        {currency} {Math.round(d.confirmedGmvCents / 100).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        +{currency} {Math.round(d.projectedAdditionalGmvCents / 100).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {currency} {Math.round(d.totalExpectedGmvCents / 100).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {d.projectedOccupancyPercentage}%
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-muted-foreground">
                        {Math.round(d.lowerBoundGmvCents / 100).toLocaleString()} – {Math.round(d.upperBoundGmvCents / 100).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Booking Pickup Lead-Time Curves */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
              <span className="text-xs font-medium text-foreground block mb-1">
                Booking Lead-Time Distribution (Pickup Curve)
              </span>
              <p className="text-xs text-muted-foreground mb-4">
                Reveals when guests commit reservations relative to arrival date in the Saudi market.
              </p>
              <div className="flex flex-col gap-3">
                {forecast.paceDistribution.map((pace) => (
                  <div key={pace.leadTimeDaysBucket} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium">{pace.leadTimeDaysBucket}</span>
                      <span className="text-muted-foreground">
                        {pace.currentCycleSharePercentage}% (Historical: {pace.historicalSharePercentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full"
                        style={{ width: `${pace.currentCycleSharePercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Statistical Validation & Backtesting */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-medium text-foreground block mb-1">
                  Historical Model Backtesting & Accuracy Audit
                </span>
                <p className="text-xs text-muted-foreground mb-4">
                  Rolling historical validation across {forecast.validation.backtestedPeriodsCount} past days.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                    <span className="text-[11px] text-muted-foreground block font-normal">WAPE Accuracy Error</span>
                    <span className="text-sm font-medium text-foreground mt-0.5 block">
                      {forecast.validation.weightedAbsolutePercentageError}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                    <span className="text-[11px] text-muted-foreground block font-normal">Prediction Interval Coverage</span>
                    <span className="text-sm font-medium text-emerald-700 mt-0.5 block">
                      {forecast.validation.predictionIntervalCoveragePercentage}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                    <span className="text-[11px] text-muted-foreground block font-normal">Mean Forecast Bias</span>
                    <span className="text-sm font-medium text-foreground mt-0.5 block">
                      {forecast.validation.meanForecastBiasPercentage > 0 ? "+" : ""}
                      {forecast.validation.meanForecastBiasPercentage}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                    <span className="text-[11px] text-muted-foreground block font-normal">Advantage vs Naive Baseline</span>
                    <span className="text-sm font-medium text-emerald-700 mt-0.5 block">
                      +{forecast.validation.baselineComparisonAdvantagePercentage}% rel
                      {forecast.validation.absolutePercentagePointAdvantage !== undefined ? (
                        <span className="text-xs text-emerald-600/80 font-normal ml-1">
                          ({forecast.validation.absolutePercentagePointAdvantage} pp)
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground pt-3 border-t border-[var(--border)]">
                Status: <span className="font-medium text-foreground">{forecast.reliabilityStatus}</span> • Data coverage: {forecast.dataCoveragePercentage}%
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

