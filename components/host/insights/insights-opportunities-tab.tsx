"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { HostInsightsData } from "@/services/host-insights.service";
import type {
  HostOpportunitiesOverviewData,
  HostOpportunityItem,
  OpportunityCategory,
  OpportunityPriority,
  OpportunitySort,
  OpportunityStatus,
} from "@/services/host-opportunities.service";

interface InsightsOpportunitiesTabProps {
  data: HostInsightsData["opportunities"];
  selectedListingId?: string | null;
}

const categories: Array<{ id: OpportunityCategory; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "PRICING_AVAILABILITY", label: "Pricing & availability" },
  { id: "LISTING_QUALITY", label: "Listing quality" },
  { id: "REVIEWS_GUEST_EXPERIENCE", label: "Reviews & guest experience" },
  { id: "SEARCH_CONVERSION", label: "Search & conversion" },
  { id: "COMPETITOR_UPDATES", label: "Competitor updates" },
];

const statuses: Array<{ id: OpportunityStatus; label: string }> = [
  { id: "ACTIVE", label: "Active" },
  { id: "SNOOZED", label: "Snoozed" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "DISMISSED", label: "Dismissed" },
];

const priorities: Array<{ id: OpportunityPriority | "ALL"; label: string }> = [
  { id: "ALL", label: "All priorities" },
  { id: "CRITICAL", label: "Critical" },
  { id: "HIGH", label: "High" },
  { id: "MEDIUM", label: "Medium" },
  { id: "LOW", label: "Low" },
];

const sortOptions: Array<{ id: OpportunitySort; label: string }> = [
  { id: "PRIORITY", label: "Recommended priority" },
  { id: "RECENT", label: "Recently detected" },
  { id: "LISTING", label: "Listing name" },
  { id: "CATEGORY", label: "Category" },
];

function priorityClass(priority: OpportunityPriority) {
  if (priority === "CRITICAL") return "bg-rose-50 text-rose-800 border-rose-200";
  if (priority === "HIGH") return "bg-[#FEF9EE] text-[#B45309] border-[#FCDF9C]";
  if (priority === "MEDIUM") return "bg-sky-50 text-sky-800 border-sky-200";
  return "bg-[#F3F4F5] text-[#727272] border-[#EDEDED]";
}

function categoryLabel(category: OpportunityCategory) {
  return categories.find((entry) => entry.id === category)?.label ?? category;
}

function oneWeekFromNow() {
  return new Date(Date.now() + 7 * 86400000).toISOString();
}

export function InsightsOpportunitiesTab({ data, selectedListingId }: InsightsOpportunitiesTabProps) {
  const [overview, setOverview] = useState<HostOpportunitiesOverviewData | null>(null);
  const [category, setCategory] = useState<OpportunityCategory>("ALL");
  const [priority, setPriority] = useState<OpportunityPriority | "ALL">("ALL");
  const [status, setStatus] = useState<OpportunityStatus>("ACTIVE");
  const [sort, setSort] = useState<OpportunitySort>("PRIORITY");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      category,
      status,
      sort,
      page: String(page),
      pageSize: "10",
    });
    if (selectedListingId) params.set("propertyId", selectedListingId);
    if (priority !== "ALL") params.set("priority", priority);
    try {
      const response = await fetch(`/api/v1/host/insights/opportunities?${params}`, {
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to load opportunities.");
      setOverview(payload.data);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "Unable to load opportunities.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [category, page, priority, selectedListingId, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [load]);

  const updateLifecycle = async (item: HostOpportunityItem, action: "dismiss" | "snooze") => {
    setIsUpdating(item.id);
    setMenuFor(null);
    try {
      const response = await fetch(`/api/v1/host/insights/opportunities/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: item.id,
          listingId: item.listingId,
          ...(action === "snooze" ? { snoozedUntil: oneWeekFromNow() } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to update this opportunity.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this opportunity.");
    } finally {
      setIsUpdating(null);
    }
  };

  const items = overview?.opportunities.items ?? [];
  const summary = overview?.summary ?? {
    activeCount: data.totalCount,
    highPriorityCount: 0,
    listingsNeedingAttentionCount: 0,
    resolvedCount: 0,
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ── Section A: Title Header ── */}
      <section className="flex flex-col gap-2 border-b border-[#E5E5E5] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm font-normal text-[#727272]">Actionable recommendations</p>
          <h2 className="mt-1 text-xl sm:text-2xl font-medium tracking-tight text-[#1F1F1F]">Opportunities</h2>
          <p className="mt-1 text-xs sm:text-sm font-normal text-[#727272] leading-relaxed">
            Discover practical ways to improve listing quality, boost search visibility, and increase hosting revenue.
          </p>
        </div>
        <div className="inline-flex self-start sm:self-auto items-center gap-1.5 rounded-full border border-[#EDEDED] bg-white px-3 py-1 text-xs font-medium text-[#727272] shadow-2xs">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time listing analysis</span>
        </div>
      </section>

      {/* ── Section B: KPI Summary Cards (Refined to match Stats QuickStat surface) ── */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Opportunity summary">
        <Summary
          label="Active opportunities"
          value={summary.activeCount}
          detail="Ready for your review"
          accent={summary.activeCount > 0}
          icon={
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          }
        />
        <Summary
          label="High priority"
          value={summary.highPriorityCount}
          detail="Urgent impact on booking performance"
          accent={summary.highPriorityCount > 0}
          icon={
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2v20" />
              <path d="m17 5-5-3-5 3" />
              <path d="m17 19-5 3-5-3" />
            </svg>
          }
        />
        <Summary
          label="Listings needing attention"
          value={summary.listingsNeedingAttentionCount}
          detail="Properties with active suggestions"
          icon={
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
        />
        <Summary
          label="Resolved opportunities"
          value={summary.resolvedCount}
          detail="Completed hosting improvements"
          icon={
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
      </section>

      {/* ── Section C: Top Priority Spotlight ── */}
      {status === "ACTIVE" && overview?.topPriorities.length ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-[#E5E5E5] pb-3">
            <div>
              <p className="text-xs sm:text-sm font-normal text-[#727272]">Urgent actions</p>
              <h3 className="mt-0.5 text-lg sm:text-xl font-medium tracking-tight text-[#1F1F1F]">Top priority opportunities</h3>
            </div>
            <span className="text-xs font-normal text-[#727272]">
              The most impactful improvements detected across your portfolio
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {overview.topPriorities.map((item) => (
              <FeaturedItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Section D: Full Opportunities Queue ── */}
      <section className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between border-b border-[#E5E5E5] pb-3">
          <div>
            <p className="text-xs sm:text-sm font-normal text-[#727272]">Opportunities queue</p>
            <h3 className="mt-0.5 text-lg sm:text-xl font-medium tracking-tight text-[#1F1F1F]">
              {status === "ACTIVE" && overview?.topPriorities.length
                ? "All active opportunities"
                : `${status.charAt(0) + status.slice(1).toLowerCase()} opportunities`}
            </h3>
          </div>
          <span className="text-xs font-normal text-[#727272]">
            Filter by category, priority level, or lifecycle status
          </span>
        </div>

        {/* Filter Toolbar: Category Pills + Styled Filter Dropdowns */}
        <div className="flex flex-col gap-4 rounded-3xl border border-white bg-[#F3F4F5] p-3.5 sm:p-5 shadow-[0_2px_4px_0px_#00000040]">
          {/* Category Tabs */}
          <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Opportunity category">
            {categories.map((entry) => {
              const isSelected = category === entry.id;
              const count = entry.id === "ALL" && overview ? overview.opportunities.countsByCategory.ALL : undefined;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setCategory(entry.id);
                    setPage(1);
                  }}
                  className={`shrink-0 rounded-full px-3.5 sm:px-4 py-2 text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? "bg-[#1F1F1F] text-white shadow-2xs"
                      : "border border-[#D7D7D7] bg-white text-[#727272] hover:border-[#1F1F1F] hover:text-[#1F1F1F]"
                  }`}
                >
                  <span>{entry.label}</span>
                  {count !== undefined && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                        isSelected ? "bg-[#727272] text-white" : "bg-[#F3F4F5] text-[#1F1F1F]"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-Filters: Status, Priority, Sort (stacked full-width on mobile, inline on tablet+) */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-2 sm:gap-2.5 pt-1 w-full">
            <FilterPillSelect
              label="Status"
              value={status}
              options={statuses}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
            />
            <FilterPillSelect
              label="Priority"
              value={priority}
              options={priorities}
              onChange={(next) => {
                setPriority(next);
                setPage(1);
              }}
            />
            <FilterPillSelect
              label="Sort by"
              value={sort}
              options={sortOptions}
              onChange={(next) => {
                setSort(next);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Error Alert */}
        {error ? (
          <div role="alert" className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="cursor-pointer rounded-full bg-[#1F1F1F] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Opportunities List Container */}
        {loading ? (
          <ListSkeleton />
        ) : items.length ? (
          <div className="overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white shadow-2xs">
            <div className="divide-y divide-[#EDEDED]">
              {items.map((item) => (
                <OpportunityRow
                  key={`${item.status}:${item.id}`}
                  item={item}
                  menuOpen={menuFor === item.id}
                  isUpdating={isUpdating === item.id}
                  onMenu={() => setMenuFor(menuFor === item.id ? null : item.id)}
                  onDismiss={() => void updateLifecycle(item, "dismiss")}
                  onSnooze={() => void updateLifecycle(item, "snooze")}
                />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState status={status} />
        )}

        {/* Pagination Bar */}
        {overview && overview.opportunities.totalPages > 1 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#EDEDED] pt-6 text-xs">
            <span className="font-mono text-[#727272] text-center sm:text-left">
              Page {overview.opportunities.page} of {overview.opportunities.totalPages}
            </span>
            <div className="flex justify-center sm:justify-end gap-2">
              <button
                type="button"
                disabled={overview.opportunities.page === 1}
                onClick={() => setPage(overview.opportunities.page - 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D7D7D7] bg-white px-4 py-2 font-medium text-[#1F1F1F] shadow-2xs transition hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={overview.opportunities.page === overview.opportunities.totalPages}
                onClick={() => setPage(overview.opportunities.page + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D7D7D7] bg-white px-4 py-2 font-medium text-[#1F1F1F] shadow-2xs transition hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <span>Next</span>
                <svg
                  className="size-3.5"
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
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  detail,
  icon,
  accent = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="group flex h-full flex-col justify-between rounded-2xl border border-white bg-[#F3F4F5] p-3.5 min-[380px]:p-4 sm:p-5 shadow-[0_2px_4px_0px_#00000040] transition-all duration-300">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs sm:text-sm font-normal text-[#727272] truncate">{label}</p>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-all ${
            accent
              ? "border-[#FCDF9C] bg-[#FCDF9C] text-[#1F1F1F]"
              : "border-[#EDEDED] bg-white text-[#727272]"
          }`}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="mt-2.5 sm:mt-4 text-xl min-[380px]:text-2xl sm:text-3xl font-medium tracking-tight text-[#1F1F1F]">
          {value}
        </p>
        <p className="mt-1 text-[11px] sm:text-xs font-normal leading-relaxed text-[#727272] line-clamp-1 min-[420px]:line-clamp-none">{detail}</p>
      </div>
    </div>
  );
}

function FilterPillSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (val: T) => void;
}) {
  const currentLabel = options.find((opt) => opt.id === value)?.label || value;
  return (
    <div className="relative w-full sm:w-auto text-left">
      <div className="group flex h-10 w-full sm:w-auto items-center justify-between gap-2.5 rounded-full border border-[#D7D7D7] bg-white px-3.5 text-xs font-medium text-[#1F1F1F] shadow-2xs transition-all hover:border-[#1F1F1F] focus-within:border-[#1F1F1F] cursor-pointer">
        <span className="truncate">
          <span className="text-[#727272] font-normal mr-1">{label}:</span>
          <span>{currentLabel}</span>
        </span>
        <svg
          className="size-3.5 shrink-0 text-[#727272] transition-colors group-hover:text-[#1F1F1F]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FeaturedItem({ item }: { item: HostOpportunityItem }) {
  return (
    <article className="group flex h-full flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-5 sm:p-6 shadow-2xs transition-all duration-300 hover:border-[#1F1F1F] hover:shadow-xs">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${priorityClass(item.priority)}`}>
              {item.priority}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-[#727272]">
              {categoryLabel(item.category)}
            </span>
          </div>
          <span className="truncate text-xs font-normal text-[#727272] bg-[#FAFAFB] border border-[#EDEDED] px-2.5 py-0.5 rounded-full max-w-[170px] sm:max-w-[200px]">
            {item.listingTitle}
          </span>
        </div>
        <h4 className="mt-3 text-base sm:text-lg font-medium text-[#1F1F1F] leading-snug">
          {item.title}
        </h4>
        <div className="mt-3.5 rounded-2xl border border-[#EDEDED] bg-[#FAFAFB] p-3 sm:p-3.5">
          <div className="flex items-start gap-2.5">
            <svg
              className="size-4 shrink-0 text-[#1F1F1F] mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div className="min-w-0 flex-1 text-xs">
              <span className="font-medium text-[#1F1F1F]">Why it matters: </span>
              <span className="text-[#727272] leading-relaxed">{item.evidence}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mt-5 flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-3 border-t border-[#EDEDED] pt-3">
        <Link
          href={item.actionHref}
          className="group/btn inline-flex w-full min-[420px]:w-auto justify-center items-center gap-2 rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-medium text-white shadow-2xs transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
        >
          <span>{item.actionLabel}</span>
          <svg
            className="size-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5"
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
        <span className="text-xs font-normal text-[#727272] text-right">Impact: High</span>
      </div>
    </article>
  );
}

function OpportunityRow({
  item,
  menuOpen,
  isUpdating,
  onMenu,
  onDismiss,
  onSnooze,
}: {
  item: HostOpportunityItem;
  menuOpen: boolean;
  isUpdating: boolean;
  onMenu: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  return (
    <article className="group relative flex flex-col gap-4 p-4.5 sm:p-6 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-[#FAFAFB]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${priorityClass(item.priority)}`}>
            {item.priority}
          </span>
          <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 text-[11px] font-medium text-[#1F1F1F] shrink-0">
            {categoryLabel(item.category)}
          </span>
          <span className="text-xs text-[#727272] flex items-center gap-1 min-w-0">
            <svg className="size-3 text-[#727272] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="truncate max-w-[140px] sm:max-w-[200px]">{item.listingTitle}</span>
          </span>
        </div>
        <h3 className="mt-2 text-base font-medium text-[#1F1F1F]">{item.title}</h3>
        <p className="mt-1 text-xs sm:text-sm font-normal text-[#727272] leading-relaxed">{item.description}</p>
        <div className="mt-2.5 flex flex-col min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center gap-x-4 gap-y-1 text-xs text-[#727272]">
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-[#1F1F1F] shrink-0">Evidence:</span>
            <span className="truncate">{item.evidence}</span>
          </span>
          {item.snoozedUntil && (
            <span className="inline-flex items-center gap-1 text-[#D97706] shrink-0">
              <svg className="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Snoozed until {new Date(item.snoozedUntil).toLocaleDateString()}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5 pt-1 sm:pt-0 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
        <Link
          href={item.actionHref}
          className="group/btn flex-1 sm:flex-initial inline-flex justify-center items-center gap-1.5 rounded-full bg-[#1F1F1F] px-4.5 py-2 text-xs font-medium text-white shadow-2xs transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
        >
          <span>{item.actionLabel}</span>
          <svg
            className="size-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5"
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
        {item.status === "ACTIVE" && item.dismissible && (
          <div className="relative shrink-0">
            <button
              type="button"
              aria-label={`More actions for ${item.title}`}
              onClick={onMenu}
              className="flex size-8 items-center justify-center rounded-full border border-[#D7D7D7] bg-white text-[#727272] transition-colors hover:border-[#1F1F1F] hover:text-[#1F1F1F] cursor-pointer"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1.5 w-36 rounded-2xl border border-[#E5E5E5] bg-white p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={onSnooze}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-[#1F1F1F] hover:bg-[#F9F9F9] disabled:opacity-50 cursor-pointer"
                >
                  Snooze 7 days
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={onDismiss}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyState({ status }: { status: OpportunityStatus }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#D7D7D7] bg-[#FAFAFB] p-10 sm:p-14 text-center shadow-2xs">
      <div className="mx-auto mb-3.5 flex size-12 items-center justify-center rounded-full border border-[#EDEDED] bg-white text-[#1F1F1F] shadow-2xs">
        <svg
          className="size-6 text-[#727272]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      <h3 className="text-base font-medium text-[#1F1F1F]">
        {status === "ACTIVE" ? "No active opportunities" : `No ${status.toLowerCase()} opportunities`}
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm font-normal text-[#727272] leading-relaxed">
        {status === "ACTIVE"
          ? "Your portfolio is currently well optimized. Check back as new guest searches and competitor changes are detected."
          : "Items with this lifecycle status will appear here."}
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E5E5E5] bg-white animate-pulse shadow-2xs">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 border-b border-[#EDEDED] p-4.5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2.5 flex-1">
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full bg-[#F3F4F5]" />
              <div className="h-5 w-24 rounded-full bg-[#F3F4F5]" />
            </div>
            <div className="h-4 w-2/5 rounded bg-[#F3F4F5]" />
            <div className="h-3 w-3/5 rounded bg-[#FAFAFA]" />
          </div>
          <div className="h-9 w-28 rounded-full bg-[#F3F4F5]" />
        </div>
      ))}
    </div>
  );
}
