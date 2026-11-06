"use client";

import React, { useState } from "react";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { AdminSectionHeader } from "@/components/admin/ui/admin-section-header";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AnalyticsAreaChart } from "../charts/analytics-area-chart";
import { AnalyticsDonutChart, type DonutSegment } from "../charts/analytics-donut-chart";
import type { RevenueAnalyticsData } from "@/services/admin-analytics/revenue.service";

interface RevenueTabProps {
  revenueData: RevenueAnalyticsData;
  timeframeLabel: string;
  comparisonLabel: string;
}

type CashFlowView = "captured" | "net" | "gmv" | "commission";

const fmtSAR = (cents: number | null | undefined) => {
  if (cents === null || cents === undefined) return "—";
  return `SAR ${Math.round(cents / 100).toLocaleString("en-US")}`;
};

const providerColors = ["#D97706", "#059669", "#0284C7", "#7C3AED", "#6B7280"];

export function RevenueTab({
  revenueData,
  timeframeLabel,
  comparisonLabel,
}: RevenueTabProps) {
  const [cashView, setCashView] = useState<CashFlowView>("captured");

  const { breakdown, dailyTrends, providerBreakdown, commissionRuleStats } = revenueData;

  // Chart series mapping
  const chartSeries = dailyTrends.map((d) => {
    let value = 0;
    if (cashView === "captured") value = Math.round(d.capturedCents / 100);
    else if (cashView === "net") value = Math.round(d.netCashCents / 100);
    else if (cashView === "gmv") value = Math.round(d.gmvCents / 100);
    else if (cashView === "commission") value = Math.round(d.commissionCents / 100);

    return {
      dateKey: d.dateKey,
      label: d.label,
      value,
    };
  });

  const chartColor =
    cashView === "captured"
      ? "emerald"
      : cashView === "net"
      ? "sky"
      : cashView === "gmv"
      ? "amber"
      : "violet";

  // Donut segments for payment providers
  const donutSegments: DonutSegment[] = providerBreakdown.map((p, idx) => ({
    id: p.provider,
    label: p.provider,
    value: Math.round(p.capturedCents / 100),
    color: providerColors[idx % providerColors.length],
  }));

  const totalCapturedSar = Math.round(breakdown.capturedPaymentVolumeCents.current / 100);

  return (
    <div className="flex flex-col gap-8 font-sans">
      {/* 1. Primary Financial KPIs (6 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <AdminStatCard
          label="Gross Booking Value"
          value={fmtSAR(breakdown.grossBookingValueCents.current)}
          delta={
            breakdown.grossBookingValueCents.percentageChange !== null
              ? { value: breakdown.grossBookingValueCents.percentageChange }
              : null
          }
          comparisonText={comparisonLabel}
          accentColor="amber"
        />
        <AdminStatCard
          label="Captured Gateway Cash"
          value={fmtSAR(breakdown.capturedPaymentVolumeCents.current)}
          delta={
            breakdown.capturedPaymentVolumeCents.percentageChange !== null
              ? { value: breakdown.capturedPaymentVolumeCents.percentageChange }
              : null
          }
          comparisonText="Gross receipts"
          accentColor="emerald"
        />
        <AdminStatCard
          label="Settled Refunds"
          value={fmtSAR(breakdown.refundedVolumeCents.current)}
          delta={
            breakdown.refundedVolumeCents.percentageChange !== null
              ? { value: breakdown.refundedVolumeCents.percentageChange, isExpense: true }
              : null
          }
          comparisonText="Returned to guests"
          accentColor={breakdown.refundedVolumeCents.current > 0 ? "rose" : "zinc"}
        />
        <AdminStatCard
          label="Net Collected Cash"
          value={fmtSAR(breakdown.netCollectedCashCents.current)}
          delta={
            breakdown.netCollectedCashCents.percentageChange !== null
              ? { value: breakdown.netCollectedCashCents.percentageChange }
              : null
          }
          comparisonText="Net bank inflows"
          accentColor="sky"
        />
        <AdminStatCard
          label="Platform Commission"
          value={fmtSAR(breakdown.platformCommissionCents.current)}
          delta={
            breakdown.platformCommissionCents.percentageChange !== null
              ? { value: breakdown.platformCommissionCents.percentageChange }
              : null
          }
          comparisonText="Homyz 3% margin"
          accentColor="emerald"
        />
        <AdminStatCard
          label="Host Earnings"
          value={fmtSAR(breakdown.hostEarningsCents.current)}
          delta={
            breakdown.hostEarningsCents.percentageChange !== null
              ? { value: breakdown.hostEarningsCents.percentageChange }
              : null
          }
          comparisonText="Net host allocation"
          accentColor="amber"
        />
      </div>

      {/* 2. Interactive Cash Flow Chart (65%) & Provider Distribution (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Cash Flow Chart (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-medium text-zinc-900 tracking-tight">
                Cash Flow &amp; Financial Velocity
              </h2>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Financial movement trends across {timeframeLabel.toLowerCase()}.
              </p>
            </div>

            {/* View Selector */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              {(
                [
                  { id: "captured", label: "Captured" },
                  { id: "net", label: "Net Cash" },
                  { id: "gmv", label: "GMV" },
                  { id: "commission", label: "Commission" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCashView(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    cashView === tab.id
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AnalyticsAreaChart
            data={chartSeries}
            height={260}
            color={chartColor}
            valueFormatter={(v) => `SAR ${v.toLocaleString()}`}
          />
        </div>

        {/* Right Side: Gateway Distribution Donut (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-2xs">
          <h2 className="text-base font-medium text-zinc-900 tracking-tight mb-1">
            Payment Gateway Share
          </h2>
          <p className="text-xs font-normal text-zinc-500 mb-6">
            Captured transaction volume segmented by payment processor.
          </p>

          <AnalyticsDonutChart
            segments={donutSegments}
            size={180}
            centerTitle={`SAR ${totalCapturedSar.toLocaleString()}`}
            centerSubtitle="Total Captured"
            valueFormatter={(v) => `SAR ${v.toLocaleString()}`}
          />
        </div>
      </div>

      {/* 3. Settlement Status & Reconciliation Balance Card */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-medium text-zinc-900 tracking-tight">
                Disbursement Settlement &amp; Reconciliation Balance
              </h2>
              <AdminStatusBadge
                label={breakdown.discrepanciesCount === 0 ? "Balanced" : "Review Flagged"}
                variant={breakdown.discrepanciesCount === 0 ? "success" : "warning"}
              />
            </div>
            <p className="text-xs font-normal text-zinc-500 mt-0.5">
              Cross-source settlement integrity: Net Collected Cash vs. Outflow Liabilities.
            </p>
          </div>

          {commissionRuleStats.fallbackEstimatedCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-800 border border-amber-200/60">
              <span>{commissionRuleStats.fallbackEstimatedCount} booking(s) used 3% standard fallback</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-100 text-xs">
          <div className="p-3 rounded-xl bg-zinc-50/60">
            <span className="font-normal text-zinc-500">Scheduled Payout Liability</span>
            <p className="text-base font-medium text-zinc-900 mt-1">
              {fmtSAR(breakdown.pendingSettlementsCents)}
            </p>
            <span className="text-[10px] text-zinc-400">Queued for next SARIE batch</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50/60">
            <span className="font-normal text-zinc-500">Held Distributions</span>
            <p className="text-base font-medium text-amber-600 mt-1">
              {fmtSAR(breakdown.heldPayoutsCents)}
            </p>
            <span className="text-[10px] text-zinc-400">Frozen due to active disputes</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50/60">
            <span className="font-normal text-zinc-500">Paid Bank Settlements</span>
            <p className="text-base font-medium text-emerald-600 mt-1">
              {fmtSAR(breakdown.paidSettlementsCents)}
            </p>
            <span className="text-[10px] text-zinc-400">Disbursed successfully</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50/60">
            <span className="font-normal text-zinc-500">Reconciliation Variance</span>
            <p className="text-base font-medium text-zinc-900 mt-1">
              {fmtSAR(breakdown.reconciliationBalanceCents)}
            </p>
            <span className="text-[10px] text-zinc-400">Cash vs. obligations balance</span>
          </div>
        </div>
      </div>

      {/* 4. Gateway Provider Performance Table */}
      <div className="flex flex-col gap-3">
        <AdminSectionHeader title="Gateway Processor Detail Ledger" />
        <div className="rounded-2xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-zinc-500 border-b border-zinc-200/60 font-medium">
              <tr>
                <th className="p-3.5">Gateway Provider</th>
                <th className="p-3.5">Successful Transactions</th>
                <th className="p-3.5">Captured Cash</th>
                <th className="p-3.5">Refunded Volume</th>
                <th className="p-3.5">Net Inflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-normal text-zinc-700">
              {providerBreakdown.map((p) => (
                <tr key={p.provider} className="hover:bg-zinc-50/40">
                  <td className="p-3.5 font-medium text-zinc-900">{p.provider}</td>
                  <td className="p-3.5">{p.transactionsCount.toLocaleString()}</td>
                  <td className="p-3.5">{fmtSAR(p.capturedCents)}</td>
                  <td className="p-3.5 text-rose-600">{fmtSAR(p.refundedCents)}</td>
                  <td className="p-3.5 font-medium text-zinc-900">{fmtSAR(p.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

