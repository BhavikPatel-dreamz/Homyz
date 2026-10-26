"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HostInsightsData, InsightsTab } from "@/services/host-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";
import { useCurrency } from "@/lib/currency-context";
import { InsightsHeader } from "@/components/host/insights/insights-header";
import { InsightsTabNav } from "@/components/host/insights/insights-tab-nav";
import { InsightsReviewsTab } from "@/components/host/insights/insights-reviews-tab";
import { InsightsStatsTab } from "@/components/host/insights/insights-stats-tab";
import { InsightsOpportunitiesTab } from "@/components/host/insights/insights-opportunities-tab";
import { InsightsSuperhostTab } from "@/components/host/insights/insights-superhost-tab";

interface HostInsightsClientProps {
  initialData: HostInsightsData;
}

export function HostInsightsClient({ initialData }: HostInsightsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<HostInsightsData>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const hasMountedSearchEffect = useRef(false);
  const { currency: globalDisplayCurrency } = useCurrency();
  const prevGlobalCurrency = useRef(globalDisplayCurrency);

  const query = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const requestedTab = searchParams.get("tab");
  const activeTab: InsightsTab = requestedTab === "reviews" || requestedTab === "stats" || requestedTab === "opportunities" || requestedTab === "superhost"
    ? requestedTab
    : data.activeTab || "reviews";

  const loadData = useCallback(async (params: URLSearchParams) => {
    const requestId = ++requestSequence.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/host/insights?${params.toString()}`, { signal: controller.signal, cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message || "Failed to load insights data.");
      if (payload.data && requestId === requestSequence.current) {
        setData(payload.data);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : "Unable to load insights data.");
      }
    } finally {
      if (requestId === requestSequence.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const updateFilters = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(query);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }, [pathname, query, router]);

  const handleTabChange = (newTab: InsightsTab) => {
    updateFilters({ tab: newTab });
  };

  const handleListingChange = (listingId: string | null) => {
    updateFilters({ propertyId: listingId });
  };

  const handlePeriodChange = (period: DateRangePreset) => {
    updateFilters({ period, ...(period === "custom" ? {} : { startDate: null, endDate: null }) });
  };

  const handleCustomDateChange = (startDate: string, endDate: string) => {
    if (startDate && endDate && startDate > endDate) {
      setError("The custom start date must be on or before the end date.");
      return;
    }
    updateFilters({ period: "custom", startDate: startDate || null, endDate: endDate || null });
  };

  useEffect(() => {
    if (hasMountedSearchEffect.current) {
      void loadData(new URLSearchParams(searchParams.toString()));
    } else {
      hasMountedSearchEffect.current = true;
    }
  }, [searchParams, loadData]);

  // Real-time synchronization: when the user changes main currency in the global "Languages & currency" modal
  useEffect(() => {
    if (globalDisplayCurrency && prevGlobalCurrency.current !== globalDisplayCurrency) {
      prevGlobalCurrency.current = globalDisplayCurrency;
      updateFilters({ currency: globalDisplayCurrency });
    }
  }, [globalDisplayCurrency, updateFilters]);

  return (
    <div className="space-y-8">
      {/* Header with Title and Filters */}
      <InsightsHeader
        activeTab={activeTab}
        listings={data.listings}
        selectedListingId={data.selectedListingId}
        onListingChange={handleListingChange}
        selectedPeriod={data.reportingPeriod.preset}
        onPeriodChange={handlePeriodChange}
        startDate={query.get("startDate") || undefined}
        endDate={query.get("endDate") || undefined}
        onCustomDateChange={handleCustomDateChange}
        periodLabel={data.reportingPeriod.label}
      />

      {/* 4-Tab Navigation */}
      <InsightsTabNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        reviewCount={data.reviews.totalReviewsCount}
        opportunitiesCount={data.opportunities.totalCount}
      />

      {/* Error state */}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadData(query)}
            className="cursor-pointer rounded-full bg-[#1F1F1F] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Active Tab View */}
      <div aria-busy={isLoading} className={`transition-opacity duration-200 ${isPending ? "opacity-60" : "opacity-100"}`}>
        {isLoading ? <InsightsContentSkeleton tab={activeTab} /> : <>
        {activeTab === "reviews" && (
          <InsightsReviewsTab
            data={data.reviews}
            periodLabel={data.reportingPeriod.label}
            selectedListingId={data.selectedListingId}
            selectedPeriod={data.reportingPeriod.preset}
            startDate={query.get("startDate") || undefined}
            endDate={query.get("endDate") || undefined}
          />
        )}

        {activeTab === "stats" && (
          <InsightsStatsTab
            data={data.stats}
            entitlements={data.entitlements}
            periodLabel={data.reportingPeriod.label}
            reviews={data.reviews}
            opportunities={data.opportunities}
          />
        )}

        {activeTab === "opportunities" && (
          <InsightsOpportunitiesTab
            data={data.opportunities}
            selectedListingId={data.selectedListingId}
          />
        )}

        {activeTab === "superhost" && (
          <InsightsSuperhostTab data={data.superhost} />
        )}
        </>}
      </div>
    </div>
  );
}

function InsightsContentSkeleton({ tab }: { tab: InsightsTab }) {
  if (tab === "stats") {
    return <div className="space-y-10 animate-pulse" aria-label="Loading statistics">
      <section><div className="h-5 w-40 rounded bg-[#F3F4F5]" /><div className="mt-5 grid grid-cols-2 gap-px bg-[#E5E5E5] sm:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="min-h-36 bg-white p-5"><div className="h-3 w-20 rounded bg-[#F3F4F5]" /><div className="mt-5 h-8 w-24 rounded bg-[#F3F4F5]" /><div className="mt-3 h-3 w-32 rounded bg-[#F9F9F9]" /></div>)}</div></section>
      <section><div className="h-5 w-56 rounded bg-[#F3F4F5]" /><div className="mt-5 grid gap-5 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 rounded-3xl border border-[#E5E5E5] bg-white p-5"><div className="h-4 w-24 rounded bg-[#F3F4F5]" /><div className="mt-8 h-32 rounded bg-[#F9F9F9]" /></div>)}</div></section>
      <section><div className="h-5 w-44 rounded bg-[#F3F4F5]" /><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 border-b border-[#E5E5E5]"><div className="h-3 w-24 rounded bg-[#F3F4F5]" /><div className="mt-4 h-7 w-20 rounded bg-[#F3F4F5]" /></div>)}</div></section>
    </div>;
  }

  return <div className="space-y-5 animate-pulse" aria-label="Loading insights">
    <div className="h-8 w-52 rounded bg-[#F3F4F5]" />
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9]" />)}
  </div>;
}
