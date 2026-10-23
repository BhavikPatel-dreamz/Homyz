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
import { EarningsInteractiveChart } from "@/components/host/reporting/earnings-interactive-chart";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import type {
  HostEarningsDetails,
  HostEarningsPayoutPreview,
  HostPayoutMethod,
} from "@/services/payout.service";

interface HostEarningsClientProps {
  initialData: HostEarningsDetails;
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

export function HostEarningsClient({ initialData }: HostEarningsClientProps) {
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
    update({
      timeframe: next.timeframe,
      date: next.date || null,
      weekStart: next.weekStart || null,
      month: next.month ? String(next.month) : null,
      year: next.year ? String(next.year) : null,
      quarter: next.quarter ? String(next.quarter) : null,
      startDate: next.startDate || null,
      endDate: next.endDate || null,
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
      });
    } else {
      update({
        compare: "true",
        compareTimeframe: config.timeframe,
        compareStartDate: config.startDate || null,
        compareEndDate: config.endDate || null,
        compareMonth: config.month ? String(config.month) : null,
        compareYear: config.year ? String(config.year) : null,
        compareQuarter: config.quarter ? String(config.quarter) : null,
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
    <div className="space-y-8 pb-12">
      {/* ── Section A: Header & Compact Unified Toolbar ── */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1 md:pr-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#F3F4F5] px-2.5 py-0.5 text-xs font-medium text-[#1f1f1f] border border-[#ddd]">
              Hosting
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-3xl lg:text-[34px]">
            Earnings
          </h1>
          <p className="mt-1 text-sm text-[#727272] max-w-xl">
            Track realized payouts, completed stays, and financial performance.
          </p>
        </div>

        {/* Top Actions: Payout Methods & Reports */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-nowrap">
          <button
            type="button"
            onClick={() => setShowMethods(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D7D7D7] bg-[#F3F4F5] px-4 py-2 text-xs sm:text-sm font-medium text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-zinc-50 transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
          >
            <svg className="w-4 h-4 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Payout methods</span>
            {data.payoutMethods.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-medium text-[#1F1F1F]">
                {data.payoutMethods.length}
              </span>
            )}
          </button>
          <Link
            href={scopedHref("/host/earnings/reports")}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D7D7D7] bg-[#F3F4F5] px-4 py-2 text-xs sm:text-sm font-medium text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-zinc-50 transition-all shadow-2xs whitespace-nowrap shrink-0"
          >
            <svg className="w-4 h-4 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Statements</span>
          </Link>
        </div>
      </header>

      {/* ── Toolbar: Filter & Reporting Period Controls ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Left Filter Group: Property + Date Period Picker (Never breaks apart on tablet) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-nowrap gap-2.5 w-full md:w-auto">
          <PropertySelector
            listings={reporting.listings}
            selectedListingId={reporting.selectedListingId}
            onSelect={(id) => update({ propertyId: id })}
          />

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
          />
        </div>

        {/* Right Action Group: Compare Periods */}
        <div className="flex items-center gap-2 w-full md:w-auto self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowCompareModal(true)}
            className={`flex-1 md:flex-initial inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-full border px-4 sm:px-5 text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer shadow-2xs ${
              reporting.comparison?.enabled
                ? "border-[#1F1F1F] bg-[#1F1F1F] text-white hover:bg-black"
                : "border-[#1F1F1F] bg-[#1F1F1F] text-white hover:border-[#1F1F1F] hover:bg-white hover:text-[#1F1F1F]"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3h5v5" />
              <path d="M8 21H3v-5" />
              <path d="M21 3l-7.5 7.5" />
              <path d="M3 21l7.5-7.5" />
            </svg>
            <span className="whitespace-nowrap">{reporting.comparison?.enabled ? "Comparing periods" : "Compare periods"}</span>
          </button>

          {reporting.comparison?.enabled && (
            <button
              type="button"
              onClick={() => handleApplyComparison(null)}
              title="Clear comparison"
              className="flex h-11 sm:h-12 w-11 sm:w-12 shrink-0 items-center justify-center rounded-full border border-[#D7D7D7] bg-white text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F] hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex justify-between items-center rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load(query)}
            className="font-medium underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Section B: Main Earnings Chart (Visual Chart FIRST) ── */}
      <section className="rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#EDEDED] pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[#1F1F1F]">Earnings performance</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#727272]">
              {reporting.chart.currency || "SAR"} realized net host payouts across {reporting.timeframeLabel || reporting.monthLabel}
            </p>
            {reporting.totalsByCurrency.length > 1 && (
              <p className="mt-1 text-xs text-[#727272]">
                Amounts stay separated by settlement currency.
              </p>
            )}
          </div>
          {reporting.totalsByCurrency.length > 1 && (
            <span className="rounded-full border border-[#D7D7D7] bg-[#FAFAFA] px-3 py-1 text-xs font-medium text-[#1F1F1F]">
              Reporting in {reporting.chart.currency || "SAR"}
            </span>
          )}
        </div>

        <div className="mt-4">
          <EarningsInteractiveChart
            points={chartPoints}
            currency={reporting.chart.currency || "SAR"}
            timeframeLabel={reporting.timeframeLabel || reporting.monthLabel}
            comparisonLabel={reporting.comparison?.periodLabel}
            selectedPointIndex={selectedPoint}
            onSelectPoint={(idx) => setSelectedPoint(idx)}
            selectedListingId={reporting.selectedListingId}
          />
        </div>
      </section>

      {/* ── Section C: Earnings Numerical KPI Cards (Numbers BELOW Chart) ── */}
      <section
        aria-busy={isLoadingOverview}
        className={`rounded-2xl sm:rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-7 shadow-xs transition-opacity ${
          isLoadingOverview ? "opacity-50" : ""
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-xs font-medium text-[#727272]">Total Realized Net</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="mt-2 text-2xl font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-3xl lg:text-[34px]">
                {selectedTotals
                  ? fmt(selectedTotals.monthlyRecognized, selectedTotals.currency)
                  : "SAR 0.00"}
              </span>
              <span className="text-sm font-normal text-[#727272]">
                in {reporting.timeframeLabel || reporting.monthLabel}
              </span>
            </div>
          </div>

          {/* Comparison Delta Callout */}
          {reporting.comparison && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl sm:rounded-full border border-[#EDEDED] bg-[#FAFAFA] px-3.5 sm:px-4 py-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
                  reporting.comparison.deltaDirection === "increase"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : reporting.comparison.deltaDirection === "decrease"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-zinc-100 text-[#727272] border border-zinc-200"
                }`}
              >
                {reporting.comparison.deltaDirection === "increase" ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                ) : reporting.comparison.deltaDirection === "decrease" ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                ) : null}
                <span>
                  {reporting.comparison.deltaPercentage !== null
                    ? `${Math.abs(reporting.comparison.deltaPercentage)}%`
                    : fmt(Math.abs(reporting.comparison.deltaEarnings), selectedTotals?.currency || "SAR")}
                </span>
              </span>
              <span className="text-[#727272] font-normal truncate">
                vs {reporting.comparison.periodLabel} ({fmt(reporting.comparison.netEarnings, selectedTotals?.currency || "SAR")})
              </span>
            </div>
          )}
        </div>

        {/* 3-Card KPI Grid */}
        <div className="mt-6 grid gap-4 grid-cols-1 md:grid-cols-3 border-t border-[#EDEDED] pt-6">
          <div className="rounded-2xl border border-[#EDEDED] bg-[#F3F4F5] p-5 hover:bg-[#FEFDF9] hover:border-[#D7D7D7] transition-all shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-normal text-[#727272]">Upcoming payout</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#EDEDED] text-[#727272]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
            </div>
            <p className="mt-2 text-2xl sm:text-[26px] font-medium tracking-tight text-[#1F1F1F] break-words">
              {selectedTotals
                ? fmt(selectedTotals.upcomingPayout, selectedTotals.currency)
                : "—"}
            </p>
            <p className="mt-1 text-xs text-[#727272]">Scheduled and ready for release</p>
          </div>

          <button
            type="button"
            disabled={!selectedTotals}
            onClick={() => setShowYtd(true)}
            className="group rounded-2xl border border-[#EDEDED] bg-[#F3F4F5] p-5 text-left transition-all hover:bg-[#FEFDF9] hover:border-[#D7D7D7] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-normal text-[#727272]">Year-to-date earnings</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#EDEDED] text-[#727272] group-hover:text-[#1F1F1F] transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </div>
            <p className="mt-2 text-2xl sm:text-[26px] font-medium tracking-tight text-[#1F1F1F] break-words">
              {selectedTotals
                ? fmt(
                    selectedTotals.ytdNet + selectedTotals.ytdAdjustments,
                    selectedTotals.currency,
                  )
                : "—"}
            </p>
            <p className="mt-1 text-xs text-[#727272]">Full {reporting.selectedYear} cumulative · Click for details</p>
          </button>

          <div className="rounded-2xl border border-[#EDEDED] bg-[#F3F4F5] p-5 hover:bg-[#FEFDF9] hover:border-[#D7D7D7] transition-all shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-normal text-[#727272]">Settled payouts volume</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#EDEDED] text-[#727272]">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </div>
            <p className="mt-2 text-2xl sm:text-[26px] font-medium tracking-tight text-[#1F1F1F] break-words">
              {fmt(data.summary.totalPaidVolume, selectedTotals?.currency || "SAR")}
            </p>
            <p className="mt-1 text-xs text-[#727272]">{data.summary.totalPaidCount} verified payout transfers</p>
          </div>
        </div>

        {reporting.unavailableSnapshotCount > 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            {reporting.unavailableSnapshotCount} completed booking
            {reporting.unavailableSnapshotCount === 1 ? "" : "s"} without an
            immutable payout snapshot{" "}
            {reporting.unavailableSnapshotCount === 1 ? "is" : "are"} excluded
            pending reconciliation.
          </p>
        )}
      </section>

      {/* ── Upcoming & Paid payouts ── */}
      <div className="grid gap-6 sm:gap-8 lg:gap-10 lg:grid-cols-2">
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
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[#1F1F1F]">
              Earnings reports
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[#727272]">
              Monthly and annual earnings statements
            </p>
          </div>
          <Link
            href={scopedHref("/host/earnings/reports")}
            className="rounded-full border border-[#FCDF9C] bg-[#FCDF9C] px-3.5 py-2 text-sm font-medium text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white hover:border-[#1F1F1F] transition-all whitespace-nowrap"
          >
            View all
          </Link>
        </div>

        {reporting.reports.length ? (
          <div className="divide-y divide-[#EDEDED] rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden shadow-xs">
            {reporting.reports.map((report) => (
              <Link
                key={`${report.year}-${report.month}`}
                href={scopedHref(
                  `/host/earnings/reports/monthly/${report.year}/${report.month}`,
                )}
                className="group flex items-center justify-between px-5 py-4 transition-colors hover:bg-[#FAFAFA]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F4F5] text-[#1F1F1F]">
                    <svg className="w-4 h-4 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span className="font-medium text-sm text-[#1F1F1F]">
                    {report.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm text-[#1F1F1F]">
                    {fmt(report.amount, report.currency)}
                  </span>
                  <svg className="w-4 h-4 text-[#727272] transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D7D7D7] bg-[#FAFAFA] p-8 text-center">
            <p className="text-sm text-[#727272]">
              No completed-stay earnings this year.
            </p>
          </div>
        )}
      </section>

      {/* ── Modals ── */}
      {showCompareModal && (
        <PeriodComparisonModal
          isOpen={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          currentPeriodLabel={reporting.timeframeLabel || reporting.monthLabel}
          currentYear={reporting.selectedYear}
          currentMonth={reporting.selectedMonth}
          onApplyComparison={handleApplyComparison}
          activeComparison={
            reporting.comparison
              ? {
                  enabled: reporting.comparison.enabled,
                  timeframe: reporting.comparison.timeframe as TimeframeGranularity,
                  startDate: reporting.comparison.startDateKey,
                  endDate: reporting.comparison.endDateKey,
                  label: reporting.comparison.periodLabel,
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
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-medium tracking-tight text-[#1F1F1F]">{title} payouts</h2>
          <p className="mt-0.5 text-xs sm:text-sm text-[#727272]">{description}</p>
        </div>
        <Link
          href={href}
          className="rounded-full border border-[#FCDF9C] bg-[#FCDF9C] px-3.5 py-2 text-sm font-medium text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white hover:border-[#1F1F1F] transition-all whitespace-nowrap"
        >
          View all
        </Link>
      </div>

      <div className="divide-y divide-[#EDEDED] rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden shadow-xs">
        {payouts.length ? (
          payouts.map((item) => (
            <Link
              key={item.bookingId}
              href={
                "/host/earnings/transactions/" +
                item.bookingId +
                "?returnTo=" +
                encodeURIComponent(returnTo)
              }
              onClick={() => onSelect(item)}
              className="group flex w-full items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              {/* Listing photo */}
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F4F5] border border-[#EDEDED]">
                {item.listingPhoto ? (
                  <Image
                    src={item.listingPhoto}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <svg className="w-5 h-5 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1F1F1F]">
                  {fmtDate(
                    paid
                      ? item.executionDetails?.executedAt
                      : item.scheduledPayoutDate,
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#727272]">
                  {item.listingTitle}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-[#1F1F1F]">
                  {fmt(item.netPayout, item.currency)}
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] leading-tight font-medium ${payoutStatusStyle(item.status)}`}
                >
                  {payoutStatusLabel(item.status)}
                </span>
              </div>
              <svg className="w-4 h-4 text-[#727272] transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))
        ) : (
          <div className="py-8 px-5 text-center">
            <p className="text-sm text-[#727272]">{empty}</p>
          </div>
        )}
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
      className="fixed inset-0 z-9999 flex items-end bg-black/45 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl border border-[#E5E5E5] sm:max-w-md sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="ytd-title" className="text-xl font-medium text-[#1F1F1F]">
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
            className="rounded-full p-1.5 text-[#727272] hover:bg-zinc-100 hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mt-6 divide-y divide-[#EDEDED] rounded-2xl border border-[#E5E5E5]">
          {rows.map(([rowLabel, amount]) => (
            <div key={rowLabel} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-[#727272]">{rowLabel}</span>
              <span className={amount < 0 ? "text-rose-700 font-medium" : "text-[#1F1F1F] font-medium"}>
                {amount < 0 ? "−" : ""}
                {fmt(Math.abs(amount), totals.currency)}
              </span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-4 font-medium text-base text-[#1F1F1F] bg-[#FAFAFA] rounded-b-2xl">
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
      className="fixed inset-0 z-9999 flex items-end bg-black/45 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl border border-[#E5E5E5] sm:max-w-md sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="payout-title" className="text-xl font-medium text-[#1F1F1F]">
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
            className="rounded-full p-1.5 text-[#727272] hover:bg-zinc-100 hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <p className="text-3xl font-medium tracking-tight text-[#1F1F1F]">
            {fmt(payout.netPayout, payout.currency)}
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${payoutStatusStyle(payout.status)}`}
          >
            {payoutStatusLabel(payout.status)}
          </span>
        </div>

        <div className="mt-6 divide-y divide-[#EDEDED] rounded-2xl border border-[#E5E5E5] text-sm">
          <div className="flex justify-between px-4 py-3">
            <span className="text-[#727272]">Gross earnings</span>
            <span className="font-medium text-[#1F1F1F]">
              {fmt(payout.grossEarnings, payout.currency)}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-[#727272]">Host service fee</span>
            <span className="text-rose-700 font-medium">
              −{fmt(payout.platformFee, payout.currency)}
            </span>
          </div>
          {payout.deductions > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-[#727272]">Deductions</span>
              <span className="text-rose-700 font-medium">
                −{fmt(payout.deductions, payout.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3.5 font-medium bg-[#FAFAFA] rounded-b-2xl text-[#1F1F1F]">
            <span>Net payout</span>
            <span>{fmt(payout.netPayout, payout.currency)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-1.5 text-sm text-[#727272]">
          <p>Guest: <span className="text-[#1F1F1F] font-medium">{payout.guestName}</span></p>
          <p>
            Stay: <span className="text-[#1F1F1F] font-medium">{fmtDate(payout.startDate)} – {fmtDate(payout.endDate)}</span>
          </p>
          <p>
            {payout.status === "PAID" && payout.executionDetails?.executedAt
              ? "Paid"
              : "Scheduled"}
            :{" "}
            <span className="text-[#1F1F1F] font-medium">
              {fmtDate(
                payout.executionDetails?.executedAt || payout.scheduledPayoutDate,
              )}
            </span>
          </p>
        </div>

        <Link
          href={`/host/earnings/transactions/${payout.bookingId}`}
          className="mt-6 block text-center rounded-full bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#FCDF9C] hover:text-[#1F1F1F] transition-all"
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
      className="fixed inset-0 z-9999 flex items-end bg-black/45 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl border border-[#E5E5E5] sm:max-w-md sm:rounded-3xl sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="methods-title" className="text-xl font-medium text-[#1F1F1F]">
              Payout methods
            </h2>
            <p className="mt-0.5 text-xs text-[#727272]">
              Manage bank accounts for receiving host earnings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#727272] hover:bg-zinc-100 hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-3">
          {methods.length ? (
            methods.map((method) => (
              <div
                key={method.id}
                className="rounded-2xl border border-[#EDEDED] bg-[#FAFAFA] p-4 hover:border-[#D7D7D7] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1F1F1F]">{method.bankName}</p>
                    <p className="mt-0.5 font-mono text-sm text-[#727272]">
                      {method.ibanMasked}
                    </p>
                    <p className="mt-0.5 text-xs text-[#727272]">
                      {method.accountHolderName} ·{" "}
                      {method.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="shrink-0 rounded-full bg-[#1F1F1F] px-2.5 py-0.5 text-xs font-medium text-white">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-4 text-xs font-medium">
                  {!method.isDefault && (
                    <button
                      disabled={loading}
                      type="button"
                      onClick={() => onChange(method.id, "default")}
                      className="text-[#1F1F1F] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    disabled={loading}
                    type="button"
                    onClick={() => onChange(method.id, "delete")}
                    className="text-rose-700 hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#D7D7D7] bg-[#FAFAFA] p-6 text-center text-sm text-[#727272]">
              No payout methods added yet.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="mt-6 w-full rounded-full bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#FCDF9C] hover:text-[#1F1F1F] transition-all cursor-pointer"
        >
          Add payout method
        </button>
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
    <label className="block text-xs font-medium uppercase tracking-wider text-[#727272]">
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
        className={`mt-1.5 w-full rounded-xl border border-[#D7D7D7] bg-white px-3.5 py-2.5 text-sm text-[#1F1F1F] focus:border-[#1F1F1F] outline-none transition-colors ${mono ? "font-mono" : ""}`}
      />
    </label>
  );

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-method-title"
      className="fixed inset-0 z-[60] flex items-end bg-black/45 backdrop-blur-xs sm:items-center sm:justify-center sm:p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl border border-[#E5E5E5] sm:max-w-md sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="add-method-title" className="text-xl font-medium text-[#1F1F1F]">
              Add payout method
            </h2>
            <p className="mt-0.5 text-xs text-[#727272]">Enter bank account details for settlement</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#727272] hover:bg-zinc-100 hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-5 space-y-4">
          {field("accountHolderName", "Account holder name")}
          {field("bankName", "Bank name")}
          {field("iban", "Saudi IBAN", true)}
          <label className="flex items-center gap-2 text-sm font-medium text-[#1F1F1F] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm((old) => ({ ...old, isDefault: e.target.checked }))
              }
              className="rounded accent-[#1F1F1F]"
            />
            Set as default payout method
          </label>
        </div>
        <button
          disabled={loading}
          type="submit"
          className="mt-6 w-full rounded-full bg-[#1F1F1F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#FCDF9C] hover:text-[#1F1F1F] transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save payout method"}
        </button>
      </form>
    </ModalOverlay>
  );
}
