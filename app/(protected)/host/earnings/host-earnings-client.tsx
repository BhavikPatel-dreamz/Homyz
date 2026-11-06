"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { PropertySelector } from "@/components/host/reporting/property-selector";
import { DatePeriodPicker, type DatePeriodPickerState } from "@/components/host/reporting/date-period-picker";
import { PeriodComparisonModal, type ComparisonPeriodConfig } from "@/components/host/reporting/period-comparison-modal";
import { EarningsPerformanceCard } from "@/components/host/earnings/earnings-performance-card";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import type { HostDashboardEntitlements } from "@/lib/entitlements/host-dashboard";
import { ChevronRightIcon } from "@/components/host/account-settings/icons";
import type {
  HostEarningsDetails,
  HostEarningsPayoutPreview,
  HostPayoutMethod,
} from "@/services/payout.service";

interface HostEarningsClientProps {
  initialData: HostEarningsDetails;
  entitlements: HostDashboardEntitlements;
}

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);

const dtFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const fmtDate = (value?: string | null) =>
  value && !Number.isNaN(new Date(value).getTime())
    ? dtFmt.format(new Date(value))
    : "Date pending";

const payoutStatusLabel = (value: string) =>
  ({
    SCHEDULED: "Scheduled",
    ELIGIBLE_SETTLEMENT: "Ready",
    PROCESSING: "Processing",
    PAID: "Paid",
  })[value] ?? value.replaceAll("_", " ");

const payoutStatusStyle = (value: string) =>
  value === "PAID"
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : value === "PROCESSING"
      ? "bg-violet-50 text-violet-700 border border-violet-200"
      : "bg-sky-50 text-sky-700 border border-sky-200";

export function HostEarningsClient({ initialData, entitlements }: HostEarningsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [showYtd, setShowYtd] = useState(false);
  const [payout, setPayout] = useState<HostEarningsPayoutPreview | null>(null);
  const [showMethods, setShowMethods] = useState(false);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [methodLoading, setMethodLoading] = useState(false);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [methodForm, setMethodForm] = useState({
    accountHolderName: "",
    bankName: "",
    iban: "",
    isDefault: false,
  });
  const [showCompareModal, setShowCompareModal] = useState(false);
  const overviewRequest = useRef(0);
  const { currency: globalDisplayCurrency } = useCurrency();
  const prevGlobalCurrency = useRef(globalDisplayCurrency);
  const reporting = data.reporting;
  const query = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );

  const activeTimeframe: TimeframeGranularity =
    (query.get("timeframe") as TimeframeGranularity) || reporting?.timeframe || "monthly";

  const handlePeriodChange = (next: DatePeriodPickerState) => {
    const presetComparison = query.get("comparePreset");
    update({
      timeframe: next.timeframe,
      date: next.date || null,
      weekStart: next.weekStart || null,
      month: next.month ? String(next.month) : null,
      year: next.year ? String(next.year) : null,
      quarter: next.quarter ? String(next.quarter) : null,
      startDate: next.startDate || null,
      endDate: next.endDate || null,
      ...(presetComparison ? { compareStartDate: null, compareEndDate: null } : {}),
    });
  };

  const handleApplyComparison = (config: ComparisonPeriodConfig | null) => {
    if (!config || !config.enabled) {
      update({
        compare: null,
        compareTimeframe: null,
        compareStartDate: null,
        compareEndDate: null,
        compareMonth: null,
        compareYear: null,
        compareQuarter: null,
        comparePreset: null,
      });
    } else {
      update({
        compare: "true",
        compareTimeframe: config.timeframe,
        compareStartDate: config.startDate,
        compareEndDate: config.endDate,
        compareMonth: null,
        compareYear: null,
        compareQuarter: null,
        comparePreset: config.preset === "prior_period" || config.preset === "prior_year" ? config.preset : null,
      });
    }
  };

  const scopedHref = (path: string) => {
    const scope = new URLSearchParams();
    const propertyId = query.get("propertyId") || query.get("listingId");
    const currency = query.get("currency");
    const year = query.get("year");
    const month = query.get("month");
    const timeframe = query.get("timeframe");
    const date = query.get("date");
    const startDate = query.get("startDate");
    const endDate = query.get("endDate");
    if (propertyId) scope.set("propertyId", propertyId);
    if (currency) scope.set("currency", currency);
    if (year) scope.set("year", year);
    if (month) scope.set("month", month);
    if (timeframe) scope.set("timeframe", timeframe);
    if (date) scope.set("date", date);
    if (startDate) scope.set("startDate", startDate);
    if (endDate) scope.set("endDate", endDate);
    [
      "weekStart",
      "quarter",
      "compare",
      "compareTimeframe",
      "compareStartDate",
      "compareEndDate",
      "compareMonth",
      "compareYear",
      "compareQuarter",
      "comparePreset",
    ].forEach((key) => {
      const value = query.get(key);
      if (value) scope.set(key, value);
    });
    const suffix = scope.toString();
    return `${path}${suffix ? `?${suffix}` : ""}`;
  };

  const selectedTotals =
    reporting?.totalsByCurrency.find(
      (item) => item.currency === reporting.selectedCurrency,
    ) || reporting?.totalsByCurrency[0];

  const chartPoints = useMemo(() => {
    if (reporting?.chart?.points && reporting.chart.points.length > 0) {
      return reporting.chart.points;
    }
    return (reporting?.chart?.daily || []).map((d) => ({
      key: d.key,
      label: d.label,
      fullLabel: d.key,
      startDateKey: d.key,
      endDateKey: d.key,
      amount: d.amount,
      netEarnings: d.amount,
      grossEarnings: d.amount,
      platformFee: 0,
      refunds: 0,
      adjustments: 0,
      completedStaysCount: d.amount > 0 ? 1 : 0,
      propertyBreakdown: [],
    }));
  }, [reporting?.chart?.points, reporting?.chart?.daily]);

  const periodFinancials = useMemo(
    () => chartPoints.reduce(
      (totals, point) => ({
        gross: totals.gross + point.grossEarnings,
        fees: totals.fees + point.platformFee,
        refunds: totals.refunds + point.refunds,
        adjustments: totals.adjustments + point.adjustments,
      }),
      { gross: 0, fees: 0, refunds: 0, adjustments: 0 },
    ),
    [chartPoints],
  );

  const load = useCallback(
    async (params: URLSearchParams) => {
      const requestId = ++overviewRequest.current;
      setIsLoadingOverview(true);
      setError(null);
      setSelectedPoint(null);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      try {
        const response = await fetch(
          `/api/v1/host/earnings?${params.toString()}`,
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload?.error?.message || "We couldn't load earnings right now.",
          );
        if (requestId === overviewRequest.current)
          setData(payload.data || payload);
      } catch (cause) {
        if (requestId === overviewRequest.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "We couldn't load earnings right now.",
          );
      } finally {
        if (requestId === overviewRequest.current) setIsLoadingOverview(false);
      }
    },
    [pathname, router],
  );

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(query);
      Object.entries(changes).forEach(([key, value]) =>
        value ? next.set(key, value) : next.delete(key),
      );
      void load(next);
    },
    [load, query],
  );

  // Real-time synchronization: when the user changes main currency in the global "Languages & currency" modal
  useEffect(() => {
    if (globalDisplayCurrency && prevGlobalCurrency.current !== globalDisplayCurrency) {
      prevGlobalCurrency.current = globalDisplayCurrency;
      const next = new URLSearchParams(query);
      next.set("currency", globalDisplayCurrency);
      void load(next);
    }
  }, [globalDisplayCurrency, load, query]);

  const reload = async () => {
    const response = await fetch(`/api/v1/host/earnings?${query.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error("Unable to refresh payout methods.");
    setData(payload.data || payload);
  };

  const saveMethod = async (event: React.FormEvent) => {
    event.preventDefault();
    setMethodLoading(true);
    setMethodError(null);
    try {
      const response = await fetch("/api/v1/host/payout-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(methodForm),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload?.error?.message || "Unable to add payout method.",
        );
      setShowAddMethod(false);
      setMethodForm({
        accountHolderName: "",
        bankName: "",
        iban: "",
        isDefault: false,
      });
      await reload();
    } catch (cause) {
      setMethodError(
        cause instanceof Error ? cause.message : "Unable to add payout method.",
      );
    } finally {
      setMethodLoading(false);
    }
  };

  const changeMethod = async (id: string, action: "default" | "delete") => {
    if (action === "delete" && !window.confirm("Remove this payout method?"))
      return;
    setMethodLoading(true);
    setMethodError(null);
    try {
      const response = await fetch(
        action === "default"
          ? `/api/v1/host/payout-methods/${id}/default`
          : `/api/v1/host/payout-methods/${id}`,
        { method: action === "default" ? "PUT" : "DELETE" },
      );
      if (!response.ok) throw new Error("Unable to update payout method.");
      await reload();
    } catch (cause) {
      setMethodError(
        cause instanceof Error
          ? cause.message
          : "Unable to update payout method.",
      );
    } finally {
      setMethodLoading(false);
    }
  };

  if (!reporting)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
        Earnings reporting is unavailable. Please refresh and try again.
      </div>
    );

  return (
    <div className="space-y-6 sm:space-y-7 pb-12 w-full min-w-0">
      {/* ── Section A: Header & Compact Unified Toolbar ── */}
      <header className="space-y-4">
        {/* Compact Unified Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            {/* Left: Searchable Property Selector */}
            <div className="w-full sm:w-auto">
              <PropertySelector
                listings={reporting.listings}
                selectedListingId={reporting.selectedListingId}
                onSelect={(id) => update({ propertyId: id })}
                className="w-full sm:w-auto"
                align="left"
              />
            </div>

            {/* Center: Reporting Period / Date Range Picker */}
            <div className="w-full sm:w-auto">
              <DatePeriodPicker
                value={{
                  timeframe: activeTimeframe,
                  date: query.get("date") || undefined,
                  weekStart: query.get("weekStart") || undefined,
                  month: Number(query.get("month")) || reporting.selectedMonth,
                  year: Number(query.get("year")) || reporting.selectedYear,
                  quarter: Number(query.get("quarter")) || undefined,
                  startDate: query.get("startDate") || undefined,
                  endDate: query.get("endDate") || undefined,
                }}
                onChange={handlePeriodChange}
                displayLabel={reporting.timeframeLabel || reporting.monthLabel}
                className="w-full sm:w-auto"
                align="left"
              />
            </div>
          </div>

          {/* Right: Compare Periods Action Button */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className={`group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full h-11 border px-4 text-xs sm:text-sm font-medium transition-all duration-200 shadow-2xs cursor-pointer ${
                reporting.comparison?.enabled
                  ? "bg-[#1f1f1f] text-white border-[#1f1f1f] hover:border-[#FCDF9C] hover:bg-[#FCDF9C] hover:text-[#1f1f1f]"
                  : "border-[#D7D7D7] bg-white text-zinc-800 hover:border-[#1F1F1F] hover:bg-zinc-50"
              }`}
            >
              <svg
                className="size-4 shrink-0 transition-transform group-hover:scale-105"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m16 3 4 4-4 4" />
                <path d="M20 7H4" />
                <path d="m8 21-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
              <span>{reporting.comparison?.enabled ? "Comparing" : "Compare Periods"}</span>
            </button>

            {reporting.comparison?.enabled && (
              <button
                type="button"
                onClick={() => handleApplyComparison(null)}
                title="Clear comparison"
                className="flex size-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer border border-zinc-200"
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {reporting.comparison?.enabled && (
        <div className="flex flex-col gap-3 rounded-2xl border border-white bg-[#F3F4F5] p-3.5 sm:px-5 sm:py-3.5 shadow-[0_2px_4px_0px_#00000040] w-full min-w-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start sm:items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#EDEDED] bg-white text-[#1F1F1F] shadow-2xs">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 3 4 4-4 4" />
                <path d="M20 7H4" />
                <path d="m8 21-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-[#FCDF9C]/25 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#1F1F1F]">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                  Period Comparison
                </span>
                <span className="text-xs text-[#727272]">
                  Active baseline analysis
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-medium text-[#1F1F1F]">
                <span className="truncate rounded-md bg-white px-2 py-0.5 border border-[#EDEDED] font-medium text-[#1F1F1F] shadow-2xs">
                  {reporting.timeframeLabel || reporting.monthLabel}
                </span>
                <span className="text-[#727272] text-xs font-normal">compared with</span>
                <span className="truncate rounded-md bg-white px-2 py-0.5 border border-[#EDEDED] font-medium text-[#1F1F1F] shadow-2xs">
                  {reporting.comparison.periodLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-[#1F1F1F] shadow-2xs transition-all hover:border-[#1F1F1F] hover:bg-zinc-50 cursor-pointer"
            >
              <span>Change</span>
            </button>
            <button
              type="button"
              onClick={() => handleApplyComparison(null)}
              title="Disable comparison"
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-2xs transition-all hover:border-rose-300 hover:bg-rose-100 cursor-pointer"
            >
              <svg className="size-3 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Disable</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load(query)}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Section B: Main Earnings Chart & Performance Dashboard (Design Reference Match) ── */}
      <EarningsPerformanceCard
        reporting={reporting}
        currency={reporting.chart.currency || selectedTotals?.currency || "SAR"}
        selectedPointIndex={selectedPoint}
        onSelectPoint={setSelectedPoint}
        onPeriodChange={handlePeriodChange}
        onListingChange={(id) => update({ propertyId: id })}
        onOpenCustomRange={() => setShowCompareModal(true)}
      />

      {/* ── Section C: Earnings Numerical KPI Cards (Numbers BELOW Chart) ── */}
      <section
        aria-busy={isLoadingOverview}
        className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs sm:p-6 sm:rounded-3xl lg:p-8 transition-opacity ${isLoadingOverview ? "opacity-50" : ""
          }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-sm sm:text-base font-medium text-[#727272]">Total Realized Net</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl min-[480px]:text-3xl sm:text-4xl font-medium tracking-tight text-[#1f1f1f]">
                {selectedTotals
                  ? fmt(selectedTotals.monthlyRecognized, selectedTotals.currency)
                  : "SAR 0.00"}
              </span>
              <span className="text-xs sm:text-sm font-normal text-[#727272]">
                in {reporting.timeframeLabel || reporting.monthLabel}
              </span>
            </div>
            {reporting.totalsByCurrency.length > 1 && (
              <p className="mt-1 text-xs text-[#727272]">
                Amounts stay separated by settlement currency.
              </p>
            )}
          </div>

          {/* Comparison Delta Callout */}
          {reporting.comparison && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-2.5 sm:px-4 sm:py-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${reporting.comparison.deltaDirection === "increase"
                  ? "bg-emerald-100 text-emerald-800"
                  : reporting.comparison.deltaDirection === "decrease"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-zinc-200 text-zinc-700"
                  }`}
              >
                {reporting.comparison.deltaDirection === "increase" ? "↑" : reporting.comparison.deltaDirection === "decrease" ? "↓" : "•"}
                {reporting.comparison.deltaPercentage !== null
                  ? ` ${Math.abs(reporting.comparison.deltaPercentage)}%`
                  : reporting.comparison.netEarnings === 0 && (selectedTotals?.monthlyRecognized || 0) > 0
                    ? " New activity"
                    : " No comparable baseline"}
              </span>
              <span className="font-medium text-[#727272]">
                {reporting.comparison.periodLabel} ({fmt(reporting.comparison.netEarnings, selectedTotals?.currency || "SAR")})
              </span>
            </div>
          )}
        </div>

        <div className="sm:mt-6 mt-3 grid grid-cols-1 gap-3 border-t border-zinc-100 sm:pt-6 pt-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          <PeriodFinancialMetric
            label="Gross earnings"
            value={periodFinancials.gross}
            comparisonValue={reporting.comparison?.grossEarnings}
            comparisonLabel={reporting.comparison?.periodLabel}
            currency={reporting.chart.currency || selectedTotals?.currency || "SAR"}
          />
          <div className="min-[480px]:col-span-2 lg:col-span-1">
            <PeriodFinancialMetric
              label="Host service fees"
              value={periodFinancials.fees}
              comparisonValue={reporting.comparison?.platformFee}
              comparisonLabel={reporting.comparison?.periodLabel}
              currency={reporting.chart.currency || selectedTotals?.currency || "SAR"}
              unfavorableIncrease
            />
          </div>
          <PeriodFinancialMetric
            label="Refunds and adjustments"
            value={periodFinancials.refunds + periodFinancials.adjustments}
            currency={reporting.chart.currency || selectedTotals?.currency || "SAR"}
            unfavorableIncrease
          />
        </div>

        {/* Supporting KPIs — payouts remain in the dedicated activity section. */}
        <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] border border-white p-4">
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Bookings</p>
            <p className="mt-1 text-xl min-[480px]:text-2xl font-medium tracking-tight text-[#1f1f1f] truncate">
              {(reporting.performanceMetrics?.bookingsCount || 0).toLocaleString("en-US")}
            </p>
            <p className="mt-6 pt-3 border-t border-zinc-200 text-xs text-[#727272]">Completed stays in this period</p>
          </div>

          <div className="rounded-xl bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] border border-white p-4">
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Average per booking</p>
            <p className="mt-1 text-xl min-[480px]:text-2xl font-medium tracking-tight text-[#1f1f1f] truncate">
              {fmt(reporting.performanceMetrics?.averagePerBooking || 0, reporting.chart.currency || selectedTotals?.currency || "SAR")}
            </p>
            <p className="mt-6 pt-3 border-t border-zinc-200 text-xs text-[#727272]">Realized net per completed stay</p>
          </div>

          <button
            type="button"
            disabled={!selectedTotals}
            onClick={() => setShowYtd(true)}
            className="rounded-xl bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] border border-white p-4 text-left transition-all hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-normal text-[#727272]">Year-to-date earnings</p>
              <span className="size-5 rounded-full text-sm border border-[#727272] text-[#727272] flex justify-center items-center shrink-0">ℹ</span>
            </div>
            <p className="mt-1 text-xl min-[480px]:text-2xl font-medium tracking-tight text-[#1f1f1f] truncate">
              {selectedTotals ? fmt(selectedTotals.ytdNet + selectedTotals.ytdAdjustments, selectedTotals.currency) : "—"}
            </p>
            <p className="mt-6 pt-3 border-t border-zinc-200 text-xs text-[#727272]">Full {reporting.selectedYear} cumulative</p>
          </button>
        </div>

        {reporting.unavailableSnapshotCount > 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 leading-relaxed">
            {reporting.unavailableSnapshotCount} completed booking
            {reporting.unavailableSnapshotCount === 1 ? "" : "s"} without an
            immutable payout snapshot{" "}
            {reporting.unavailableSnapshotCount === 1 ? "is" : "are"} excluded
            pending reconciliation.
          </p>
        )}
      </section>

      <section
        aria-labelledby="dashboard-plus-analytics-heading"
        className="flex flex-col gap-4 rounded-2xl border border-white bg-[#1F1F1F] p-3.5 sm:p-5 md:p-6 text-white shadow-[0_2px_4px_0px_#00000040] transition-all w-full min-w-0 overflow-hidden lg:flex-row lg:items-center lg:justify-between lg:gap-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#FCDF9C]/30 bg-[#FCDF9C]/20 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#FCDF9C]">
              Dashboard Plus
            </span>
            {entitlements.hasDashboardPlus && (
              <span className="text-xs font-normal text-zinc-400">
                {entitlements.status === "ADMIN_GRANTED"
                  ? entitlements.expiresAt
                    ? "Complimentary (Temporary)"
                    : "Complimentary"
                  : entitlements.status === "TRIAL"
                    ? "Trial active"
                    : "Active"}
              </span>
            )}
          </div>
          <h2
            id="dashboard-plus-analytics-heading"
            className="mt-2 text-base font-medium tracking-tight text-white sm:text-lg"
          >
            Advanced Earnings Analytics and RevPAN
          </h2>
          <p className="mt-1 text-xs font-normal leading-relaxed text-zinc-300 sm:text-sm">
            Explore property financial comparisons, recorded costs, profitability, and revenue per available night.
          </p>
        </div>

        {entitlements.features.ADVANCED_EARNINGS ? (
          <div className="w-full shrink-0 sm:w-auto">
            <Link
              href={scopedHref("/host/earnings/analytics")}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FCDF9C] px-5 py-3 text-xs font-medium text-[#1F1F1F] transition-all duration-300 hover:bg-white hover:text-[#1F1F1F] hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FCDF9C] sm:w-auto sm:py-2.5 cursor-pointer"
            >
              <span>Open advanced analytics</span>
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        ) : (
          <div className="w-full shrink-0 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-zinc-300 backdrop-blur-xs sm:w-auto sm:py-2.5 sm:px-3.5 lg:max-w-sm">
            <p>
              Available with <span className="font-medium text-white">Dashboard Plus</span>. Contact support or an administrator to activate access.
            </p>
          </div>
        )}
      </section>

      {/* ── Upcoming & Paid payouts ── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg min-[480px]:text-xl font-medium text-[#1f1f1f]">Payout activity</h2>
          <p className="mt-0.5 text-xs sm:text-sm text-[#727272]">
            Completed and scheduled host transactions
          </p>
        </div>
        <Link
          href={scopedHref("/host/earnings/transactions")}
          className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#1F1F1F] transition-all duration-200 hover:border-[#1F1F1F] hover:bg-zinc-50 sm:self-auto sm:px-4 sm:py-2 cursor-pointer"
        >
          <span>View all transactions</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 w-full min-w-0 lg:grid-cols-2">
        <PayoutsSection
          title="Upcoming"
          href={scopedHref("/host/earnings/upcoming")}
          returnTo={scopedHref("/host/earnings")}
          description="Scheduled, processing and ready payouts"
          payouts={data.upcomingPayouts}
          paid={false}
          onSelect={(p) => setPayout(p)}
          empty="No upcoming payouts at this time."
        />
        <PayoutsSection
          title="Paid"
          href={scopedHref("/host/earnings/paid")}
          returnTo={scopedHref("/host/earnings")}
          description="Verified payout executions"
          payouts={data.completedPayouts}
          paid={true}
          onSelect={(p) => setPayout(p)}
          empty="No paid payouts in this period."
        />
      </div>

      {/* ── Monthly Reports ── */}
      <section
        aria-labelledby="earnings-reports-heading"
        className="rounded-2xl border border-white bg-[#F3F4F5] p-3.5 sm:p-6 shadow-[0_2px_4px_0px_#00000040] w-full min-w-0 overflow-hidden"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 id="earnings-reports-heading" className="text-base font-medium text-[#1F1F1F] sm:text-lg">
              Earnings reports
            </h2>
            <p className="mt-0.5 text-xs text-[#727272] sm:text-sm">
              Monthly and annual earnings statements
            </p>
          </div>
          <Link
            href={scopedHref("/host/earnings/reports")}
            className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#1F1F1F] shadow-2xs transition-all hover:border-[#1F1F1F] hover:bg-zinc-50 sm:self-auto cursor-pointer"
          >
            <span>View all reports</span>
          </Link>
        </div>

        <div className="mt-4">
          {reporting.reports.length ? (
            <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-2xs">
              {reporting.reports.map((report) => (
                <Link
                  key={`${report.year}-${report.month}`}
                  href={scopedHref(
                    `/host/earnings/reports/monthly/${report.year}/${report.month}`,
                  )}
                  className="group flex items-center justify-between p-2.5 sm:px-6 sm:py-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs sm:text-sm text-[#727272] transition-colors group-hover:bg-[#FCDF9C]/30 group-hover:text-[#1F1F1F] sm:size-8">
                      📄
                    </span>
                    <span className="truncate text-xs sm:text-sm font-medium text-[#1F1F1F] group-hover:text-black">
                      {report.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="text-xs sm:text-sm font-medium text-[#1F1F1F]">
                      {fmt(report.amount, report.currency)}
                    </span>
                    <ChevronRightIcon
                      size={16}
                      className="shrink-0 text-[#727272] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#1F1F1F]"
                    />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-zinc-100/80 bg-white px-4 py-6 text-center shadow-2xs">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#F3F4F5] text-base text-[#727272]" aria-hidden="true">
                📄
              </span>
              <p className="mt-2 text-xs font-medium text-[#1F1F1F] sm:text-sm">
                No completed-stay earnings this year.
              </p>
              <p className="mt-0.5 text-xs text-[#727272]">
                Monthly and annual statements will automatically generate when stays conclude.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Modals ── */}
      {showCompareModal && (
        <PeriodComparisonModal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          currentPeriodLabel={reporting.timeframeLabel || reporting.monthLabel}
          currentStartDate={reporting.startDateKey || ""}
          currentEndDate={reporting.endDateKey || ""}
          currentTimeframe={reporting.timeframe || "monthly"}
          onApplyComparison={handleApplyComparison}
          activeComparison={
            reporting.comparison
              ? {
                enabled: reporting.comparison.enabled,
                timeframe: reporting.comparison.timeframe as TimeframeGranularity,
                startDate: reporting.comparison.startDateKey,
                endDate: reporting.comparison.endDateKey,
                label: reporting.comparison.periodLabel,
                preset: (query.get("comparePreset") as ComparisonPeriodConfig["preset"] | null) || "custom_range",
              }
              : null
          }
        />
      )}
      {showYtd && selectedTotals && (
        <YtdModal
          totals={selectedTotals}
          year={reporting.selectedYear}
          onClose={() => setShowYtd(false)}
        />
      )}
      {payout && (
        <PayoutDetailModal payout={payout} onClose={() => setPayout(null)} />
      )}
      {showMethods && (
        <MethodsModal
          methods={data.payoutMethods}
          loading={methodLoading}
          error={methodError}
          onClose={() => setShowMethods(false)}
          onAdd={() => setShowAddMethod(true)}
          onChange={changeMethod}
        />
      )}
      {showAddMethod && (
        <AddMethodModal
          form={methodForm}
          loading={methodLoading}
          error={methodError}
          onClose={() => setShowAddMethod(false)}
          onSubmit={saveMethod}
          setForm={setMethodForm}
        />
      )}
    </div>
  );
}

function PeriodFinancialMetric({ label, value, comparisonValue, comparisonLabel, currency, unfavorableIncrease = false }: { label: string; value: number; comparisonValue?: number; comparisonLabel?: string; currency: string; unfavorableIncrease?: boolean }) {
  const delta = typeof comparisonValue === "number" ? value - comparisonValue : null;
  const direction = delta === null || delta === 0 ? "No change" : delta > 0 ? (unfavorableIncrease ? "Higher" : "Higher") : (unfavorableIncrease ? "Lower" : "Lower");
  const tone = delta === null || delta === 0 ? "text-[#727272]" : delta > 0 ? (unfavorableIncrease ? "text-rose-700" : "text-emerald-700") : (unfavorableIncrease ? "text-emerald-700" : "text-rose-700");
  return (
    <div className="rounded-xl bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040] border border-white p-4">
      <p className="text-xs sm:text-sm font-normal text-[#727272]">{label}</p>
      <p className="mt-1 truncate text-xl min-[480px]:text-2xl font-medium tracking-tight text-[#1f1f1f]">
        {fmt(value, currency)}
      </p>
      {typeof comparisonValue === "number" ? (
        <p className={`mt-2 truncate text-[11px] font-medium ${tone}`}>
          {direction} by {fmt(Math.abs(delta || 0), currency)} vs {comparisonLabel}
        </p>
      ) : (
        <p className="mt-6 pt-3 border-t border-zinc-200 text-xs text-[#727272]">
          Completed-stay immutable snapshots
        </p>
      )}
    </div>
  );
}

/* ─── Payouts Section ─────────────────────────────────────────────────────── */
function PayoutsSection({
  title,
  href,
  returnTo,
  paid,
  description,
  payouts,
  onSelect,
  empty,
}: {
  title: string;
  href: string;
  returnTo: string;
  paid: boolean;
  description: string;
  payouts: HostEarningsPayoutPreview[];
  onSelect: (payout: HostEarningsPayoutPreview) => void;
  empty: string;
}) {
  return (
    <section className="flex flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] p-3.5 sm:p-5 shadow-[0_2px_4px_0px_#00000040] w-full min-w-0 overflow-hidden">
      <div className="w-full min-w-0">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-medium text-[#1F1F1F] sm:text-lg">{title}</h3>
            <p className="mt-0.5 truncate text-xs text-[#727272] sm:text-sm">{description}</p>
          </div>
          <Link
            href={href}
            className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm font-medium text-[#1F1F1F] transition-all hover:border-[#1F1F1F] hover:bg-zinc-50 cursor-pointer"
          >
            <span>View all</span>
          </Link>
        </div>

        <div className="mt-3.5 sm:mt-4">
          {payouts.length ? (
            <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-2xs w-full min-w-0">
              {payouts.map((item) => (
                <Link
                  key={item.bookingId}
                  href={
                    "/host/earnings/transactions/" +
                    item.bookingId +
                    "?returnTo=" +
                    encodeURIComponent(returnTo)
                  }
                  onClick={() => onSelect(item)}
                  className="group flex w-full items-center gap-2 sm:gap-3 p-2.5 sm:px-4 sm:py-3.5 text-left transition-colors hover:bg-zinc-50"
                >
                  {/* Listing photo */}
                  <div className="flex size-9 sm:size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:rounded-xl bg-zinc-100 text-[10px] font-medium text-zinc-400">
                    {item.listingPhoto ? (
                      <Image
                        src={item.listingPhoto}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                        className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      "🏠"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-medium text-[#1F1F1F] group-hover:text-black">
                      {fmtDate(
                        paid
                          ? item.executionDetails?.executedAt
                          : item.scheduledPayoutDate,
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] sm:text-xs text-[#727272]">
                      {item.listingTitle}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs sm:text-sm font-medium text-[#1F1F1F]">
                      {fmt(item.netPayout, item.currency)}
                    </p>
                    <span
                      className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] sm:text-xs leading-tight font-normal ${payoutStatusStyle(item.status)}`}
                    >
                      {payoutStatusLabel(item.status)}
                    </span>
                  </div>
                  <ChevronRightIcon
                    size={16}
                    className="shrink-0 text-[#727272] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#1F1F1F]"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-zinc-100/80 bg-white px-4 py-6 text-center shadow-2xs">
              <span className="flex size-9 items-center justify-center rounded-full bg-[#F3F4F5] text-base text-[#727272]" aria-hidden="true">
                {paid ? "💳" : "⏳"}
              </span>
              <p className="mt-2 text-xs font-medium text-[#1F1F1F] sm:text-sm">
                {empty}
              </p>
              <p className="mt-0.5 text-xs text-[#727272]">
                {paid
                  ? "Completed payout transfers will be recorded here."
                  : "Upcoming payouts will appear once stays begin."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── Year-to-Date Modal ──────────────────────────────────────────────────── */
function YtdModal({
  totals,
  year,
  onClose,
}: {
  totals: NonNullable<HostEarningsDetails["reporting"]>["totalsByCurrency"][number];
  year: number;
  onClose: () => void;
}) {
  const rows = [
    ["Gross earnings", totals.ytdGross],
    ["Adjustments", totals.ytdAdjustments],
    ["Host service fee", -totals.ytdPlatformFee],
    ["Taxes withheld", -totals.ytdTaxesWithheld],
  ] as const;

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="ytd-title"
      className="fixed inset-0 z-9999 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:p-6 sm:pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="ytd-title" className="text-xl font-medium text-[#1f1f1f]">
              Year-to-date summary
            </h2>
            <p className="mt-1 text-sm text-[#727272]">
              January 1 –{" "}
              {year === new Date().getUTCFullYear() ? "today" : "December 31"},{" "}
              {year}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close summary"
            className="rounded-full size-8 text-xl text-[#727272] hover:bg-zinc-200 transition-all duration-300"
          >
            ×
          </button>
        </div>
        <div className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {rows.map(([rowLabel, amount]) => (
            <div key={rowLabel} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-[#727272]">{rowLabel}</span>
              <span className={amount < 0 ? "text-rose-700" : "text-zinc-900"}>
                {amount < 0 ? "−" : ""}
                {fmt(Math.abs(amount), totals.currency)}
              </span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-4 font-medium text-[#1f1f1f]">
            <span>Total ({totals.currency})</span>
            <span>
              {fmt(totals.ytdNet + totals.ytdAdjustments, totals.currency)}
            </span>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#727272]">
          Total is completed-stay host net payout plus recorded, deducted
          adjustments. Taxes shown only when a withholding record exists.
        </p>
      </div>
    </ModalOverlay>
  );
}

/* ─── Payout Detail Modal ─────────────────────────────────────────────────── */
function PayoutDetailModal({
  payout,
  onClose,
}: {
  payout: HostEarningsPayoutPreview;
  onClose: () => void;
}) {
  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="payout-title"
      className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:p-6 sm:pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="payout-title" className="text-xl font-medium text-[#1f1f1f]">
              Payout details
            </h2>
            <p className="mt-0.5 text-sm text-[#727272]">
              {payout.listingTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payout details"
            className="rounded-full p-2 text-xl text-zinc-400 hover:bg-zinc-100"
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          <p className="text-3xl font-medium text-[#1f1f1f]">
            {fmt(payout.netPayout, payout.currency)}
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${payoutStatusStyle(payout.status)}`}
          >
            {payoutStatusLabel(payout.status)}
          </span>
        </div>

        <div className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 text-sm">
          <div className="flex justify-between px-4 py-3">
            <span className="text-[#727272]">Gross earnings</span>
            <span className="font-medium text-zinc-900">
              {fmt(payout.grossEarnings, payout.currency)}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-[#727272]">Host service fee</span>
            <span className="text-rose-700">
              −{fmt(payout.platformFee, payout.currency)}
            </span>
          </div>
          {payout.deductions > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-[#727272]">Deductions</span>
              <span className="text-rose-700">
                −{fmt(payout.deductions, payout.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-4 py-4 font-medium">
            <span>Net payout</span>
            <span>{fmt(payout.netPayout, payout.currency)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-1.5 text-sm text-[#727272]">
          <p>Guest: {payout.guestName}</p>
          <p>
            Stay: {fmtDate(payout.startDate)} – {fmtDate(payout.endDate)}
          </p>
          <p>
            {payout.status === "PAID" && payout.executionDetails?.executedAt
              ? "Paid"
              : "Scheduled"}
            :{" "}
            {fmtDate(
              payout.executionDetails?.executedAt || payout.scheduledPayoutDate,
            )}
          </p>
        </div>

        <Link
          href={`/host/earnings/transactions/${payout.bookingId}`}
          className="mt-5 block text-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          View full transaction details
        </Link>
      </div>
    </ModalOverlay>
  );
}

/* ─── Payout Methods Modal ────────────────────────────────────────────────── */
function MethodsModal({
  methods,
  loading,
  error,
  onClose,
  onAdd,
  onChange,
}: {
  methods: HostPayoutMethod[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: () => void;
  onChange: (id: string, action: "default" | "delete") => void;
}) {
  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="methods-title"
      className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:p-6 sm:pb-6">
        <div className="flex items-start justify-between">
          <h2 id="methods-title" className="text-xl font-medium text-[#1f1f1f]">
            Payout methods
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-xl text-zinc-400 hover:bg-zinc-100"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-3">
          {methods.length ? (
            methods.map((method) => (
              <div
                key={method.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{method.bankName}</p>
                    <p className="mt-0.5 font-mono text-sm text-[#727272]">
                      {method.ibanMasked}
                    </p>
                    <p className="mt-0.5 text-sm text-[#727272]">
                      {method.accountHolderName} ·{" "}
                      {method.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-4 text-sm font-medium">
                  {!method.isDefault && (
                    <button
                      disabled={loading}
                      type="button"
                      onClick={() => onChange(method.id, "default")}
                      className="text-zinc-900 underline disabled:opacity-50"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    disabled={loading}
                    type="button"
                    onClick={() => onChange(method.id, "delete")}
                    className="text-rose-700 underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-[#727272]">
              No payout methods added yet.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add payout method
          </button>
          <Link
            href="/host/account-settings/payouts"
            onClick={onClose}
            className="w-full text-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Open Dedicated Payout Settings →
          </Link>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── Add Method Modal ────────────────────────────────────────────────────── */
function AddMethodModal({
  form,
  loading,
  error,
  onClose,
  onSubmit,
  setForm,
}: {
  form: {
    accountHolderName: string;
    bankName: string;
    iban: string;
    isDefault: boolean;
  };
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  setForm: React.Dispatch<
    React.SetStateAction<{
      accountHolderName: string;
      bankName: string;
      iban: string;
      isDefault: boolean;
    }>
  >;
}) {
  const field = (
    key: "accountHolderName" | "bankName" | "iban",
    label: string,
    mono = false,
  ) => (
    <label className="block text-sm font-medium text-zinc-700">
      {label}
      <input
        required
        value={form[key]}
        onChange={(e) =>
          setForm((old) => ({
            ...old,
            [key]:
              key === "iban" ? e.target.value.toUpperCase() : e.target.value,
          }))
        }
        className={`mt-1.5 w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm ${mono ? "font-mono" : ""}`}
      />
    </label>
  );

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-method-title"
      className="fixed inset-0 z-[60] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4 backdrop-blur-xs"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl sm:p-6 sm:pb-6"
      >
        <div className="flex items-start justify-between">
          <h2 id="add-method-title" className="text-xl font-medium text-[#1f1f1f]">
            Add payout method
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-xl text-zinc-400 hover:bg-zinc-100"
          >
            ×
          </button>
        </div>
        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-5 space-y-4">
          {field("accountHolderName", "Account holder name")}
          {field("bankName", "Bank name")}
          {field("iban", "Saudi IBAN", true)}
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm((old) => ({ ...old, isDefault: e.target.checked }))
              }
              className="rounded"
            />
            Set as default payout method
          </label>
        </div>
        <button
          disabled={loading}
          type="submit"
          className="mt-6 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save payout method"}
        </button>
      </form>
    </ModalOverlay>
  );
}
