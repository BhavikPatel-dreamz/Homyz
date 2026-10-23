"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { HostInsightsData } from "@/services/host-insights.service";

interface InsightsStatsTabProps {
  data: HostInsightsData["stats"];
  periodLabel: string;
  reviews: HostInsightsData["reviews"];
  opportunities: HostInsightsData["opportunities"];
}

const formatCurrency = (cents: number | null, currency = "SAR") => cents === null
  ? "—"
  : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export function InsightsStatsTab({ data, periodLabel }: InsightsStatsTabProps) {
  const { performance, quality, quickStats, chartComparison, earnings } = data;
  const searchParams = useSearchParams();
  const withFilters = (href: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  };
  const reviewsHref = withFilters("/host/insights?tab=reviews");
  const viewsTelemetry = { value: "Unavailable", badge: "Not tracked" };
  const quickStatsCards = [
    { label: "Overall rating", value: quickStats.overallRating === null ? "—" : `${quickStats.overallRating.toFixed(2)} ★`, detail: quickStats.totalReviewsCount ? "Eligible published guest rating" : "No eligible reviews yet", href: reviewsHref },
    { label: "Total reviews", value: `${quickStats.totalReviewsCount}`, detail: "Eligible published guest reviews", href: reviewsHref },
    { label: "Response rate", value: quickStats.responseRatePercentage === null ? "—" : `${quickStats.responseRatePercentage}%`, detail: quickStats.responseRatePercentage === null ? "No qualifying inquiries for this period" : `${quickStats.responseInquiryCount} qualifying inquiries`, href: "/host/insights/stats/response-rate" },
    { label: "Net earnings", value: formatCurrency(earnings.netEarningsCents, performance.currency), detail: `Realized in ${periodLabel}`, href: "/host/insights/stats/earnings" },
    { label: "Bookings", value: `${quickStats.confirmedBookingsCount}`, detail: `Confirmed stays starting in ${periodLabel}`, href: "/host/insights/stats/bookings" },
    { label: "Listing views", value: viewsTelemetry.value, detail: viewsTelemetry.badge, href: "/host/insights/stats/views" },
  ];
  const detailCards = [
    { title: "Occupancy rate", value: `${performance.occupancyRatePercentage}%`, detail: `${performance.bookedNights} booked of ${performance.totalBookableNights} bookable nights`, href: "/host/insights/stats/occupancy" },
    { title: "Average nightly rate", value: formatCurrency(performance.averageDailyRateCents, performance.currency), detail: `Net realized per booked night in ${periodLabel}`, href: "/host/insights/stats/rates" },
    { title: "Average booking value", value: formatCurrency(performance.averageBookingValueCents, performance.currency), detail: "Net payout per eligible completed stay", href: "/host/insights/stats/rates" },
    { title: "Average stay length", value: performance.completedStaysCount ? `${performance.averageStayNights} nights` : "—", detail: performance.completedStaysCount ? `${performance.completedStaysCount} completed stays in period` : "No completed stays in this period", href: "/host/insights/stats/stay-length" },
    { title: "Cancellation rate", value: `${quality.hostCancellationRatePercentage}%`, detail: `${quality.totalCancelledCount} cancellations across host records`, href: "/host/insights/stats/cancellations" },
    { title: "Response time", value: quality.averageResponseTimeMinutes === null ? "—" : quality.averageResponseTimeMinutes < 60 ? `${quality.averageResponseTimeMinutes} min` : `${Math.round(quality.averageResponseTimeMinutes / 60)} hr`, detail: quality.averageResponseTimeMinutes === null ? "No qualifying inquiries for this period" : "First response to guest inquiries", href: "/host/insights/stats/response-rate" },
  ];

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between gap-4 border-b border-[#E5E5E5] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Performance overview</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F1F1F]">Your hosting at a glance</h2>
          </div>
          <span className="hidden text-xs font-medium text-[#727272] sm:block">{periodLabel}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 divide-x divide-y divide-[#E5E5E5] border-b border-[#E5E5E5] sm:grid-cols-3 sm:divide-y-0">
          {quickStatsCards.map((card) => (
            <QuickStat key={card.label} {...card} href={withFilters(card.href)} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Performance charts</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F1F1F]">Current period compared with the last</h2>
            <p className="mt-1 text-xs text-[#727272]">Each chart uses the selected property and reporting period. Select a chart to open its detailed metric.</p>
          </div>
          <span className="text-xs font-medium text-[#727272]">{chartComparison.comparisonLabel}</span>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <ComparisonChart title="Occupancy" unit="%" current={chartComparison.occupancy.current} previous={chartComparison.occupancy.previous} detail={`${chartComparison.occupancy.bookedNights} booked · ${chartComparison.occupancy.availableNights} available nights`} href={withFilters("/host/insights/stats/occupancy")} />
          <ComparisonChart title="Bookings" current={chartComparison.bookings.current} previous={chartComparison.bookings.previous} detail={`${chartComparison.bookings.completedStays} completed · ${chartComparison.bookings.cancelledBookings} cancelled`} href={withFilters("/host/insights/stats/bookings")} />
          <ComparisonChart title="Net earnings" prefix={performance.currency} current={chartComparison.earnings.current / 100} previous={chartComparison.earnings.previous / 100} detail="Eligible completed stays; after platform fees" href={withFilters("/host/insights/stats/earnings")} />
        </div>
      </section>

      <section className="rounded-3xl bg-[#1F1F1F] p-6 text-white sm:p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#FCDF9C]">Dashboard Plus</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Advanced booking analytics</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">Explore observed occupancy, booking creation times, booking windows, stay length, and completed-stay realized rates.</p>
        <Link href={withFilters("/host/insights/stats/booking-analytics")} className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#1F1F1F] transition hover:bg-[#FCDF9C]">Open booking analytics →</Link>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 border-b border-[#E5E5E5] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Detailed metrics</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F1F1F]">Key hosting metrics</h2>
          </div>
          <Link href={withFilters("/host/insights/listing-performance")} className="text-xs font-semibold text-[#1F1F1F] underline underline-offset-4 hover:text-[#727272]">Listing performance →</Link>
        </div>
        <div className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {detailCards.map((card) => (
            <DetailMetric key={card.title} {...card} href={withFilters(card.href)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickStat({ label, value, detail, href, muted = false }: { label: string; value: string; detail: string; href: string; muted?: boolean }) {
  return (
    <Link href={href} className="group min-h-36 p-4 transition-colors hover:bg-[#F9F9F9] sm:p-5 rounded-2xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-[#727272]">{label}</p>
        <span className="text-[#A0A0A0] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1F1F1F]">›</span>
      </div>
      <p className={`mt-4 text-2xl font-bold tracking-tight sm:text-3xl ${muted ? "text-[#727272]" : "text-[#1F1F1F]"}`}>{value}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-[#727272]">{detail}</p>
    </Link>
  );
}

function ComparisonChart({ title, current, previous, detail, href, unit = "", prefix = "" }: { title: string; current: number; previous: number; detail: string; href: string; unit?: string; prefix?: string }) {
  const maximum = Math.max(current, previous, 1);
  const value = (amount: number) => prefix ? `${prefix} ${Math.round(amount).toLocaleString()}` : `${amount.toLocaleString()}${unit}`;
  return (
    <Link href={href} className="group rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm transition hover:border-[#1F1F1F]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1F1F1F]">{title}</h3>
        <span className="text-[#727272] transition-colors group-hover:text-[#1F1F1F]">→</span>
      </div>
      <div className="mt-6 flex h-32 items-end gap-4 border-b border-[#EDEDED] pb-2">
        <ChartBar label="Current" value={current} max={maximum} />
        <ChartBar label="Previous" value={previous} max={maximum} subtle />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <p className="text-xl font-bold text-[#1F1F1F]">{value(current)}</p>
        <p className="text-xs text-[#727272]">{value(previous)} previous</p>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#727272]">{detail}</p>
    </Link>
  );
}

function ChartBar({ label, value, max, subtle = false }: { label: string; value: number; max: number; subtle?: boolean }) {
  const height = Math.max(value > 0 ? 8 : 2, Math.round((Math.max(0, value) / max) * 100));
  return (
    <div className="flex flex-1 flex-col justify-end gap-2">
      <span className="text-center text-xs font-bold text-[#1F1F1F]">{Math.round(value).toLocaleString()}</span>
      <div title={`${label}: ${value}`} className={subtle ? "rounded-t-lg bg-[#E5E5E5]" : "rounded-t-lg bg-[#1F1F1F]"} style={{ height: `${height}%` }} />
      <span className="text-center text-[10px] text-[#727272]">{label}</span>
    </div>
  );
}

function DetailMetric({ title, value, detail, href }: { title: string; value: string; detail: string; href: string }) {
  return (
    <Link href={href} className="group border-b border-[#E5E5E5] py-4 transition hover:bg-[#F9F9F9] sm:px-3 rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1F1F1F]">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#1F1F1F]">{value}</p>
        </div>
        <span className="mt-2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">→</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#727272]">{detail}</p>
    </Link>
  );
}
