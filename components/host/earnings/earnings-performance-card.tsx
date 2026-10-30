"use client";

import React, { useMemo } from "react";
import { EarningsInteractiveChart } from "@/components/host/reporting/earnings-interactive-chart";
import type { HostEarningsReportingData } from "@/services/payout.service";

interface EarningsPerformanceCardProps {
  reporting: HostEarningsReportingData;
  currency: string;
  selectedPointIndex: number | null;
  onSelectPoint: (index: number | null) => void;
}

type BreakdownItem = { label: string; amount: number; percentage: number; color: string };

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);

function BreakdownCard({
  title,
  caption,
  items,
  currency,
}: {
  title: string;
  caption: string;
  items: BreakdownItem[];
  currency: string;
}) {
  const visibleItems = items.filter((item) => item.amount > 0);

  if (!visibleItems.length) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-medium text-[#1f1f1f]">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-[#727272]">No data for this reporting period.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-medium text-[#1f1f1f]">{title}</h3>
      <p className="mt-1 text-xs text-[#727272]">{caption}</p>
      <div className="mt-4 space-y-3">
        {visibleItems.map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-[#515151]">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 font-medium text-[#1f1f1f]" title={formatCurrency(item.amount, currency)}>
                {formatCurrency(item.amount, currency)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Presentation-only panel: it never creates substitute benchmark data. */
export function EarningsPerformanceCard({
  reporting,
  currency,
  selectedPointIndex,
  onSelectPoint,
}: EarningsPerformanceCardProps) {
  const points = reporting.chart.points || [];
  const sourceItems = useMemo<BreakdownItem[]>(() => {
    const source = reporting.sourceBreakdown;
    if (!source || source.total <= 0) return [];
    return [
      { label: "Accommodation", amount: source.bookings, percentage: source.bookingsPercentage, color: "#C99324" },
      { label: "Cleaning fees", amount: source.cleaningFees, percentage: source.cleaningPercentage, color: "#F5D061" },
      { label: "Service fees", amount: source.serviceFees, percentage: source.servicePercentage, color: "#94A3B8" },
      { label: "Other", amount: source.other, percentage: source.otherPercentage, color: "#52525B" },
    ];
  }, [reporting.sourceBreakdown]);
  const listingItems = useMemo<BreakdownItem[]>(
    () => (reporting.listingTypeBreakdown || []).map((item) => ({
      label: item.type,
      amount: item.amount,
      percentage: item.percentage,
      color: item.color || "#C99324",
    })),
    [reporting.listingTypeBreakdown],
  );
  const payoutItems = useMemo<BreakdownItem[]>(
    () => (reporting.payoutStatusBreakdown || []).map((item) => ({
      label: item.label,
      amount: item.amount,
      percentage: item.percentage,
      color: item.color || "#C99324",
    })),
    [reporting.payoutStatusBreakdown],
  );

  return (
    <section className="space-y-4" aria-labelledby="earnings-performance-heading">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:rounded-3xl sm:p-6 lg:p-7">
        <div className="flex flex-col gap-1 border-b border-zinc-100 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h2 id="earnings-performance-heading" className="text-lg font-medium tracking-tight text-[#1f1f1f] sm:text-xl">
              Earnings performance
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#727272] sm:text-sm">
              Completed-stay earnings across {reporting.timeframeLabel || reporting.monthLabel}.
            </p>
          </div>
          {reporting.totalsByCurrency.length > 1 && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs text-[#515151]">
              Reporting in {currency}
            </span>
          )}
        </div>
        <div className="mt-4 min-w-0">
          <EarningsInteractiveChart
            points={points}
            currency={currency}
            timeframeLabel={reporting.timeframeLabel || reporting.monthLabel}
            comparisonLabel={reporting.comparison?.periodLabel}
            selectedPointIndex={selectedPointIndex}
            onSelectPoint={onSelectPoint}
            selectedListingId={reporting.selectedListingId}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownCard title="Earnings by source" caption="What made up recognized revenue" items={sourceItems} currency={currency} />
        <BreakdownCard title="Listing type" caption="Which property types contributed" items={listingItems} currency={currency} />
        <BreakdownCard title="Payout status" caption="Status of recognized earnings" items={payoutItems} currency={currency} />
      </div>
    </section>
  );
}
