"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { HostDashboardData } from "@/services/host-dashboard.service";
import type { ListingDTO } from "@/services/mappers";
import { useLanguage, type TranslationKey } from "@/lib/i18n/language-context";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

interface HostKpiOverviewProps {
  initialData?: HostDashboardData | null;
  appliedPropertyId?: string | null;
  listings?: ListingDTO[];
  onSelectBookingId?: (bookingId: string) => void;
}

const primaryKpiGridClass =
  "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4";
const secondaryKpiGridClass =
  "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
const cardClass =
  "flex flex-col justify-between rounded-[12px] border border-white bg-[#F3F4F5] shadow-[0_2px_4px_0px_#00000040]";
const insetSurfaceClass = "rounded-[10px] bg-white";
function dashboardScopeKey(
  listingId: string | null | undefined,
  period: string = "this_month",
  startDate?: string | null,
  endDate?: string | null,
  currency?: string | null,
) {
  return `${listingId ?? "all-properties"}:${period}:${startDate ?? ""}:${endDate ?? ""}:${currency ?? ""}`;
}

function formatCurrency(cents: number, currency = "SAR") {
  return `${currency} ${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

type DashboardTranslation = (key: string, fallback?: string) => string;

function formatResponseTime(minutes: number | null, t: DashboardTranslation) {
  if (minutes === null) return t("host_dash_no_inquiries", "No inquiries yet");
  if (minutes < 60) return `${minutes} ${t("host_dash_time_min", "min")}`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins
    ? `${hours}${t("host_dash_time_h", "h")} ${remainingMins}${t("host_dash_time_m", "m")}`
    : `${hours}${t("host_dash_time_h", "h")}`;
}

const DATE_PRESETS: Array<{ id: DateRangePreset; labelKey: string; fallback: string }> = [
  { id: "this_month", labelKey: "host_dash_filter_this_month", fallback: "This month" },
  { id: "last_month", labelKey: "host_dash_filter_last_month", fallback: "Last month" },
  { id: "last_30_days", labelKey: "host_dash_filter_last_30_days", fallback: "Last 30 days" },
  { id: "year_to_date", labelKey: "host_dash_filter_year_to_date", fallback: "Year to date" },
  { id: "custom", labelKey: "host_dash_filter_custom", fallback: "Custom range" },
];

export function HostKpiOverview({
  initialData,
  appliedPropertyId,
  listings = [],
  onSelectBookingId,
}: HostKpiOverviewProps) {
  const { t: rawT } = useLanguage();
  const t: DashboardTranslation = (key, fallback) => rawT(key as TranslationKey, fallback) || fallback || "";

  const [data, setData] = useState<HostDashboardData | null>(initialData || null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    appliedPropertyId || initialData?.filterListingId || null,
  );
  const [selectedPeriod, setSelectedPeriod] = useState<DateRangePreset>(
    initialData?.reportingPeriod?.preset || "this_month",
  );
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    initialData?.filterCurrency || "",
  );
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [loading, setLoading] = useState(() => !initialData);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const [dataScopeKey, setDataScopeKey] = useState(() =>
    dashboardScopeKey(
      appliedPropertyId || initialData?.filterListingId,
      initialData?.reportingPeriod?.preset || "this_month",
      undefined,
      undefined,
      initialData?.filterCurrency,
    ),
  );

  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  const propertyDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialMount = useRef(true);
  const requestIdRef = useRef(0);

  // Sync initial query params from URL if on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const urlPropertyId = search.get("propertyId") || search.get("listingId");
    const urlPeriod = search.get("period") as DateRangePreset | null;
    const urlStart = search.get("startDate");
    const urlEnd = search.get("endDate");
    const urlCurrency = search.get("currency");

    const timer = window.setTimeout(() => {
      if (urlPropertyId) setSelectedPropertyId((current) => current === urlPropertyId ? current : urlPropertyId);
      if (urlPeriod) setSelectedPeriod((current) => current === urlPeriod ? current : urlPeriod);
      if (urlStart) setCustomStartDate(urlStart);
      if (urlEnd) setCustomEndDate(urlEnd);
      if (urlCurrency) setSelectedCurrency((current) => current === urlCurrency ? current : urlCurrency);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Update browser URL query params without reloading
  const updateUrlHistory = (
    propId: string | null,
    period: DateRangePreset,
    start?: string,
    end?: string,
    currency?: string,
  ) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (propId) url.searchParams.set("propertyId", propId);
    else {
      url.searchParams.delete("propertyId");
      url.searchParams.delete("listingId");
    }

    if (period && period !== "this_month") url.searchParams.set("period", period);
    else url.searchParams.delete("period");

    if (period === "custom" && start && end) {
      url.searchParams.set("startDate", start);
      url.searchParams.set("endDate", end);
    } else {
      url.searchParams.delete("startDate");
      url.searchParams.delete("endDate");
    }
    if (currency) url.searchParams.set("currency", currency);
    else url.searchParams.delete("currency");

    window.history.replaceState({}, "", url.toString());
  };

  useEffect(() => {
    const scopeKey = dashboardScopeKey(
      selectedPropertyId,
      selectedPeriod,
      selectedPeriod === "custom" ? customStartDate : undefined,
      selectedPeriod === "custom" ? customEndDate : undefined,
      selectedCurrency,
    );

    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialData) {
        return;
      }
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedPropertyId) params.set("propertyId", selectedPropertyId);
    if (selectedPeriod) params.set("period", selectedPeriod);
    if (selectedPeriod === "custom" && customStartDate && customEndDate) {
      params.set("startDate", customStartDate);
      params.set("endDate", customEndDate);
    }
    if (selectedCurrency) params.set("currency", selectedCurrency);

    const query = params.toString() ? `?${params.toString()}` : "";

    fetch(`/api/v1/host/dashboard${query}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.message ||
              t("host_dash_could_not_load", "Could not load performance metrics"),
          );
        }
        return res.json();
      })
      .then((payload) => {
        if (requestId !== requestIdRef.current || !payload?.success || !payload?.data) return;
        setData(payload.data);
        if (payload.data.filterCurrency && payload.data.filterCurrency !== selectedCurrency) {
          setSelectedCurrency(payload.data.filterCurrency);
        }
        setDataScopeKey(scopeKey);
      })
      .catch((err) => {
        if (requestId === requestIdRef.current && err.name !== "AbortError") {
          setError(
            err.message ||
              t("host_dash_could_not_load", "Could not load performance metrics"),
          );
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });

    return () => controller.abort();
    // `initialData` is deliberately only used to avoid the first duplicate request;
    // filter changes (rather than incoming server props) are the refresh contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, selectedPeriod, customStartDate, customEndDate, selectedCurrency, reloadVersion]);

  const kpis = data?.kpis;
  const propertyOptions =
    listings.length > 0
      ? listings.map((listing) => ({ id: listing.id, title: listing.title }))
      : (initialData?.listingHealth.listings ?? data?.listingHealth.listings ?? []).map(
          (listing) => ({
            id: listing.listingId,
            title: listing.title,
          }),
        );
  const currentListing = selectedPropertyId
    ? propertyOptions.find((listing) => listing.id === selectedPropertyId)
    : null;
  const selectedScopeKey = dashboardScopeKey(
    selectedPropertyId,
    selectedPeriod,
    selectedPeriod === "custom" ? customStartDate : undefined,
    selectedPeriod === "custom" ? customEndDate : undefined,
    selectedCurrency,
  );
  const isRefreshing = loading || dataScopeKey !== selectedScopeKey;

  // Dropdown dismiss handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        propertyDropdownRef.current &&
        !propertyDropdownRef.current.contains(event.target as Node)
      ) {
        setPropertyDropdownOpen(false);
      }
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target as Node)
      ) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProperty = (propertyId: string | null) => {
    setSelectedPropertyId(propertyId);
    setPropertyDropdownOpen(false);
    updateUrlHistory(propertyId, selectedPeriod, customStartDate, customEndDate, selectedCurrency);
  };

  const handleSelectPeriod = (period: DateRangePreset) => {
    setDateDropdownOpen(false);
    if (period === "custom") {
      setShowCustomModal(true);
      return;
    }
    setSelectedPeriod(period);
    updateUrlHistory(selectedPropertyId, period, undefined, undefined, selectedCurrency);
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartDate && customEndDate && customStartDate <= customEndDate) {
      setSelectedPeriod("custom");
      setShowCustomModal(false);
      updateUrlHistory(selectedPropertyId, "custom", customStartDate, customEndDate, selectedCurrency);
    }
  };

  const retryPropertyAnalytics = () => {
    setReloadVersion((prev) => prev + 1);
  };

  const handleSelectCurrency = (currency: string) => {
    setSelectedCurrency(currency);
    updateUrlHistory(
      selectedPropertyId,
      selectedPeriod,
      selectedPeriod === "custom" ? customStartDate : undefined,
      selectedPeriod === "custom" ? customEndDate : undefined,
      currency,
    );
  };

  if (loading && !data) {
    return <HostDashboardOverviewSkeleton />;
  }

  if (error && !data) {
    return (
      <section
        role="alert"
        aria-live="polite"
        className="mx-auto mb-10 w-full rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 font-sans"
      >
        <p className="font-semibold text-base">{t("host_dash_load_failed", "Unable to load dashboard")}</p>
        <p className="mt-1 text-[#727272]">{error}</p>
        <button
          type="button"
          onClick={retryPropertyAnalytics}
          className="mt-4 inline-flex items-center rounded-full bg-[#1F1F1F] px-4 py-2 text-xs font-medium text-white transition hover:bg-black"
        >
          {t("host_dash_retry", "Retry")}
        </button>
      </section>
    );
  }

  if (!kpis || !data) return null;

  const {
    earnings,
    guestAnalytics,
    guestFavoriteSummary,
    listingHealth,
    reviews,
    superhostEvaluation,
    thisMonthSnapshot,
  } = data;

  const selectedHealthListing = selectedPropertyId
    ? listingHealth.listings.find((listing) => listing.listingId === selectedPropertyId)
    : listingHealth.listings[0];
  const selectedFavorite = selectedPropertyId
    ? guestFavoriteSummary.find((listing) => listing.listingId === selectedPropertyId)
    : guestFavoriteSummary[0];
  const officialGuestFavorites = guestFavoriteSummary.filter((listing) => listing.officialStatus).length;

  const activePeriodConfig = DATE_PRESETS.find((p) => p.id === selectedPeriod) || DATE_PRESETS[0];
  const earningsHref = (() => {
    const params = new URLSearchParams();
    if (selectedPropertyId) params.set("propertyId", selectedPropertyId);
    if (selectedCurrency) params.set("currency", selectedCurrency);
    const query = params.toString();
    return `/host/earnings${query ? `?${query}` : ""}`;
  })();

  return (
    <section
      aria-label={t("host_dash_aria_summary", "Host performance and earnings summary")}
      className="mx-auto mb-10 w-full font-sans"
    >
      {/* Header and Controls */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#1F1F1F]/10 pb-5 sm:mb-8">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#727272]">
              {t("host_dash_subhead", "Hosting dashboard")}
            </p>
            {data.isAccountInGoodStanding && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                {t("host_dash_good_standing", "Good standing")}
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1F1F1F] sm:text-3xl">
            {t("host_dash_header_title", "Performance overview")}
          </h1>
          <p className="mt-1 text-sm text-[#727272]">
            {currentListing ? currentListing.title : t("host_dash_all_properties", "All properties")} ·{" "}
            <span className="font-medium text-[#1F1F1F]">{data.reportingPeriod.label}</span>
          </p>
        </div>

        {/* Filter Controls: Property and Reporting Period */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Property Selector Dropdown */}
          {propertyOptions.length > 1 && (
            <div ref={propertyDropdownRef} className="relative">
              <button
                type="button"
                aria-label="Filter dashboard by property"
                aria-expanded={propertyDropdownOpen}
                aria-haspopup="listbox"
                onClick={() => setPropertyDropdownOpen((prev) => !prev)}
                className="inline-flex h-10 min-w-36 max-w-[240px] items-center justify-between gap-2 rounded-full border border-zinc-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-[#1F1F1F] hover:border-zinc-500 transition-colors cursor-pointer outline-none shadow-2xs"
              >
                <span className="truncate">
                  {currentListing ? currentListing.title : t("host_dash_all_properties", "All properties")}
                </span>
                <svg
                  className={`size-3.5 shrink-0 text-[#727272] transition-transform duration-200 ${
                    propertyDropdownOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {propertyDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Filter dashboard by property"
                  className="visible-scrollbar absolute right-0 top-full z-50 mt-1.5 min-w-52 max-w-xs w-max max-h-72 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedPropertyId === null}
                    onClick={() => handleSelectProperty(null)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                      selectedPropertyId === null
                        ? "bg-[#FDE29B] font-medium text-[#1F1F1F]"
                        : "text-[#1F1F1F] hover:bg-[#F3F4F6]"
                    }`}
                  >
                    <span className="truncate">{t("host_dash_all_properties", "All properties")}</span>
                    {selectedPropertyId === null && (
                      <svg className="size-4 shrink-0 text-[#1F1F1F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                  {propertyOptions.map((listing) => {
                    const isSelected = selectedPropertyId === listing.id;
                    return (
                      <button
                        key={listing.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectProperty(listing.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#FDE29B] font-medium text-[#1F1F1F]"
                            : "text-[#1F1F1F] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        <span className="truncate">{listing.title}</span>
                        {isSelected && (
                          <svg className="size-4 shrink-0 text-[#1F1F1F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Date Range Filter Dropdown */}
          <div ref={dateDropdownRef} className="relative">
            <button
              type="button"
              aria-label="Filter dashboard by date range"
              aria-expanded={dateDropdownOpen}
              aria-haspopup="listbox"
              onClick={() => setDateDropdownOpen((prev) => !prev)}
              className="inline-flex h-10 min-w-32 items-center justify-between gap-2 rounded-full border border-zinc-300 bg-white px-3.5 text-xs sm:text-sm font-medium text-[#1F1F1F] hover:border-zinc-500 transition-colors cursor-pointer outline-none shadow-2xs"
            >
              <span className="truncate">{t(activePeriodConfig.labelKey, activePeriodConfig.fallback)}</span>
              <svg
                className={`size-3.5 shrink-0 text-[#727272] transition-transform duration-200 ${
                  dateDropdownOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {dateDropdownOpen && (
              <div
                role="listbox"
                aria-label="Filter dashboard by date range"
                className="visible-scrollbar absolute right-0 top-full z-50 mt-1.5 w-48 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl"
              >
                {DATE_PRESETS.map((preset) => {
                  const isSelected = selectedPeriod === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectPeriod(preset.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#FDE29B] font-medium text-[#1F1F1F]"
                          : "text-[#1F1F1F] hover:bg-[#F3F4F6]"
                      }`}
                    >
                      <span>{t(preset.labelKey, preset.fallback)}</span>
                      {isSelected && (
                        <svg className="size-4 shrink-0 text-[#1F1F1F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {data.availableCurrencies.length > 1 && (
            <label className="sr-only" htmlFor="dashboard-currency">Settlement currency</label>
          )}
          {data.availableCurrencies.length > 1 && (
            <select
              id="dashboard-currency"
              aria-label="Filter dashboard by settlement currency"
              value={selectedCurrency || data.filterCurrency}
              onChange={(event) => handleSelectCurrency(event.target.value)}
              className="h-10 rounded-full border border-zinc-300 bg-white px-3.5 text-xs font-medium text-[#1F1F1F] shadow-2xs outline-none hover:border-zinc-500 sm:text-sm"
            >
              {data.availableCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          )}

          {loading && (
            <span
              role="status"
              aria-label={t("host_dash_updating_aria", "Updating property analytics")}
              className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700"
            />
          )}
        </div>
      </header>



      {error && dataScopeKey !== selectedScopeKey && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          <span>{t("host_dash_error_refresh", "Couldn’t refresh analytics for this property.")}</span>
          <button
            type="button"
            onClick={retryPropertyAnalytics}
            className="font-medium underline underline-offset-2"
          >
            {t("host_dash_retry", "Retry")}
          </button>
        </div>
      )}

      {/* Primary KPI Grid (4 Cards with Deep Navigation Links) */}
      <div className={primaryKpiGridClass}>
        <PrimaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_monthly_earnings", "Monthly earnings")}
          period={kpis.monthlyEarnings.periodLabel}
          value={formatCurrency(kpis.monthlyEarnings.amountCents, kpis.monthlyEarnings.currency)}
          detail={
            kpis.monthlyEarnings.changePercentage === null
              ? t("host_dash_kpi_completed_stays_month", "Completed stays this month")
              : `${kpis.monthlyEarnings.changePercentage >= 0 ? "↑" : "↓"} ${Math.abs(kpis.monthlyEarnings.changePercentage)}% ${t("host_dash_kpi_vs_last_month", "vs last month")}`
          }
          detailTone={
            kpis.monthlyEarnings.changePercentage === null
              ? undefined
              : kpis.monthlyEarnings.changePercentage >= 0
                ? "positive"
                : "negative"
          }
          href={earningsHref}
        />
        <PrimaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_ytd_earnings", "Year-to-date earnings")}
          period={kpis.ytdEarnings.periodLabel}
          value={formatCurrency(kpis.ytdEarnings.amountCents, kpis.ytdEarnings.currency)}
          detail={t("host_dash_kpi_completed_stay_payouts", "Completed stay payouts")}
          href={earningsHref}
        />
        <PrimaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_upcoming_payouts", "Upcoming payouts")}
          period={`${kpis.upcomingPayout.count} ${kpis.upcomingPayout.count === 1 ? t("host_dash_reservation_singular", "reservation") : t("host_dash_reservation_plural", "reservations")}`}
          value={formatCurrency(kpis.upcomingPayout.totalUpcomingAmountCents, kpis.upcomingPayout.currency)}
          detail={
            kpis.upcomingPayout.nextPayoutAmountCents === null
              ? t("host_dash_no_upcoming_payout", "No eligible upcoming payout")
              : `${t("host_dash_next_label", "Next:")} ${formatCurrency(kpis.upcomingPayout.nextPayoutAmountCents, kpis.upcomingPayout.currency)}`
          }
          href={earningsHref}
        />
        <PrimaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_occupancy", "Occupancy")}
          period={kpis.occupancy.periodLabel}
          value={`${kpis.occupancy.ratePercentage}%`}
          detail={`${kpis.occupancy.bookedNights} ${t("host_dash_booked_of", "booked of")} ${kpis.occupancy.totalBookableNights} ${t("host_dash_nights", "nights")}`}
          progress={kpis.occupancy.ratePercentage}
          href="/host/insights?tab=stats"
        />
      </div>

      {/* Secondary KPI Grid (5 Cards with Deep Navigation Links) */}
      <div className={`mt-3 ${secondaryKpiGridClass}`}>
        <SecondaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_booked_vs_available", "Booked vs available")}
          value={`${kpis.occupancy.bookedNights} / ${kpis.occupancy.availableNights}`}
          detail={`${kpis.occupancy.blockedNights} ${t("host_dash_blocked_nights", "blocked nights")} · ${kpis.occupancy.periodLabel}`}
          href="/host/calendar"
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_avg_booking_val", "Avg booking value")}
          value={kpis.averageBookingValue.hostPayoutCents === null ? "—" : formatCurrency(kpis.averageBookingValue.hostPayoutCents, kpis.averageBookingValue.currency)}
          detail={kpis.averageBookingValue.completedBookingsCount > 0
            ? t("host_dash_kpi_net_payout_stay", "Net payout per stay")
            : t("host_dash_no_eligible_completed_stays", "No eligible completed stays")}
          href={earningsHref}
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_avg_stay", "Avg stay")}
          value={kpis.averageStayLength.completedStaysCount > 0
            ? `${kpis.averageStayLength.nights} ${kpis.averageStayLength.nights === 1 ? t("host_dash_night_singular", "night") : t("host_dash_night_plural", "nights")}`
            : "—"}
          detail={kpis.averageStayLength.completedStaysCount > 0
            ? t("host_dash_kpi_completed_stays", "Completed stays")
            : t("host_dash_no_completed_stays", "No completed stays")}
          href="/host/today"
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_cancel_rate", "Cancellation rate")}
          value={`${kpis.cancellationRate.overallPercentage}%`}
          detail={`${t("host_dash_kpi_host_prefix", "Host:")} ${kpis.cancellationRate.hostPercentage}% · ${kpis.cancellationRate.periodLabel}`}
          href="/host/resolution-center"
        />
        <SecondaryKpi
          refreshing={isRefreshing}
          label={t("host_dash_kpi_guest_rating", "Guest rating")}
          value={kpis.averageRating.overallRating === null ? "—" : `★ ${kpis.averageRating.overallRating.toFixed(2)}`}
          detail={`${kpis.averageRating.totalReviewsCount} ${kpis.averageRating.totalReviewsCount === 1 ? t("host_dash_review_singular", "review") : t("host_dash_review_plural", "reviews")}`}
          href="/host/insights?tab=reviews"
        />
      </div>

      {/* This Month Snapshot Section (Phase 2 Section 3) */}
      <section className={`mt-4 ${cardClass} p-4 sm:p-5`} aria-labelledby="this-month-snapshot-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="this-month-snapshot-heading" className="text-base font-semibold text-[#1F1F1F]">
              {t("host_dash_this_month_snapshot_title", "This month snapshot")}
            </h2>
            <p className="mt-0.5 text-xs text-[#727272]">
              {thisMonthSnapshot.periodLabel}
            </p>
          </div>
          <span className="rounded-full bg-white border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 shadow-2xs">
            {t("host_dash_activity_summary", "Activity overview")}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 border-t border-[#1F1F1F]/10 pt-4">
          <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
            <p className="text-xs font-medium text-[#727272]">{t("host_dash_bookings_this_month", "Bookings this month")}</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1F1F]">{thisMonthSnapshot.bookingsCount}</p>
            <p className="mt-1 text-xs text-[#727272]">
              {thisMonthSnapshot.bookingsChangePercentage === null
                ? t("host_dash_no_prev_bookings", "No prior month comparison")
                : `${thisMonthSnapshot.bookingsChangePercentage >= 0 ? "↑" : "↓"} ${Math.abs(thisMonthSnapshot.bookingsChangePercentage)}% ${t("host_dash_kpi_vs_last_month", "vs last month")}`}
            </p>
          </div>
          <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
            <p className="text-xs font-medium text-[#727272]">{t("host_dash_cancellations_this_month", "Cancellations")}</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1F1F]">{thisMonthSnapshot.cancellationsCount}</p>
            <p className="mt-1 text-xs text-[#727272]">
              {thisMonthSnapshot.cancellationRatePercentage}% {t("host_dash_monthly_cancel_rate", "cancellation rate")}
            </p>
          </div>
          <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
            <p className="text-xs font-medium text-[#727272]">{t("host_dash_avg_stay_this_month", "Average stay length")}</p>
            <p className="mt-2 text-2xl font-semibold text-[#1F1F1F]">
              {thisMonthSnapshot.averageStayNights} {t("host_dash_nights", "nights")}
            </p>
            <p className="mt-1 text-xs text-[#727272]">
              {thisMonthSnapshot.previousMonthAverageStayNights > 0
                ? `${t("host_dash_prev_month_was", "Prior month:")} ${thisMonthSnapshot.previousMonthAverageStayNights} ${t("host_dash_nights", "nights")}`
                : t("host_dash_completed_stays_context", "Completed stays")}
            </p>
          </div>
        </div>
      </section>

      {/* Upcoming Payout Details Card (Phase 2 Section 7) */}
      <section className={`mt-4 ${cardClass} p-4 sm:p-5`} aria-labelledby="upcoming-payout-details-heading">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 id="upcoming-payout-details-heading" className="text-base font-semibold text-[#1F1F1F]">
              {t("host_dash_upcoming_payout_title", "Upcoming payout")}
            </h2>
            <p className="mt-0.5 text-xs text-[#727272]">
              {t("host_dash_upcoming_payout_subtitle", "Verified and scheduled host earnings.")}
            </p>
          </div>
          <Link
            href={earningsHref}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#1F1F1F] px-4 py-2 text-xs font-medium text-white transition hover:bg-black"
          >
            <span>{t("host_dash_view_payouts_ledger", "View earnings ledger")}</span>
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
        </div>

        {kpis.upcomingPayout.nextPayoutAmountCents !== null ? (
          <div className="mt-4 grid gap-3 border-t border-[#1F1F1F]/10 pt-4 sm:grid-cols-3">
            <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
              <p className="text-xs text-[#727272]">{t("host_dash_next_payout_amount", "Next payout amount")}</p>
              <p className="mt-1 text-2xl font-bold text-[#1F1F1F]">
                {formatCurrency(kpis.upcomingPayout.nextPayoutAmountCents, kpis.upcomingPayout.currency)}
              </p>
              <div className="mt-2.5">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  {kpis.upcomingPayout.nextPayoutStatus || "SCHEDULED"}
                </span>
              </div>
            </div>
            <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
              <p className="text-xs text-[#727272]">{t("host_dash_settlement_status", "Settlement status")}</p>
              <p className="mt-1.5 text-sm font-semibold text-[#1F1F1F]">
                {kpis.upcomingPayout.nextPayoutExpectedArrival || "Settlement timing pending confirmation"}
              </p>
              <p className="mt-1 text-xs text-[#727272]">
                {kpis.upcomingPayout.nextEligibleStayStartDate
                  ? `Stay check-in: ${kpis.upcomingPayout.nextEligibleStayStartDate}`
                  : "Upon check-in"}
              </p>
            </div>
            <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
              <p className="text-xs text-[#727272]">{t("host_dash_payment_method", "Payout method")}</p>
              <p className="mt-1.5 text-sm font-semibold text-[#1F1F1F]">
                {kpis.upcomingPayout.nextPayoutMethodMasked || t("host_dash_no_payout_method", "No payout method configured")}
              </p>
              <p className="mt-1 text-xs text-[#727272] truncate">
                {kpis.upcomingPayout.nextPayoutListingTitle
                  ? `${kpis.upcomingPayout.nextPayoutListingTitle} (${kpis.upcomingPayout.nextPayoutGuestName})`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 border-t border-[#1F1F1F]/10 pt-4 text-sm text-[#727272]">
            <p>
              {t(
                "host_dash_no_upcoming_payout_desc",
                "No outstanding payouts are scheduled at this time. Settlement timing is confirmed by the payout provider.",
              )}
            </p>
          </div>
        )}
      </section>

      {/* Detailed Earnings Collapsible Accordion */}
      <details className={`group mt-4 ${cardClass} px-4 py-3.5 sm:px-5`}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-base font-medium text-[#1F1F1F] sm:items-center sm:gap-4 [&::-webkit-details-marker]:hidden">
          <span>{t("host_dash_detailed_earnings", "Detailed earnings")}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-normal text-[#727272] sm:gap-3">
            {isRefreshing ? (
              <span className="h-3 w-28 animate-pulse rounded bg-zinc-100" />
            ) : (
              <span className="hidden min-[400px]:inline">
                {t("host_dash_net_payout", "Net payout")}{" "}
                {formatCurrency(earnings.itemizedBreakdown.netHostPayoutCents, earnings.currency)}
              </span>
            )}
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-xl shadow-sm transition-all duration-200 group-open:rotate-45 group-hover:bg-[#1F1F1F] group-hover:text-white">
              +
            </span>
          </span>
        </summary>
        <div className="mt-3 border-t border-[#1F1F1F]/10 pt-4">
          {isRefreshing ? (
            <EarningsDetailsSkeleton />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [t("host_dash_fee_accommodation", "Accommodation"), earnings.itemizedBreakdown.accommodationSubtotalCents],
                  [t("host_dash_fee_cleaning", "Cleaning fees"), earnings.itemizedBreakdown.cleaningFeeCents],
                  [t("host_dash_fee_extra_guest", "Extra guest fees"), earnings.itemizedBreakdown.extraGuestFeeCents],
                  [t("host_dash_fee_pet", "Pet fees"), earnings.itemizedBreakdown.petFeeCents],
                  [t("host_dash_fee_service", "Host service fee"), -earnings.itemizedBreakdown.hostServiceFeeCents],
                  [t("host_dash_fee_taxes", "Host-collected taxes"), earnings.itemizedBreakdown.taxesCollectedForHostCents],
                ].map(([label, amount]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-[#727272]">{label}</dt>
                    <dd className="mt-0.5 font-medium text-[#1F1F1F]">
                      {formatCurrency(Number(amount), earnings.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-[#727272]">
                {t("host_dash_recorded_refunds", "Recorded refunds:")}{" "}
                {formatCurrency(earnings.refunds.amountCents, earnings.currency)} ({earnings.refunds.count}) ·{" "}
                {t("host_dash_payment_pending_excluded", "Payment-pending bookings excluded:")}{" "}
                {earnings.bookingsExcludedForPaymentStatusCount} · {t("host_dash_adjustments", "Adjustments:")}{" "}
                {earnings.adjustments.status === "DATA_UNAVAILABLE"
                  ? t("host_dash_adj_unavailable", "unavailable")
                  : t("host_dash_adj_recorded", "recorded")}
              </p>
            </>
          )}
        </div>
      </details>

      {/* Actionable Recommendations (Deterministic, non-AI) */}
      {data.recommendations.length > 0 && (
        <section className={`mt-6 ${cardClass} p-4 sm:p-5`} aria-labelledby="host-recommendations-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="host-recommendations-heading" className="text-lg font-medium tracking-[-0.02em] text-[#1F1F1F]">
                {t("host_dash_actionable_insights", "Actionable insights")}
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#727272]">
                {t(
                  "host_dash_insights_disclaimer",
                  "Grounded operational signals from your stored listings, reservations, reviews, and messages. No projected revenue or market data is inferred.",
                )}
              </p>
            </div>
            {isRefreshing ? (
              <span className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
            ) : (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#1F1F1F] shadow-2xs border border-zinc-200">
                {data.recommendations.length}{" "}
                {data.recommendations.length === 1
                  ? t("host_dash_action_needed_singular", "action needed")
                  : t("host_dash_action_needed_plural", "actions needed")}
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-3 border-t border-[#1F1F1F]/10 pt-4 md:grid-cols-2">
            {isRefreshing ? (
              <RecommendationSkeleton />
            ) : (
              data.recommendations.map((rec) => (
                <article
                  key={rec.id}
                  className={`${insetSurfaceClass} flex flex-col justify-between p-4 border border-zinc-100 shadow-2xs transition-shadow hover:shadow-sm`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#1F1F1F]">{rec.title}</h3>
                      <PriorityBadge priority={rec.priority} />
                    </div>
                    <p className="mt-2 text-xs text-[#727272] leading-relaxed">{rec.description}</p>
                  </div>
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <Link
                      href={rec.actionHref}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F1F1F] hover:underline"
                    >
                      <span>{rec.actionLabel}</span>
                      <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* Upcoming Reservations Section (Phase 2 Section 4) */}
      <section className={`mt-4 ${cardClass} p-4 sm:p-5`} aria-labelledby="upcoming-reservation-heading">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="upcoming-reservation-heading" className="text-base font-semibold text-[#1F1F1F]">
              {t("host_dash_upcoming_res_title", "Upcoming reservation")}
            </h2>
            <p className="mt-0.5 text-xs text-[#727272]">
              {t("host_dash_upcoming_res_subtitle", "Next confirmed reservations in this property scope.")}
            </p>
          </div>
          <Link
            href="/host/today?tab=upcoming"
            className="shrink-0 rounded-full bg-[#FCDF9C] px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-[#1F1F1F] hover:text-white"
          >
            {t("host_dash_view_all_reservations", "View all bookings")}
          </Link>
        </div>

        {isRefreshing ? (
          <ReservationSkeleton />
        ) : kpis.nextUpcomingReservation ? (
          <div className="space-y-3">
            <UpcomingReservation
              reservation={kpis.nextUpcomingReservation}
              onSelectBookingId={onSelectBookingId}
            />
            {kpis.upcomingReservations && kpis.upcomingReservations.length > 1 && (
              <div className="mt-4 border-t border-zinc-100 pt-3">
                <p className="text-xs font-semibold text-[#727272] mb-2">
                  {t("host_dash_other_upcoming", "Other upcoming reservations:")}
                </p>
                <div className="space-y-2">
                  {kpis.upcomingReservations.slice(1, 4).map((res) => (
                    <div
                      key={res.id}
                      className="flex items-center justify-between rounded-xl bg-white p-3 border border-zinc-100 shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-[#1F1F1F] truncate">
                          {res.guestName} · <span className="font-normal text-[#727272]">{res.listingTitle}</span>
                        </p>
                        <p className="text-xs text-[#727272]">
                          {res.startDate} – {res.endDate} ({res.nights} {res.nights === 1 ? "night" : "nights"})
                        </p>
                      </div>
                      <Link
                        href={`/host/bookings/${res.id}`}
                        onClick={() => onSelectBookingId?.(res.id)}
                        className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-[#1F1F1F] hover:border-zinc-500"
                      >
                        {t("host_dash_btn_details", "Details")}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 border-t border-zinc-100 pt-4 text-sm text-[#727272]">
            {t("host_dash_no_upcoming_reservations", "No upcoming reservations scheduled. Manage availability in the")}{" "}
            <Link href="/host/calendar" className="font-medium underline underline-offset-2 text-[#1F1F1F]">
              {t("host_dash_host_calendar_link", "Host Calendar")}
            </Link>
            .
          </p>
        )}
      </section>

      {/* Guest Information Section (Phase 2 Section 5) */}
      <section className={`mt-4 ${cardClass} p-4 sm:p-5`} aria-labelledby="guest-information-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="guest-information-heading" className="text-lg font-medium tracking-[-0.02em] text-[#1F1F1F]">
              {t("host_dash_guest_insights_title", "Guest insights")}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#727272]">
              {t("host_dash_guest_insights_subtitle", "Completed stays over the last 6 months.")}
            </p>
          </div>
          {isRefreshing ? (
            <span className="h-3 w-24 animate-pulse rounded bg-zinc-100" />
          ) : (
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-[#727272]">
              {guestAnalytics.completedGuestStaysCount}{" "}
              {guestAnalytics.completedGuestStaysCount === 1
                ? t("host_dash_stay_singular", "stay")
                : t("host_dash_stay_plural", "stays")}{" "}
              ({guestAnalytics.uniqueGuestsCount}{" "}
              {guestAnalytics.uniqueGuestsCount === 1
                ? t("host_dash_guest_singular", "guest")
                : t("host_dash_guest_plural", "guests")})
            </span>
          )}
        </div>

        {isRefreshing ? (
          <GuestInsightsSkeleton />
        ) : (
          <div className="mt-4 grid gap-4 border-t border-[#1F1F1F]/10 pt-4 lg:grid-cols-2">
            {/* Guest Origins */}
            <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1F1F1F]">
                    {t("host_dash_guest_origins_title", "Guest origins")}
                  </h3>
                  <p className="mt-0.5 text-xs text-[#727272]">
                    {t("host_dash_guest_origins_desc", "Where your guests are traveling from.")}
                  </p>
                </div>
                <Link
                  href="/host/insights/stats/guests/origins"
                  className="text-xs font-semibold text-zinc-900 underline underline-offset-2 hover:text-zinc-600"
                >
                  View details →
                </Link>
              </div>
              {guestAnalytics.guestOriginCountries.length > 0 ? (
                <div className="mt-3 space-y-2.5">
                  {guestAnalytics.guestOriginCountries.slice(0, 5).map((origin) => (
                    <div key={origin.country}>
                      <div className="flex items-center justify-between text-xs font-medium text-[#1F1F1F]">
                        <span>{origin.country}</span>
                        <span>{origin.sharePercentage}% ({origin.guestCount})</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1F1F1F]"
                          style={{ width: `${Math.min(100, origin.sharePercentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {guestAnalytics.staysWithoutRecordedOriginCount > 0 && (
                    <p className="pt-2 text-[11px] text-[#727272]">
                      {guestAnalytics.staysWithoutRecordedOriginCount}{" "}
                      {t("host_dash_unrecorded_origin", "stays have no residential address on file.")}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs text-[#727272]">
                  {t("host_dash_no_origin_data", "No guest residential origin data recorded yet.")}
                </p>
              )}
            </div>

            {/* Guest Quality Indicators */}
            <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
              <h3 className="text-sm font-semibold text-[#1F1F1F]">
                {t("host_dash_guest_quality_title", "Guest quality indicators")}
              </h3>
              <p className="mt-0.5 text-xs text-[#727272]">
                {t("host_dash_guest_quality_subtitle", "Loyalty and stay engagement metrics.")}
              </p>
              <div className="mt-3 space-y-3">
                <Link
                  href="/host/insights/stats/guests/returning"
                  className="group flex items-center justify-between border-b border-zinc-100 pb-2.5 hover:opacity-80"
                >
                  <div>
                    <p className="text-xs font-medium text-[#1F1F1F] group-hover:underline">{t("host_dash_returning_guests", "Returning guests")}</p>
                    <p className="text-[11px] text-[#727272]">{t("host_dash_repeat_stay_desc", "Guests with 2+ completed stays")}</p>
                  </div>
                  <span className="text-sm font-bold text-[#1F1F1F]">{guestAnalytics.returningGuestsPercentage}%</span>
                </Link>

                <Link
                  href="/host/insights?tab=reviews"
                  className="group flex items-center justify-between border-b border-zinc-100 pb-2.5 hover:opacity-80"
                >
                  <div>
                    <p className="text-xs font-medium text-[#1F1F1F] group-hover:underline">{t("host_dash_avg_rating_given", "Average rating per stay")}</p>
                    <p className="text-[11px] text-[#727272]">{t("host_dash_from_published_reviews", "From published guest reviews")}</p>
                  </div>
                  <span className="text-sm font-bold text-[#1F1F1F]">
                    {reviews.overallRating !== null ? `★ ${reviews.overallRating.toFixed(2)}` : "—"}
                  </span>
                </Link>

                <Link
                  href="/host/insights/stats/guests/check-in"
                  className="group flex items-start justify-between hover:opacity-80"
                >
                  <div>
                    <p className="text-xs font-medium text-[#1F1F1F] group-hover:underline">
                      {t("host_dash_check_in_views", "Check-in instructions viewed")}
                    </p>
                    <p className="text-[11px] text-[#727272]">
                      {guestAnalytics.checkInInstructionsViewed.status === "ACTIVE"
                        ? `${guestAnalytics.checkInInstructionsViewed.viewedCount} viewed · ${guestAnalytics.checkInInstructionsViewed.notViewedCount} not viewed`
                        : guestAnalytics.checkInInstructionsViewed.message}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${guestAnalytics.checkInInstructionsViewed.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                    {guestAnalytics.checkInInstructionsViewed.status === "ACTIVE"
                      ? `${guestAnalytics.checkInInstructionsViewed.eligibleReservationsCount} eligible`
                      : t("host_dash_status_unavailable", "Unavailable")}
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Reviews and Ratings Section */}
      <section className={`mt-4 ${cardClass} p-4 sm:p-5`} aria-labelledby="reviews-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="reviews-heading" className="text-lg font-medium tracking-[-0.02em] text-[#1F1F1F]">
              {t("host_dash_reviews_title", "Reviews and ratings")}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#727272]">
              {t("host_dash_reviews_subtitle", "Published reviews across the selected properties.")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/host/reviews"
              className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1F1F1F] border border-zinc-200 hover:border-zinc-400 shadow-2xs"
            >
              {t("host_dash_all_reviews_link", "Manage reviews")}
            </Link>
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[#1F1F1F]">
                {reviews.overallRating === null ? "—" : `★ ${reviews.overallRating.toFixed(2)}`}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#727272]">
                {reviews.totalReviewsCount}{" "}
                {reviews.totalReviewsCount === 1
                  ? t("host_dash_review_singular", "review")
                  : t("host_dash_review_plural", "reviews")}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t border-[#1F1F1F]/10 pt-4 lg:grid-cols-2">
          {/* Category Subratings */}
          <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs space-y-2`}>
            <p className="text-xs font-semibold text-[#1F1F1F] mb-2">{t("host_dash_category_breakdown", "Category subratings")}</p>
            {[
              ["Cleanliness", reviews.categoryRatings.cleanliness],
              ["Accuracy", reviews.categoryRatings.accuracy],
              ["Check-in", reviews.categoryRatings.checkIn],
              ["Communication", reviews.categoryRatings.communication],
              ["Location", reviews.categoryRatings.location],
              ["Value", reviews.categoryRatings.value],
            ].map(([cat, val]) => (
              <CategoryBar key={String(cat)} category={String(cat)} rating={val as number | null} />
            ))}
          </div>

          {/* Rating Distribution */}
          <div className={`${insetSurfaceClass} p-4 border border-zinc-100 shadow-2xs`}>
            <p className="text-xs font-semibold text-[#1F1F1F] mb-2">{t("host_dash_star_distribution", "Star rating distribution")}</p>
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = reviews.ratingDistribution[star];
                const pct = reviews.totalReviewsCount > 0 ? (count / reviews.totalReviewsCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right font-medium text-[#727272]">{star}</span>
                    <div className="h-2 flex-1 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-medium text-[#727272]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Host Status & Listing Health Section (Phase 2 Section 6) */}
      <section className={`mt-4 ${cardClass} p-4 sm:p-5`} aria-labelledby="host-status-heading">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="host-status-heading" className="text-lg font-medium tracking-[-0.02em] text-[#1F1F1F]">
              {t("host_dash_status_title", "Listing health and status")}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#727272]">
              {t("host_dash_status_subtitle", "Official badges, response rate, and listing completeness.")}
            </p>
          </div>
          <span className="text-xs text-[#727272]">
            {t("host_dash_label_listing_health", "Listing health")}
          </span>
        </div>

        <div className="mt-4 grid gap-3 border-t border-[#1F1F1F]/10 pt-4 lg:grid-cols-3">
          {/* Superhost Progress */}
          <StatusCard
            title={t("host_dash_superhost_title", "Superhost progress")}
            status={
              superhostEvaluation.officialStatus
                ? t("host_dash_official_superhost", "Official Superhost")
                : superhostEvaluation.currentProgress.eligibleNow
                  ? t("host_dash_eligible_next_eval", "Eligible at next evaluation")
                  : t("host_dash_not_yet_eligible", "In progress")
            }
            tone={superhostEvaluation.officialStatus ? "positive" : "neutral"}
            actionHref="/host/insights?tab=superhost"
            actionLabel={t("host_dash_view_superhost_details", "View details")}
            details={[
              `${superhostEvaluation.currentProgress.completedReservationsCount} of 10 ${t("host_dash_completed_res_suffix", "completed reservations")}`,
              superhostEvaluation.currentProgress.overallRating === null
                ? t("host_dash_no_published_rating", "No published rating")
                : `★ ${superhostEvaluation.currentProgress.overallRating.toFixed(2)} rating (min 4.80)`,
              superhostEvaluation.currentProgress.responseRatePercentage === null
                ? "Response rate: — (no qualifying inquiries)"
                : `Response rate: ${superhostEvaluation.currentProgress.responseRatePercentage}% (min 90%)`,
              `${t("host_dash_next_eval_label", "Next evaluation:")} ${new Date(superhostEvaluation.nextEvaluationAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
            ]}
          />

          {/* Guest Favorite Signal */}
          <StatusCard
            title={t("host_dash_guest_favorite_title", "Guest Favorite")}
            status={
              selectedFavorite?.officialStatus
                ? t("host_dash_guest_favorite_title", "Guest Favorite")
                : selectedFavorite?.eligibleNow
                  ? t("host_dash_eligible_next_daily_eval", "Eligible")
                  : t("host_dash_not_yet_eligible", "Not yet eligible")
            }
            tone={selectedFavorite?.officialStatus ? "positive" : "neutral"}
            actionHref="/host/insights?tab=opportunities"
            actionLabel={t("host_dash_view_opportunities", "View opportunities")}
            details={[
              `${officialGuestFavorites} of ${guestFavoriteSummary.length} ${t("host_dash_listings_awarded", "properties awarded")}`,
              selectedFavorite ? `${selectedFavorite.title}` : "",
              selectedFavorite?.overallRating ? `★ ${selectedFavorite.overallRating.toFixed(2)} (${selectedFavorite.reviewsCount} reviews)` : "",
            ]}
          />

          {/* Listing Completeness & Response Performance */}
          <StatusCard
            title={t("host_dash_listing_readiness", "Listing completeness")}
            status={
              selectedHealthListing && selectedHealthListing.missingFields.length === 0
                ? t("host_dash_complete_badge", "Complete")
                : t("host_dash_needs_attention", "Needs details")
            }
            tone={selectedHealthListing && selectedHealthListing.missingFields.length === 0 ? "positive" : "neutral"}
            actionHref={selectedHealthListing ? `/host/insights?tab=opportunities&propertyId=${selectedHealthListing.listingId}` : "/host/insights?tab=opportunities"}
            actionLabel={t("host_dash_view_opportunities", "View opportunities")}
            details={[
              selectedHealthListing
                ? `${selectedHealthListing.photoCount} photos · ${selectedHealthListing.amenityCount} amenities`
                : "",
              selectedHealthListing?.missingFields.length
                ? `${t("host_dash_needs_prefix", "Needs:")} ${selectedHealthListing.missingFields.join(", ")}`
                : t("host_dash_checklist_complete", "All checklist items complete."),
              `${t("host_dash_response_time_label", "Response time:")} ${formatResponseTime(listingHealth.averageResponseTimeMinutes, t)}`,
            ]}
          />
        </div>
      </section>

      {/* Custom Date Range Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-[#1F1F1F]">
              {t("host_dash_select_custom_range", "Select date range")}
            </h3>
            <form onSubmit={handleApplyCustomDates} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#727272]">Start Date</label>
                <input
                  type="date"
                  required
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 p-2 text-sm text-[#1F1F1F] focus:border-black focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#727272]">End Date</label>
                <input
                  type="date"
                  required
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-300 p-2 text-sm text-[#1F1F1F] focus:border-black focus:outline-none"
                />
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="rounded-full px-4 py-2 text-xs font-medium text-[#727272] hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#1F1F1F] px-4 py-2 text-xs font-medium text-white hover:bg-black"
                >
                  Apply range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function PrimaryKpi({
  refreshing,
  label,
  period,
  value,
  detail,
  detailTone,
  progress,
  href,
}: {
  refreshing: boolean;
  label: string;
  period: string;
  value: string;
  detail: string;
  detailTone?: "positive" | "negative";
  progress?: number;
  href?: string;
}) {
  const content = (
    <article
      aria-busy={refreshing}
      className={`${cardClass} group min-h-37.5 overflow-hidden p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_12px_rgba(31,31,31,0.16)] sm:p-5`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-medium text-[#727272] group-hover:text-[#1F1F1F] transition-colors">
            {label}
          </p>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-white/80 px-2 py-1 text-right text-[11px] font-medium text-[#1F1F1F]">
            {period}
          </span>
        </div>
        {refreshing ? (
          <div className="mt-2 h-7 w-28 animate-pulse rounded bg-zinc-100" />
        ) : (
          <p className="mt-3 lg:text-2xl text-xl font-semibold text-[#1F1F1F]">
            {value}
          </p>
        )}
      </div>
      <div className="mt-4 border-t border-[#1F1F1F]/10 pt-3">
        {refreshing ? (
          <>
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
            {progress !== undefined && (
              <div className="mt-2 h-1.5 rounded-full bg-zinc-100" />
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              <span
                className={`font-medium ${
                  detailTone === "positive"
                    ? "text-emerald-700"
                    : detailTone === "negative"
                      ? "text-rose-700"
                      : "text-[#727272]"
                }`}
              >
                {detail}
              </span>
              {href && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-zinc-500">
                  View →
                </span>
              )}
            </div>
            {progress !== undefined && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1F1F1F] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none rounded-[12px] focus-visible:ring-2 focus-visible:ring-black">
        {content}
      </Link>
    );
  }

  return content;
}

function SecondaryKpi({
  refreshing,
  label,
  value,
  detail,
  href,
}: {
  refreshing: boolean;
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <article
      aria-busy={refreshing}
      className={`${cardClass} group min-h-36 p-3.5 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(31,31,31,0.12)]`}
    >
      <p className="text-xs font-medium text-[#727272] group-hover:text-[#1F1F1F] transition-colors">{label}</p>
      {refreshing ? (
        <div className="mt-3 h-5 w-16 animate-pulse rounded bg-zinc-100" />
      ) : (
        <p className="mt-2 text-lg font-semibold text-[#1F1F1F]">{value}</p>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between">
        <p className="text-[11px] text-[#727272]">{detail}</p>
        {href && <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-500">→</span>}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none rounded-[12px] focus-visible:ring-2 focus-visible:ring-black">
        {content}
      </Link>
    );
  }

  return content;
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "CRITICAL"
      ? "bg-rose-100 text-rose-800"
      : priority === "HIGH"
        ? "bg-amber-100 text-amber-900"
        : "bg-zinc-200 text-zinc-700";
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold leading-tight ${tone}`}>
      {priority}
    </span>
  );
}

function UpcomingReservation({
  reservation,
  onSelectBookingId,
}: {
  reservation: NonNullable<HostDashboardData["kpis"]["nextUpcomingReservation"]>;
  onSelectBookingId?: (bookingId: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white border border-[#727272] text-sm font-semibold text-zinc-700">
          {reservation.guestImage ? (
            <Image
              src={reservation.guestImage}
              alt={reservation.guestName}
              width={40}
              height={40}
              unoptimized
              className="size-full object-cover"
            />
          ) : (
            reservation.guestName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-[#1F1F1F]">
            {reservation.guestName}{" "}
            <span className="font-normal text-[#727272] text-sm">· {reservation.listingTitle}</span>
          </p>
          <p className="mt-1 text-xs text-[#727272]">
            {reservation.startDate} {t("host_dash_at_time", "at")} {reservation.checkInTime} · {reservation.endDate} ·{" "}
            {reservation.nights} {reservation.nights === 1 ? t("host_dash_night_singular", "night") : t("host_dash_night_plural", "nights")} ·{" "}
            {reservation.guests} {reservation.guests === 1 ? t("host_dash_guest_singular", "guest") : t("host_dash_guest_plural", "guests")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 md:text-right">
        <div>
          <p className="text-xs font-medium text-[#727272]">
            {reservation.isPayoutEligible
              ? t("host_dash_eligible_payout", "Eligible payout")
              : t("host_dash_payment_status", "Payment status")}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#1F1F1F]">
            {reservation.isPayoutEligible
              ? formatCurrency(reservation.hostPayoutCents, reservation.currency)
              : t("host_dash_pending_payment", "Pending payment")}
          </p>
        </div>
        <Link
          href={`/host/bookings/${reservation.id}`}
          onClick={() => onSelectBookingId?.(reservation.id)}
          className="rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1F1F1F] shadow-xs transition hover:border-zinc-500 hover:bg-zinc-50"
        >
          {t("host_dash_btn_details", "Details")}
        </Link>
      </div>
    </div>
  );
}

function CategoryBar({ category, rating }: { category: string; rating: number | null }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5rem_2rem] items-center gap-3">
      <span className="text-xs font-medium text-[#1F1F1F]">{category}</span>
      <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#1F1F1F]"
          style={{ width: `${rating === null ? 0 : Math.min(100, (rating / 5) * 100)}%` }}
        />
      </div>
      <span className="text-right text-xs font-medium text-[#727272]">
        {rating === null ? "—" : rating.toFixed(1)}
      </span>
    </div>
  );
}

function StatusCard({
  title,
  status,
  tone,
  details,
  actionHref,
  actionLabel,
}: {
  title: string;
  status: string;
  tone: "positive" | "neutral";
  details: string[];
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <article className={`${insetSurfaceClass} min-h-39 border border-zinc-100 p-4 shadow-2xs sm:p-5 flex flex-col justify-between`}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1F1F1F]">{title}</p>
          {actionHref && actionLabel && (
            <Link href={actionHref} className="text-xs font-medium text-[#1F1F1F] underline hover:text-black">
              {actionLabel}
            </Link>
          )}
        </div>
        <p
          className={`mt-2.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            tone === "positive" ? "bg-emerald-100 text-emerald-800" : "bg-[#FCDF9C] text-[#1F1F1F]"
          }`}
        >
          {status}
        </p>
        <ul className="mt-3.5 space-y-1.5 border-t border-[#1F1F1F]/10 pt-3">
          {details.filter(Boolean).map((detail) => (
            <li key={detail} className="flex items-start gap-2 text-xs leading-5 text-[#727272]">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-[#727272]" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function ReservationSkeleton() {
  return (
    <div className="mt-4 flex animate-pulse items-center gap-3 border-t border-zinc-100 pt-4">
      <div className="size-10 rounded-full bg-zinc-200" />
      <div className="space-y-1.5">
        <div className="h-4 w-36 rounded bg-zinc-200" />
        <div className="h-3 w-52 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

function EarningsDetailsSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 rounded bg-zinc-100" />
      ))}
    </div>
  );
}

function RecommendationSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 md:grid-cols-2 gap-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-zinc-100" />
      ))}
    </div>
  );
}

function GuestInsightsSkeleton() {
  return (
    <div className="mt-4 grid animate-pulse gap-4 border-t border-zinc-100 pt-4 lg:grid-cols-2">
      <div className="h-32 rounded-xl bg-zinc-100" />
      <div className="h-32 rounded-xl bg-zinc-100" />
    </div>
  );
}

/** Route and in-component loading fallback, matched to the dashboard's visual hierarchy. */
export function HostDashboardOverviewSkeleton() {
  const { t } = useLanguage();
  return (
    <section
      aria-label={t("host_dash_aria_loading", "Loading host performance dashboard")}
      aria-busy="true"
      className="mx-auto mb-4 w-full animate-pulse font-sans sm:mb-10"
    >
      <div className="mb-7 flex items-end justify-between gap-4 border-b border-[#1F1F1F]/10 pb-5 sm:mb-8">
        <div>
          <div className="mb-2 h-3 w-28 rounded bg-zinc-100" />
          <div className="h-9 w-60 rounded-lg bg-zinc-200" />
          <div className="mt-2 h-4 w-32 rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-zinc-100" />
      </div>
      <div className={primaryKpiGridClass}>
        {[...Array(4)].map((_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </div>
      <div className={`mt-3 ${secondaryKpiGridClass}`}>
        {[...Array(5)].map((_, index) => (
          <SecondaryKpiSkeleton key={index} />
        ))}
      </div>
      <div className={`mt-3 ${cardClass} h-12`} />
      <DashboardSectionSkeleton className="mt-6" bodyRows={2} />
      <DashboardSectionSkeleton className="mt-4" bodyRows={1} />
      <ReviewSectionSkeleton />
      <DashboardSectionSkeleton className="mt-4" bodyRows={2} />
      <DashboardSectionSkeleton className="mt-4" metricCount={3} />
    </section>
  );
}

function KpiCardSkeleton() {
  return (
    <div className={`${cardClass} flex min-h-36 flex-col justify-between p-5`}>
      <div className="flex justify-between gap-2">
        <div className="h-3 w-24 rounded bg-zinc-100" />
        <div className="h-3 w-14 rounded bg-zinc-100" />
      </div>
      <div className="h-8 w-28 rounded bg-zinc-200" />
      <div className="h-3 w-32 border-t border-zinc-100 pt-3" />
    </div>
  );
}

function SecondaryKpiSkeleton() {
  return (
    <div className={`${cardClass} flex min-h-36 flex-col p-3.5`}>
      <div className="h-3 w-24 rounded bg-zinc-100" />
      <div className="mt-3 h-5 w-16 rounded bg-zinc-200" />
      <div className="mt-auto h-3 w-20 rounded bg-zinc-100" />
    </div>
  );
}

function ReviewSectionSkeleton() {
  return (
    <section className={`mt-4 ${cardClass} p-5`}>
      <div className="flex justify-between gap-3">
        <div>
          <div className="h-5 w-32 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-zinc-100" />
        </div>
        <div>
          <div className="h-5 w-12 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-16 rounded bg-zinc-100" />
        </div>
      </div>
      <div className="mt-4 grid gap-6 border-t border-zinc-100 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div>
          <div className="h-3 w-20 rounded bg-zinc-100" />
          <div className="mt-3 h-[250px] rounded-xl bg-zinc-50" />
        </div>
        <div>
          <div className="h-3 w-20 rounded bg-zinc-100" />
          <div className="mt-3 space-y-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-3 rounded bg-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardSectionSkeleton({
  className,
  metricCount = 0,
  bodyRows = 0,
}: {
  className: string;
  metricCount?: number;
  bodyRows?: number;
}) {
  return (
    <section className={`${className} ${cardClass} p-5`}>
      <div className="flex justify-between gap-3">
        <div>
          <div className="h-5 w-40 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-64 max-w-full rounded bg-zinc-100" />
        </div>
        <div className="h-5 w-20 rounded bg-zinc-100" />
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4">
        {metricCount > 0 && (
          <div
            className={`grid gap-3 ${metricCount === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}
          >
            {[...Array(metricCount)].map((_, index) => (
              <div key={index} className="rounded-xl bg-zinc-50 p-3">
                <div className="h-3 w-16 rounded bg-zinc-100" />
                <div className="mt-2 h-5 w-20 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        )}
        {bodyRows > 0 && (
          <div className={`${metricCount ? "mt-4" : ""} space-y-3`}>
            {[...Array(bodyRows)].map((_, index) => (
              <div key={index} className="h-14 rounded-xl bg-zinc-50" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
