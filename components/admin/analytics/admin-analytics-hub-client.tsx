"use client";

import React, { useState, useTransition, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui/admin-page-header";
import { AnalyticsDatePickerPopover } from "./analytics-date-picker-popover";
import { OverviewTab } from "./tabs/overview-tab";
import { RevenueTab } from "./tabs/revenue-tab";
import { OccupancyTab } from "./tabs/occupancy-tab";
import { OperationsTab } from "./tabs/operations-tab";
import { ForecastTab } from "./tabs/forecast-tab";
import { PricingTab } from "./tabs/pricing-tab";
import { ReportsTab } from "./tabs/reports-tab";
import { DataQualityBanner } from "./data-quality-banner";
import { filterWarningsForTab } from "@/services/admin-analytics/warning-normalization";
import type {
  ComparisonMode,
  UnifiedAnalyticsResponse,
} from "@/services/admin-analytics/analytics-contracts";
import type { UnifiedOverviewData } from "@/services/admin-analytics/overview.service";
import type { RevenueAnalyticsData } from "@/services/admin-analytics/revenue.service";
import type { OccupancyAnalyticsData } from "@/services/admin-analytics/occupancy.service";
import type { OperationsAnalyticsData } from "@/services/admin-analytics/operations.service";

export interface FilterOptions {
  listings: Array<{ id: string; title: string; city: string | null; hostId: string }>;
  hosts: Array<{ id: string; name: string | null; email: string }>;
  cities: string[];
  currencies: string[];
}

interface AdminAnalyticsHubClientProps {
  initialOverview: UnifiedAnalyticsResponse<UnifiedOverviewData>;
  initialRevenue: UnifiedAnalyticsResponse<RevenueAnalyticsData>;
  initialOccupancy: UnifiedAnalyticsResponse<OccupancyAnalyticsData>;
  initialOperations: UnifiedAnalyticsResponse<OperationsAnalyticsData>;
  initialFilterOptions?: FilterOptions;
  initialTab?: TabKey;
}

export type TabKey = "overview" | "revenue" | "occupancy" | "operations" | "forecast" | "pricing" | "reports";

const fmtSAR = (cents: number | null | undefined, currency: string = "SAR") => {
  if (cents === null || cents === undefined) return "—";
  const whole = Math.round(cents / 100);
  return `${currency} ${whole.toLocaleString("en-US")}`;
};

const fmtPct = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(1)}%`;
};

export function AdminAnalyticsHubClient({
  initialOverview,
  initialRevenue,
  initialOccupancy,
  initialOperations,
  initialFilterOptions = {
    listings: [],
    hosts: [],
    cities: [],
    currencies: ["SAR", "USD", "EUR"],
  },
  initialTab = "overview",
}: AdminAnalyticsHubClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [isPending, startTransition] = useTransition();

  const [overview, setOverview] = useState(initialOverview);
  const [revenue, setRevenue] = useState(initialRevenue);
  const [occupancy, setOccupancy] = useState(initialOccupancy);
  const [operations, setOperations] = useState(initialOperations);

  // Centralized Filters State
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    initialOverview.timeframe.period || "30d"
  );
  const [customStart, setCustomStart] = useState<string | undefined>(
    initialOverview.timeframe.startDateKey
  );
  const [customEnd, setCustomEnd] = useState<string | undefined>(
    initialOverview.timeframe.endDateKey
  );
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(
    initialOverview.timeframe.comparisonMode || "previous_period"
  );
  const [selectedListingId, setSelectedListingId] = useState<string>(
    initialOverview.filters.listingId || ""
  );
  const [selectedHostId, setSelectedHostId] = useState<string>(
    initialOverview.filters.hostId || ""
  );
  const [selectedCity, setSelectedCity] = useState<string>(
    initialOverview.filters.city || ""
  );
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    initialOverview.currency || "SAR"
  );

  const [filterOptions, setFilterOptions] = useState<FilterOptions>(initialFilterOptions);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // In-flight request cancellation ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch filter options if not supplied on SSR
  useEffect(() => {
    if (filterOptions.listings.length === 0 && filterOptions.cities.length === 0) {
      fetch("/api/v1/admin/analytics/options")
        .then((r) => r.json())
        .then((json) => {
          if (json.data) setFilterOptions(json.data);
        })
        .catch(() => {});
    }
  }, [filterOptions.listings.length, filterOptions.cities.length]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = (sp.get("tab") as TabKey) || "overview";
      const periodParam = sp.get("period") || "30d";
      const startParam = sp.get("startDate") || undefined;
      const endParam = sp.get("endDate") || undefined;
      const compParam = (sp.get("comparison") as ComparisonMode) || "previous_period";
      const listingParam = sp.get("listingId") || "";
      const hostParam = sp.get("hostId") || "";
      const cityParam = sp.get("city") || "";
      const currParam = sp.get("currency") || "SAR";

      setActiveTab(tabParam);
      setSelectedPeriod(periodParam);
      setCustomStart(startParam);
      setCustomEnd(endParam);
      setComparisonMode(compParam);
      setSelectedListingId(listingParam);
      setSelectedHostId(hostParam);
      setSelectedCity(cityParam);
      setSelectedCurrency(currParam);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Centralized Fetch Engine
  const executeFetch = useCallback(
    (overrides: {
      tab?: TabKey;
      period?: string;
      start?: string;
      end?: string;
      comparison?: ComparisonMode;
      listingId?: string;
      hostId?: string;
      city?: string;
      currency?: string;
    }) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const effTab = overrides.tab ?? activeTab;
      const effPeriod = overrides.period ?? selectedPeriod;
      const effStart = overrides.start !== undefined ? overrides.start : customStart;
      const effEnd = overrides.end !== undefined ? overrides.end : customEnd;
      const effComp = overrides.comparison ?? comparisonMode;
      const effListing = overrides.listingId !== undefined ? overrides.listingId : selectedListingId;
      const effHost = overrides.hostId !== undefined ? overrides.hostId : selectedHostId;
      const effCity = overrides.city !== undefined ? overrides.city : selectedCity;
      const effCurrency = overrides.currency ?? selectedCurrency;

      // URL Query Sync
      const qp = new URLSearchParams();
      if (effTab !== "overview") qp.set("tab", effTab);
      if (effPeriod === "custom" && effStart && effEnd) {
        qp.set("startDate", effStart);
        qp.set("endDate", effEnd);
        qp.set("period", "custom");
      } else if (effPeriod) {
        qp.set("period", effPeriod);
      }
      if (effComp && effComp !== "previous_period") qp.set("comparison", effComp);
      if (effListing) qp.set("listingId", effListing);
      if (effHost) qp.set("hostId", effHost);
      if (effCity) qp.set("city", effCity);
      if (effCurrency && effCurrency !== "SAR") qp.set("currency", effCurrency);

      const newUrl = qp.toString() ? `/admin/analytics?${qp.toString()}` : "/admin/analytics";
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);

      startTransition(async () => {
        try {
          const fetchParams = new URLSearchParams();
          if (effPeriod === "custom" && effStart && effEnd) {
            fetchParams.set("startDate", effStart);
            fetchParams.set("endDate", effEnd);
          } else if (effPeriod) {
            fetchParams.set("period", effPeriod);
          }
          if (effComp) fetchParams.set("comparisonMode", effComp);
          if (effListing) fetchParams.set("listingId", effListing);
          if (effHost) fetchParams.set("hostId", effHost);
          if (effCity) fetchParams.set("city", effCity);
          if (effCurrency) fetchParams.set("currency", effCurrency);

          const qs = fetchParams.toString();
          const signal = controller.signal;

          const [oRes, rRes, occRes, opRes] = await Promise.all([
            fetch(`/api/v1/admin/analytics/overview?${qs}`, { signal }).then((r) => r.json()),
            fetch(`/api/v1/admin/analytics/revenue?${qs}`, { signal }).then((r) => r.json()),
            fetch(`/api/v1/admin/analytics/occupancy?${qs}`, { signal }).then((r) => r.json()),
            fetch(`/api/v1/admin/analytics/operations?${qs}`, { signal }).then((r) => r.json()),
          ]);

          if (oRes.data) setOverview(oRes.data);
          if (rRes.data) setRevenue(rRes.data);
          if (occRes.data) setOccupancy(occRes.data);
          if (opRes.data) setOperations(opRes.data);
        } catch (err: any) {
          if (err.name !== "AbortError") {
            router.refresh();
          }
        }
      });
    },
    [
      activeTab,
      selectedPeriod,
      customStart,
      customEnd,
      comparisonMode,
      selectedListingId,
      selectedHostId,
      selectedCity,
      selectedCurrency,
      router,
    ]
  );

  // Live SSE Real-Time Stream State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveEventBanner, setLiveEventBanner] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;
    let eventSource: EventSource | null = null;
    let dismissTimer: NodeJS.Timeout | null = null;

    try {
      eventSource = new EventSource("/api/v1/admin/analytics/live");

      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };

      eventSource.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type && payload.type !== "HANDSHAKE" && payload.type !== "HEARTBEAT") {
            const formatted = payload.type.replace(/_/g, " ").toLowerCase();
            setLiveEventBanner(`Live: New ${formatted} recorded`);
            if (dismissTimer) clearTimeout(dismissTimer);
            dismissTimer = setTimeout(() => setLiveEventBanner(null), 5000);

            if (
              payload.type === "BOOKING_CONFIRMED" ||
              payload.type === "PAYMENT_CAPTURED" ||
              payload.type === "PAYOUT_COMPLETED"
            ) {
              executeFetch({});
            }
          }
        } catch {
          // non-blocking
        }
      };
    } catch {
      // EventSource fallback
    }

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      if (eventSource) eventSource.close();
    };
  }, [executeFetch]);

  // Web Push Notification State
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    // Check existing push subscription status
    fetch("/api/v1/admin/analytics/push")
      .then((r) => r.json())
      .then((res) => {
        if (res.data?.isSubscribed) {
          setIsPushSubscribed(true);
        }
      })
      .catch(() => {});
  }, []);

  const togglePushSubscription = async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      alert("Push notifications are not supported by this browser.");
      return;
    }
    setPushLoading(true);
    try {
      if (isPushSubscribed) {
        const reg = await navigator.serviceWorker.getRegistration("/sw-admin-push.js");
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await fetch("/api/v1/admin/analytics/push", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setIsPushSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Notification permission was denied. You can enable it in your browser settings.");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw-admin-push.js");
        const sub = await reg?.pushManager?.subscribe({
          userVisibleOnly: true,
          applicationServerKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
        }).catch(() => null);

        if (sub) {
          const rawSub = sub.toJSON();
          await fetch("/api/v1/admin/analytics/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              keys: rawSub.keys,
              userAgent: navigator.userAgent,
            }),
          });
          setIsPushSubscribed(true);
        } else {
          setIsPushSubscribed(true);
        }
      }
    } catch {
      // non-blocking
    } finally {
      setPushLoading(false);
    }
  };

  // Tab change handler
  const handleTabChange = (newTab: TabKey) => {
    setActiveTab(newTab);
    executeFetch({ tab: newTab });
  };

  // Date period change handler
  const handlePeriodChange = (period: string, start?: string, end?: string) => {
    setSelectedPeriod(period);
    if (start !== undefined) setCustomStart(start);
    if (end !== undefined) setCustomEnd(end);
    executeFetch({ period, start, end });
  };

  // Comparison mode change handler
  const handleComparisonChange = (mode: ComparisonMode) => {
    setComparisonMode(mode);
    executeFetch({ comparison: mode });
  };

  // Listing filter change handler
  const handleListingChange = (id: string) => {
    setSelectedListingId(id);
    executeFetch({ listingId: id });
  };

  // Host filter change handler
  const handleHostChange = (id: string) => {
    setSelectedHostId(id);
    executeFetch({ hostId: id });
  };

  // City filter change handler
  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    executeFetch({ city });
  };

  // Currency filter change handler
  const handleCurrencyChange = (currency: string) => {
    setSelectedCurrency(currency);
    executeFetch({ currency });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedPeriod("30d");
    setCustomStart(undefined);
    setCustomEnd(undefined);
    setComparisonMode("previous_period");
    setSelectedListingId("");
    setSelectedHostId("");
    setSelectedCity("");
    setSelectedCurrency("SAR");
    executeFetch({
      period: "30d",
      start: "",
      end: "",
      comparison: "previous_period",
      listingId: "",
      hostId: "",
      city: "",
      currency: "SAR",
    });
  };

  const handleRefresh = () => {
    executeFetch({});
  };

  // Export summary CSV with active filter context
  const handleExportSummaryCSV = () => {
    const rows = [
      ["Homyz Admin Analytics Export", activeTab.toUpperCase()],
      ["Timeframe", overview.timeframe.label],
      ["Period Key", overview.timeframe.period],
      ["Date Range", `${overview.timeframe.startDateKey} to ${overview.timeframe.endDateKey}`],
      ["Comparison Mode", comparisonMode],
      ["Comparison Window", overview.timeframe.comparisonLabel],
      ["Filtered Listing ID", selectedListingId || "All Listings"],
      ["Filtered Host ID", selectedHostId || "All Hosts"],
      ["Filtered City", selectedCity || "All Cities"],
      ["Reporting Currency", selectedCurrency],
      ["Generated At (UTC)", new Date().toISOString()],
      [],
      ["Metric Name", "Current Value", "Previous Value", "Delta", "Unit / Measurement"],
      [
        "Gross Booking Value (GMV)",
        fmtSAR(overview.data.kpis.grossBookingValueCents.current, selectedCurrency),
        fmtSAR(overview.data.kpis.grossBookingValueCents.previous, selectedCurrency),
        overview.data.kpis.grossBookingValueCents.percentageChange !== null
          ? `${overview.data.kpis.grossBookingValueCents.percentageChange}%`
          : "—",
        `${selectedCurrency} Minor Units`,
      ],
      [
        "Platform Commission",
        fmtSAR(overview.data.kpis.platformCommissionCents.current, selectedCurrency),
        fmtSAR(overview.data.kpis.platformCommissionCents.previous, selectedCurrency),
        overview.data.kpis.platformCommissionCents.percentageChange !== null
          ? `${overview.data.kpis.platformCommissionCents.percentageChange}%`
          : "—",
        `${selectedCurrency} Fee Revenue`,
      ],
      [
        "Net Captured Gateway Cash",
        fmtSAR(revenue.data.breakdown.netCollectedCashCents.current, selectedCurrency),
        fmtSAR(revenue.data.breakdown.netCollectedCashCents.previous, selectedCurrency),
        revenue.data.breakdown.netCollectedCashCents.percentageChange !== null
          ? `${revenue.data.breakdown.netCollectedCashCents.percentageChange}%`
          : "—",
        "Captured - Settled Refunds",
      ],
      [
        "Marketplace Occupancy Rate",
        fmtPct(occupancy.data.kpis.occupancyRatePercentage.current),
        fmtPct(occupancy.data.kpis.occupancyRatePercentage.previous),
        occupancy.data.kpis.occupancyRatePercentage.percentageChange !== null
          ? `${occupancy.data.kpis.occupancyRatePercentage.percentageChange} pp`
          : "—",
        "Occupied / Bookable Inventory",
      ],
      [
        "Average Daily Rate (ADR)",
        fmtSAR(occupancy.data.kpis.averageDailyRateCents.current, selectedCurrency),
        fmtSAR(occupancy.data.kpis.averageDailyRateCents.previous, selectedCurrency),
        occupancy.data.kpis.averageDailyRateCents.percentageChange !== null
          ? `${occupancy.data.kpis.averageDailyRateCents.percentageChange}%`
          : "—",
        `${selectedCurrency} per Sold Room Night`,
      ],
      [
        "RevPAR",
        fmtSAR(occupancy.data.kpis.revParCents.current, selectedCurrency),
        fmtSAR(occupancy.data.kpis.revParCents.previous, selectedCurrency),
        occupancy.data.kpis.revParCents.percentageChange !== null
          ? `${occupancy.data.kpis.revParCents.percentageChange}%`
          : "—",
        "ADR x Occupancy",
      ],
      [
        "Total Support Cases Created",
        String(operations.data.kpis.totalCasesCreated.current),
        String(operations.data.kpis.totalCasesCreated.previous),
        operations.data.kpis.totalCasesCreated.percentageChange !== null
          ? `${operations.data.kpis.totalCasesCreated.percentageChange}%`
          : "—",
        "Customer Cases Opened",
      ],
      [
        "Active Support Backlog",
        String(operations.data.kpis.activeBacklogCases),
        "—",
        "—",
        "Pending Agent Resolution",
      ],
      [
        "Overdue SLA Cases",
        String(operations.data.kpis.overdueCasesCount),
        "—",
        "—",
        "Breached SLA Target",
      ],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `homyz-analytics-${activeTab}-${selectedPeriod}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = Boolean(
    selectedListingId ||
      selectedHostId ||
      selectedCity ||
      selectedCurrency !== "SAR" ||
      comparisonMode !== "previous_period" ||
      selectedPeriod !== "30d"
  );

  const relevantWarnings = React.useMemo(() => {
    const combined = [
      ...(overview?.dataQualityWarnings || []),
      ...(revenue?.dataQualityWarnings || []),
      ...(occupancy?.dataQualityWarnings || []),
      ...(operations?.dataQualityWarnings || []),
    ];
    return filterWarningsForTab(combined, activeTab);
  }, [overview, revenue, occupancy, operations, activeTab]);

  return (
    <div className="flex flex-col gap-6 font-sans pb-16">
      {/* 1. Page Header with Clean Title & High-Level Actions */}
      <AdminPageHeader
        title="Analytics & Reports"
        description="Understand your marketplace performance, revenue, bookings, and operations."
        badge={{
          label: `${overview.timeframe.label}`,
          variant: "neutral",
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Live SSE Stream Indicator */}
            <div
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs text-muted-foreground shadow-2xs"
              title={isLiveConnected ? "Real-time updates active via SSE" : "Offline / Reconnecting"}
            >
              <span className={`size-2 rounded-full ${isLiveConnected ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"}`} />
              <span className="font-normal text-[11px] hidden md:inline">{isLiveConnected ? "Live" : "Offline"}</span>
            </div>

            {/* Web Push Alerts Opt-In Button */}
            <button
              type="button"
              onClick={togglePushSubscription}
              disabled={pushLoading}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all shadow-2xs cursor-pointer ${
                isPushSubscribed
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground"
              }`}
              title={
                isPushSubscribed
                  ? "Push alerts active for critical financial and operational events"
                  : "Opt-in to browser push notifications for critical operational alerts"
              }
            >
              <svg className={`size-3.5 ${isPushSubscribed ? "text-emerald-600" : "text-muted-foreground"}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="hidden lg:inline">{isPushSubscribed ? "Push Alerts On" : "Push Alerts"}</span>
            </button>

            {/* Quick Export Summary Button */}
            <button
              type="button"
              onClick={handleExportSummaryCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-2 text-xs font-medium text-foreground transition-all shadow-2xs cursor-pointer"
            >
              <svg className="size-3.5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export CSV</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-xs font-medium text-foreground transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Refresh Analytics"
            >
              <svg
                className={`size-3.5 ${isPending ? "animate-spin text-[var(--accent)]" : "text-muted-foreground"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">{isPending ? "Updating..." : "Refresh"}</span>
            </button>
          </div>
        }
      />

      {/* Real-time Event Notification Toast/Banner */}
      {liveEventBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-normal text-emerald-900 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-medium">{liveEventBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setLiveEventBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 font-normal cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Global Filter & Date-Range Toolbar (Desktop & Mobile) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left Side: Date Range Popover & Comparison Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <AnalyticsDatePickerPopover
              currentPeriod={selectedPeriod}
              startDate={customStart}
              endDate={customEnd}
              comparisonMode={comparisonMode}
              onSelectPeriod={handlePeriodChange}
              onSelectComparisonMode={handleComparisonChange}
              disabled={isPending}
            />

            {/* Comparison Mode Pill Switcher */}
            <div className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-[var(--surface-secondary)] p-1 border border-[var(--border)] text-xs">
              <button
                type="button"
                onClick={() => handleComparisonChange("previous_period")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                  comparisonMode === "previous_period"
                    ? "bg-[var(--surface)] text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Prior Period
              </button>
              <button
                type="button"
                onClick={() => handleComparisonChange("previous_year")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                  comparisonMode === "previous_year"
                    ? "bg-[var(--surface)] text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Same Period Last Year (YoY)
              </button>
              <button
                type="button"
                onClick={() => handleComparisonChange("none")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                  comparisonMode === "none"
                    ? "bg-[var(--surface)] text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                No Comparison
              </button>
            </div>
          </div>

          {/* Right Side: Dimension Filters (Currency, City, Listing) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Currency Selector */}
            <div className="flex items-center gap-1">
              <label htmlFor="currency-select" className="text-[11px] font-normal text-muted-foreground hidden md:inline">
                Currency:
              </label>
              <select
                id="currency-select"
                value={selectedCurrency}
                disabled={activeTab === "operations"}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className={`px-2.5 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground focus:outline-hidden font-normal cursor-pointer ${
                  activeTab === "operations" ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title={activeTab === "operations" ? "Currency filter does not apply to operations" : undefined}
              >
                {filterOptions.currencies.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>

            {/* City Selector */}
            {filterOptions.cities.length > 0 && (
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground focus:outline-hidden font-normal cursor-pointer max-w-[130px] truncate"
              >
                <option value="">All Cities</option>
                {filterOptions.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            )}

            {/* Listing Selector */}
            {filterOptions.listings.length > 0 && (
              <select
                value={selectedListingId}
                onChange={(e) => handleListingChange(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground focus:outline-hidden font-normal cursor-pointer max-w-[150px] truncate"
              >
                <option value="">All Listings</option>
                {filterOptions.listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            )}

            {/* Mobile Filter Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground cursor-pointer"
            >
              <span>Filters</span>
              {hasActiveFilters && <span className="size-2 rounded-full bg-[var(--accent)]" />}
            </button>
          </div>
        </div>

        {/* Mobile Filter Sheet (Expandable) */}
        {isMobileFiltersOpen && (
          <div className="sm:hidden pt-3 border-t border-[var(--border)] flex flex-col gap-2.5 text-xs">
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Comparison Baseline
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => handleComparisonChange("previous_period")}
                  className={`p-1.5 text-center rounded-lg border font-medium text-[11px] ${
                    comparisonMode === "previous_period"
                      ? "bg-[var(--accent)] text-white border-transparent"
                      : "border-[var(--border)] bg-[var(--surface)] text-foreground"
                  }`}
                >
                  Prior Period
                </button>
                <button
                  type="button"
                  onClick={() => handleComparisonChange("previous_year")}
                  className={`p-1.5 text-center rounded-lg border font-medium text-[11px] ${
                    comparisonMode === "previous_year"
                      ? "bg-[var(--accent)] text-white border-transparent"
                      : "border-[var(--border)] bg-[var(--surface)] text-foreground"
                  }`}
                >
                  YoY
                </button>
                <button
                  type="button"
                  onClick={() => handleComparisonChange("none")}
                  className={`p-1.5 text-center rounded-lg border font-medium text-[11px] ${
                    comparisonMode === "none"
                      ? "bg-[var(--accent)] text-white border-transparent"
                      : "border-[var(--border)] bg-[var(--surface)] text-foreground"
                  }`}
                >
                  None
                </button>
              </div>
            </div>

            {filterOptions.hosts.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Host Portfolio
                </span>
                <select
                  value={selectedHostId}
                  onChange={(e) => handleHostChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-foreground font-normal"
                >
                  <option value="">All Hosts</option>
                  {filterOptions.hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name || h.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Active Filter Badges Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)] text-[11px]">
            <span className="font-normal text-muted-foreground">Active filters:</span>

            {selectedPeriod !== "30d" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-foreground font-medium">
                Period: {overview.timeframe.label}
              </span>
            )}

            {comparisonMode !== "previous_period" && (
              <button
                type="button"
                onClick={() => handleComparisonChange("previous_period")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-foreground hover:bg-[var(--surface-hover)] font-medium cursor-pointer"
              >
                <span>Compare: {comparisonMode === "previous_year" ? "YoY" : "None"}</span>
                <span className="text-muted-foreground">×</span>
              </button>
            )}

            {selectedCity && (
              <button
                type="button"
                onClick={() => handleCityChange("")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-foreground hover:bg-[var(--surface-hover)] font-medium cursor-pointer"
              >
                <span>City: {selectedCity}</span>
                <span className="text-muted-foreground">×</span>
              </button>
            )}

            {selectedListingId && (
              <button
                type="button"
                onClick={() => handleListingChange("")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-foreground hover:bg-[var(--surface-hover)] font-medium cursor-pointer"
              >
                <span>Listing Filtered</span>
                <span className="text-muted-foreground">×</span>
              </button>
            )}

            {selectedCurrency !== "SAR" && (
              <button
                type="button"
                onClick={() => handleCurrencyChange("SAR")}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-foreground hover:bg-[var(--surface-hover)] font-medium cursor-pointer"
              >
                <span>Currency: {selectedCurrency}</span>
                <span className="text-muted-foreground">×</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="ml-auto text-[11px] text-[var(--accent)] hover:underline font-medium cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* 3. Data Transparency & Historical Warnings */}
      <DataQualityBanner warnings={relevantWarnings} />

      {/* 4. Navigation Tab Bar with Filter Scope Indicators */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {(
            [
              { id: "overview", label: "Executive Overview" },
              { id: "revenue", label: "Revenue & Cash Flow" },
              { id: "occupancy", label: "Occupancy & ADR/RevPAR" },
              {
                id: "operations",
                label: "Operations & Quality",
                badge: operations.data.kpis.overdueCasesCount > 0 ? operations.data.kpis.overdueCasesCount : null,
              },
              { id: "forecast", label: "Demand & Forecasting" },
              { id: "pricing", label: "Dynamic Pricing" },
              { id: "reports", label: "Reports & Exports" },
            ] as Array<{ id: TabKey; label: string; badge?: number | null }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[var(--surface-secondary)] text-foreground border border-[var(--border)] shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-secondary)]/50 border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-medium">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Comparison window display */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground font-normal shrink-0">
          <span>Comparison:</span>
          <span className="px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-foreground font-medium text-[11px]">
            {overview.timeframe.comparisonLabel}
          </span>
        </div>
      </div>

      {/* 5. Active Tab Content with Smooth Non-blocking Transition */}
      <div className={`transition-opacity duration-200 ${isPending ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
        {activeTab === "overview" && (
          <OverviewTab
            overviewData={overview.data}
            occupancyData={occupancy.data}
            timeframeLabel={overview.timeframe.label}
            comparisonLabel={overview.timeframe.comparisonLabel}
          />
        )}

        {activeTab === "revenue" && (
          <RevenueTab
            revenueData={revenue.data}
            timeframeLabel={revenue.timeframe.label}
            comparisonLabel={revenue.timeframe.comparisonLabel}
          />
        )}

        {activeTab === "occupancy" && (
          <OccupancyTab
            occupancyData={occupancy.data}
            timeframeLabel={occupancy.timeframe.label}
            comparisonLabel={occupancy.timeframe.comparisonLabel}
          />
        )}

        {activeTab === "operations" && (
          <OperationsTab
            operationsData={operations.data}
            timeframeLabel={operations.timeframe.label}
            comparisonLabel={operations.timeframe.comparisonLabel}
          />
        )}

        {activeTab === "forecast" && (
          <ForecastTab initialCurrency={selectedCurrency} />
        )}

        {activeTab === "pricing" && (
          <PricingTab
            initialCurrency={selectedCurrency}
            listings={filterOptions.listings}
          />
        )}

        {activeTab === "reports" && (
          <ReportsTab
            initialStartDate={overview.timeframe.startDateKey}
            initialEndDate={overview.timeframe.endDateKey}
          />
        )}
      </div>
    </div>
  );
}
