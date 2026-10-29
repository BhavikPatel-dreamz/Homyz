"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { HostInsightsData } from "@/services/host-insights.service";

interface InsightsStatsTabProps {
  data: HostInsightsData["stats"];
  entitlements: HostInsightsData["entitlements"];
  periodLabel: string;
  reviews: HostInsightsData["reviews"];
  opportunities: HostInsightsData["opportunities"];
}

const formatCurrency = (cents: number | null, currency = "SAR") =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

export function InsightsStatsTab({ data, entitlements, periodLabel }: InsightsStatsTabProps) {
  const { performance, quality, analyticsLimitations, quickStats, chartComparison, earnings } = data;
  const searchParams = useSearchParams();
  const withFilters = (href: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  };
  const reviewsHref = withFilters("/host/insights?tab=reviews");
  const viewsTelemetry =
    quickStats.listingViews === null
      ? { value: "—", detail: analyticsLimitations.pageViews.message }
      : {
          value: quickStats.listingViews.toLocaleString(),
          detail: analyticsLimitations.pageViews.trackingStartedAt
            ? `Observed since ${new Date(analyticsLimitations.pageViews.trackingStartedAt).toLocaleDateString()}`
            : "Observed listing traffic",
        };
  const quickStatsCards = [
    {
      label: "Occupancy",
      value: `${performance.occupancyRatePercentage}%`,
      detail: `${performance.bookedNights} booked of ${performance.totalBookableNights} bookable nights`,
      href: "/host/insights/stats/occupancy",
    },
    {
      label: "Bookings",
      value: `${quickStats.confirmedBookingsCount}`,
      detail: `Confirmed stays starting in ${periodLabel}`,
      href: "/host/insights/stats/bookings",
    },
    {
      label: "Average stay",
      value: performance.completedStaysCount ? `${performance.averageStayNights} nights` : "—",
      detail: performance.completedStaysCount
        ? `${performance.completedStaysCount} completed stays in period`
        : "No completed stays in this period",
      href: "/host/insights/stats/stay-length",
    },
    {
      label: "Response rate",
      value: quickStats.responseRatePercentage === null ? "—" : `${quickStats.responseRatePercentage}%`,
      detail:
        quickStats.responseRatePercentage === null
          ? "No qualifying inquiries for this period"
          : `${quickStats.responseInquiryCount} qualifying inquiries`,
      href: "/host/insights/stats/response-rate",
    },
    {
      label: "Listing views",
      value: viewsTelemetry.value,
      detail: viewsTelemetry.detail,
      href: "/host/insights/listing-performance",
    },
    {
      label: "Booking conversion",
      value:
        analyticsLimitations.conversionRate.percentage === null
          ? "—"
          : `${analyticsLimitations.conversionRate.percentage}%`,
      detail:
        analyticsLimitations.conversionRate.status === "ACTIVE"
          ? `${analyticsLimitations.conversionRate.attributedConfirmedBookings} attributed confirmed booking${
              analyticsLimitations.conversionRate.attributedConfirmedBookings === 1 ? "" : "s"
            } from ${analyticsLimitations.pageViews.count} listing view${
              analyticsLimitations.pageViews.count === 1 ? "" : "s"
            }`
          : analyticsLimitations.conversionRate.message,
      href: "/host/insights/listing-performance",
    },
  ];
  const detailCards = [
    {
      title: "Overall rating",
      value: quickStats.overallRating === null ? "—" : `${quickStats.overallRating.toFixed(2)} ★`,
      detail: quickStats.totalReviewsCount ? "Eligible published guest rating" : "No eligible reviews yet",
      href: reviewsHref,
    },
    {
      title: "Total reviews",
      value: `${quickStats.totalReviewsCount}`,
      detail: "Eligible published guest reviews",
      href: reviewsHref,
    },
    {
      title: "Net earnings",
      value: formatCurrency(earnings.netEarningsCents, performance.currency),
      detail: `Realized in ${periodLabel}`,
      href: "/host/insights/stats/earnings",
    },
    {
      title: "Average nightly rate",
      value: formatCurrency(performance.averageDailyRateCents, performance.currency),
      detail: `Net realized per booked night in ${periodLabel}`,
      href: "/host/insights/stats/rates",
    },
    {
      title: "Average booking value",
      value: formatCurrency(performance.averageBookingValueCents, performance.currency),
      detail: "Net payout per eligible completed stay",
      href: "/host/insights/stats/rates",
    },
    {
      title: "Host cancellation rate",
      value: `${quality.hostCancellationRatePercentage}%`,
      detail: `${quality.totalCancelledCount} host cancellations across all-time records`,
      href: "/host/insights/stats/cancellations",
    },
    {
      title: "Response time",
      value:
        quality.averageResponseTimeMinutes === null
          ? "—"
          : quality.averageResponseTimeMinutes < 60
            ? `${quality.averageResponseTimeMinutes} min`
            : `${Math.round(quality.averageResponseTimeMinutes / 60)} hr`,
      detail:
        quality.averageResponseTimeMinutes === null
          ? "No qualifying inquiries for this period"
          : "First response to guest inquiries",
      href: "/host/insights/stats/response-rate",
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ── Section 1: Performance Overview ── */}
      <section>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-[#E5E5E5] pb-4">
          <div>
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Performance overview</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">Your hosting at a glance</h2>
          </div>
          <span className="text-xs font-normal text-[#727272]">{periodLabel}</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickStatsCards.map((card) => (
            <QuickStat key={card.label} {...card} href={withFilters(card.href)} />
          ))}
        </div>
      </section>

      {/* ── Section 2: Performance Charts ── */}
      <section>
        <div className="flex flex-col gap-2 border-b border-[#E5E5E5] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Performance charts</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">Hosting Performance</h2>
            <p className="mt-1 text-xs text-[#727272]">
              Current period compared with the last. Select a chart to open its detailed metric.
            </p>
          </div>
          <div className="inline-flex self-start sm:self-auto items-center gap-1.5 rounded-full border border-[#EDEDED] bg-white px-3 py-1 text-xs font-medium text-[#727272] shadow-2xs">
            <span className="size-1.5 rounded-full bg-[#1F1F1F]" />
            <span>{chartComparison.comparisonLabel}</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ComparisonChart
            title="Occupancy"
            unit="%"
            current={chartComparison.occupancy.current}
            previous={chartComparison.occupancy.previous}
            detail={`${chartComparison.occupancy.bookedNights} booked · ${chartComparison.occupancy.availableNights} available nights`}
            href={withFilters("/host/insights/stats/occupancy")}
          />
          <ComparisonChart
            title="Bookings"
            current={chartComparison.bookings.current}
            previous={chartComparison.bookings.previous}
            detail={`${chartComparison.bookings.completedStays} completed · ${chartComparison.bookings.cancelledBookings} cancelled`}
            href={withFilters("/host/insights/stats/bookings")}
          />
          <ComparisonChart
            title="Net earnings"
            prefix={performance.currency}
            current={chartComparison.earnings.current / 100}
            previous={chartComparison.earnings.previous / 100}
            detail="Eligible completed stays; after platform fees"
            href={withFilters("/host/insights/stats/earnings")}
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>
      </section>

      {/* ── Section 3: Dashboard Plus Banner ── */}
      <section className="relative overflow-hidden rounded-3xl border border-white bg-[#F3F4F5] p-5 sm:p-8 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCDF9C] bg-[#FFF9EB] px-3 py-1 text-xs font-medium text-[#8F6A00]">
                <svg className="size-3 text-[#B88700] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" />
                </svg>
                <span className="truncate">
                  Dashboard Plus
                  {entitlements.hasDashboardPlus
                    ? ` · ${
                        entitlements.status === "ADMIN_GRANTED"
                          ? entitlements.expiresAt
                            ? "Complimentary (Temporary)"
                            : "Complimentary"
                          : entitlements.status === "TRIAL"
                            ? "Trial active"
                            : "Active"
                      }`
                    : ""}
                </span>
              </span>
            </div>
            <h2 className="mt-3 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">Advanced booking analytics</h2>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-normal leading-relaxed text-[#727272]">
              Explore observed occupancy, booking creation times, booking windows, stay length, and completed-stay realized rates.
            </p>
          </div>

          {entitlements.features.BOOKING_BEHAVIOR ? (
            <div className="shrink-0 pt-1 sm:pt-0 w-full sm:w-auto">
              <Link
                href={withFilters("/host/insights/stats/booking-analytics")}
                className="group inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-full bg-[#1F1F1F] px-5 py-2.5 text-xs font-medium text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
              >
                <span>Open booking analytics</span>
                <svg
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : null}
        </div>

        {!entitlements.features.BOOKING_BEHAVIOR && (
          <div className="mt-5 sm:mt-6 rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-5 shadow-2xs">
            <div className="flex items-start gap-3 sm:gap-3.5">
              <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E5] bg-[#F3F4F5] text-[#1F1F1F]">
                <svg
                  className="size-4 text-[#727272]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-[#1F1F1F]">Dashboard Plus feature</p>
                <p className="mt-1 text-xs font-normal leading-relaxed text-[#727272]">
                  Unlock advanced booking intelligence, lead-time distributions, booking pacing heatmaps, and multi-property portfolio comparisons. Contact support or an administrator to activate Dashboard Plus.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Section 4: Detailed Key Metrics ── */}
      <section>
        <div className="flex flex-col gap-2 border-b border-[#E5E5E5] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Detailed metrics</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">Key hosting metrics</h2>
          </div>
          <Link
            href={withFilters("/host/insights/listing-performance")}
            className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#1F1F1F] hover:text-[#727272] transition-colors self-start sm:self-auto"
          >
            <span className="underline underline-offset-4">View Listing Performance</span>
            <svg
              className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {detailCards.map((card) => (
            <DetailMetric key={card.title} {...card} href={withFilters(card.href)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickStat({
  label,
  value,
  detail,
  href,
  muted = false,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] p-4.5 sm:p-5 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm sm:text-base font-normal text-[#1f1f1f]">{label}</p>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1F1F1F] transition-all duration-300 group-hover:bg-[#1F1F1F] group-hover:text-white border border-[#FCDF9C] group-hover:border-[#1f1f1f]">
          <svg
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
      <div>
        <p className={`mt-3 sm:mt-4 text-2xl font-medium tracking-tight sm:text-3xl ${muted ? "text-[#727272]" : "text-[#1F1F1F]"}`}>
          {value}
        </p>
        <p className="mt-1 text-xs sm:text-sm font-normal leading-relaxed text-[#727272]">{detail}</p>
      </div>
    </Link>
  );
}

function ComparisonChart({
  title,
  current,
  previous,
  detail,
  href,
  unit = "",
  prefix = "",
  className = "",
}: {
  title: string;
  current: number;
  previous: number;
  detail: string;
  href: string;
  unit?: string;
  prefix?: string;
  className?: string;
}) {
  const maximum = Math.max(current, previous, 1);
  const value = (amount: number) =>
    prefix ? `${prefix} ${Math.round(amount).toLocaleString()}` : `${amount.toLocaleString()}${unit}`;
  const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-2xs transition-all duration-300 hover:border-[#1F1F1F] hover:shadow-xs ${className}`}
    >
      <div>
        {/* Top Header: Title + Action Arrow Button */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#727272]">{title}</h3>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1F1F1F] transition-all duration-300 group-hover:bg-[#1F1F1F] group-hover:text-white border border-[#FCDF9C] group-hover:border-[#1f1f1f]">
            <svg
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </div>

        {/* Primary KPI & Growth Indicator */}
        <div className="mt-3">
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-2.5">
            <span className="text-2xl min-[400px]:text-3xl min-[1024px]:text-2xl min-[1180px]:text-3xl xl:text-4xl font-medium tracking-tight text-[#1F1F1F]">
              {value(current)}
            </span>
            {deltaPct !== null ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  deltaPct >= 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                <svg
                  className="size-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {deltaPct >= 0 ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
                </svg>
                <span>{Math.abs(deltaPct)}%</span>
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-full border border-[#EDEDED] bg-[#F3F4F5] px-2.5 py-0.5 text-xs font-medium text-[#727272]">
                Baseline
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-normal text-[#727272]">
            vs. {value(previous)} prior period
          </p>
        </div>

        {/* Comparative Progress Breakdown */}
        <div className="mt-4 sm:mt-5 space-y-3 rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3 sm:p-3.5">
          {/* Current Period */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-normal text-[#1F1F1F]">Current</span>
              <span className="font-mono font-medium text-[#1F1F1F]">{value(current)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EDEDED]">
              <div
                className="h-full rounded-full bg-[#FCDF9C] transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(current > 0 ? 6 : 0, Math.round((current / maximum) * 100)))}%`,
                }}
              />
            </div>
          </div>

          {/* Prior Period */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-normal text-[#727272]">Prior</span>
              <span className="font-mono font-medium text-[#727272]">{value(previous)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EDEDED]">
              <div
                className="h-full rounded-full bg-[#B0B0B0] transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(previous > 0 ? 6 : 0, Math.round((previous / maximum) * 100)))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="mt-4 sm:mt-5 flex items-center justify-between border-t border-[#EDEDED] pt-3 text-xs sm:text-sm font-normal text-[#727272]">
        <span className="truncate pr-2" title={detail}>{detail}</span>
        <span className="shrink-0 font-medium text-[#1F1F1F] underline underline-offset-3">
          View details
        </span>
      </div>
    </Link>
  );
}

function DetailMetric({
  title,
  value,
  detail,
  href,
}: {
  title: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] p-4.5 sm:p-5 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-normal text-[#1f1f1f] truncate">{title}</p>
          <p className="mt-3 sm:mt-4 text-xl min-[400px]:text-2xl font-medium tracking-tight text-[#1F1F1F]">{value}</p>
        </div>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FCDF9C] text-[#1F1F1F] transition-all duration-300 group-hover:bg-[#1F1F1F] group-hover:text-white border border-[#FCDF9C] group-hover:border-[#1f1f1f]">
          <svg
            className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
      <p className="mt-1.5 text-xs sm:text-sm font-normal leading-relaxed text-[#727272]">{detail}</p>
    </Link>
  );
}
