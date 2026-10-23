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
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      {/* ── Section A: Header & Compact Unified Toolbar ── */}
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Hosting</p>
          <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Earnings
          </h1>
        </div>

        {/* Compact Unified Toolbar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-3">
          {/* Left: Searchable Property Selector */}
          <PropertySelector
            listings={reporting.listings}
            selectedListingId={reporting.selectedListingId}
            onSelect={(id) => update({ propertyId: id })}
          />

          {/* Center: Reporting Period / Date Range Picker */}
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

          {/* Right: Compare Periods Action Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                reporting.comparison?.enabled
                  ? "border-zinc-950 bg-zinc-950 text-white shadow-xs"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
              }`}
            >
              <span>⚖️</span>
              <span>{reporting.comparison?.enabled ? "Comparing" : "Compare Periods"}</span>
            </button>

            {reporting.comparison?.enabled && (
              <button
                type="button"
                onClick={() => handleApplyComparison(null)}
                title="Clear comparison"
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load(query)}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Section B: Main Earnings Chart (Visual Chart FIRST) ── */}
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950">Earnings performance</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {reporting.chart.currency || "SAR"} realized net host payouts across {reporting.timeframeLabel || reporting.monthLabel}
            </p>
            {reporting.totalsByCurrency.length > 1 && (
              <p className="mt-1 text-xs text-zinc-500">
                Amounts stay separated by settlement currency.
              </p>
            )}
          </div>
          {reporting.totalsByCurrency.length > 1 && (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
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
        className={`rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8 transition-opacity ${
          isLoadingOverview ? "opacity-50" : ""
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Total Realized Net</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl">
                {selectedTotals
                  ? fmt(selectedTotals.monthlyRecognized, selectedTotals.currency)
                  : "SAR 0.00"}
              </span>
              <span className="text-sm font-semibold text-zinc-500">
                in {reporting.timeframeLabel || reporting.monthLabel}
              </span>
            </div>
          </div>

          {/* Comparison Delta Callout */}
          {reporting.comparison && (
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-2.5 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${
                  reporting.comparison.deltaDirection === "increase"
                    ? "bg-emerald-100 text-emerald-800"
                    : reporting.comparison.deltaDirection === "decrease"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-zinc-200 text-zinc-700"
                }`}
              >
                {reporting.comparison.deltaDirection === "increase" ? "↑" : reporting.comparison.deltaDirection === "decrease" ? "↓" : "•"}
                {reporting.comparison.deltaPercentage !== null
                  ? ` ${Math.abs(reporting.comparison.deltaPercentage)}%`
                  : ` ${fmt(Math.abs(reporting.comparison.deltaEarnings), selectedTotals?.currency || "SAR")}`}
              </span>
              <span className="font-medium text-zinc-600">
                {reporting.comparison.periodLabel} ({fmt(reporting.comparison.netEarnings, selectedTotals?.currency || "SAR")})
              </span>
            </div>
          )}
        </div>

        {/* 3-Card KPI Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3 border-t border-zinc-100 pt-6">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <p className="text-xs font-medium text-zinc-500">Upcoming payout</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
              {selectedTotals
                ? fmt(selectedTotals.upcomingPayout, selectedTotals.currency)
                : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Scheduled and ready for release</p>
          </div>

          <button
            type="button"
            disabled={!selectedTotals}
            onClick={() => setShowYtd(true)}
            className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 text-left transition-all hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500 underline underline-offset-4">Year-to-date earnings</p>
              <span className="text-xs text-zinc-400">ℹ</span>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
              {selectedTotals
                ? fmt(
                    selectedTotals.ytdNet + selectedTotals.ytdAdjustments,
                    selectedTotals.currency,
                  )
                : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Full {reporting.selectedYear} cumulative</p>
          </button>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <p className="text-xs font-medium text-zinc-500">Settled payouts volume</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
              {fmt(data.summary.totalPaidVolume, selectedTotals?.currency || "SAR")}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">{data.summary.totalPaidCount} verified payout transfers</p>
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
      <div className="grid gap-8 lg:grid-cols-2">
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
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-950">
              Earnings reports
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Monthly and annual earnings statements
            </p>
          </div>
          <Link
            href={scopedHref("/host/earnings/reports")}
            className="text-sm font-semibold underline underline-offset-4"
          >
            View all
          </Link>
        </div>

        {reporting.reports.length ? (
          <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {reporting.reports.map((report) => (
              <Link
                key={`${report.year}-${report.month}`}
                href={scopedHref(
                  `/host/earnings/reports/monthly/${report.year}/${report.month}`,
                )}
                className="flex items-center justify-between px-5 py-4 first:rounded-t-2xl last:rounded-b-2xl hover:bg-zinc-50"
              >
                <span className="font-semibold text-zinc-900">
                  {report.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-zinc-950">
                    {fmt(report.amount, report.currency)}
                  </span>
                  <span className="text-lg text-zinc-400">›</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No completed-stay earnings this year.
          </p>
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
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">{title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        </div>
        <Link
          href={href}
          className="text-sm font-semibold underline underline-offset-4"
        >
          View all
        </Link>
      </div>

      <div className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
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
              className="flex w-full items-center gap-3 px-4 py-4 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-zinc-50"
            >
              {/* Listing photo */}
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-[10px] font-semibold text-zinc-400">
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
                  "🏠"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900">
                  {fmtDate(
                    paid
                      ? item.executionDetails?.executedAt
                      : item.scheduledPayoutDate,
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {item.listingTitle}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-zinc-950">
                  {fmt(item.netPayout, item.currency)}
                </p>
                <span
                  className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${payoutStatusStyle(item.status)}`}
                >
                  {payoutStatusLabel(item.status)}
                </span>
              </div>
              <span className="text-lg text-zinc-300">›</span>
            </Link>
          ))
        ) : (
          <p className="px-5 py-6 text-sm text-zinc-500">{empty}</p>
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
      className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="ytd-title" className="text-xl font-bold text-zinc-950">
              Year-to-date summary
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              January 1 –{" "}
              {year === new Date().getUTCFullYear() ? "today" : "December 31"},{" "}
              {year}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close summary"
            className="rounded-full p-2 text-xl text-zinc-400 hover:bg-zinc-100"
          >
            ×
          </button>
        </div>
        <div className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {rows.map(([rowLabel, amount]) => (
            <div key={rowLabel} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-zinc-600">{rowLabel}</span>
              <span className={amount < 0 ? "text-rose-700" : "text-zinc-900"}>
                {amount < 0 ? "−" : ""}
                {fmt(Math.abs(amount), totals.currency)}
              </span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-4 font-bold">
            <span>Total ({totals.currency})</span>
            <span>
              {fmt(totals.ytdNet + totals.ytdAdjustments, totals.currency)}
            </span>
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-zinc-400">
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
      className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="payout-title" className="text-xl font-bold text-zinc-950">
              Payout details
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
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
          <p className="text-3xl font-bold text-zinc-950">
            {fmt(payout.netPayout, payout.currency)}
          </p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${payoutStatusStyle(payout.status)}`}
          >
            {payoutStatusLabel(payout.status)}
          </span>
        </div>

        <div className="mt-6 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 text-sm">
          <div className="flex justify-between px-4 py-3">
            <span className="text-zinc-600">Gross earnings</span>
            <span className="font-semibold text-zinc-900">
              {fmt(payout.grossEarnings, payout.currency)}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-zinc-600">Host service fee</span>
            <span className="text-rose-700">
              −{fmt(payout.platformFee, payout.currency)}
            </span>
          </div>
          {payout.deductions > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-zinc-600">Deductions</span>
              <span className="text-rose-700">
                −{fmt(payout.deductions, payout.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-4 py-4 font-bold">
            <span>Net payout</span>
            <span>{fmt(payout.netPayout, payout.currency)}</span>
          </div>
        </div>

        <div className="mt-5 space-y-1.5 text-sm text-zinc-600">
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
          className="mt-5 block text-center rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
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
      className="fixed inset-0 z-50 flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4"
    >
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <h2 id="methods-title" className="text-xl font-bold text-zinc-950">
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
                    <p className="font-bold text-zinc-900">{method.bankName}</p>
                    <p className="mt-0.5 font-mono text-sm text-zinc-600">
                      {method.ibanMasked}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {method.accountHolderName} ·{" "}
                      {method.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-3 flex gap-4 text-sm font-semibold">
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
            <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
              No payout methods added yet.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="mt-5 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
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
    <label className="block text-sm font-semibold text-zinc-700">
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
      className="fixed inset-0 z-[60] flex items-end bg-black/45 sm:items-center sm:justify-center sm:p-4"
    >
      <form
        onSubmit={onSubmit}
        className="w-full rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <h2 id="add-method-title" className="text-xl font-bold text-zinc-950">
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
          className="mt-6 w-full rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save payout method"}
        </button>
      </form>
    </ModalOverlay>
  );
}
