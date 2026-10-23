"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { HostInsightsData } from "@/services/host-insights.service";
import type {
  HostOpportunityItem,
  ListingHealthSummary,
  OpportunityCategory,
} from "@/services/host-opportunities.service";

interface InsightsOpportunitiesTabProps {
  data: HostInsightsData["opportunities"];
  selectedListingId?: string | null;
}

export function InsightsOpportunitiesTab({
  data,
  selectedListingId,
}: InsightsOpportunitiesTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<OpportunityCategory>("ALL");
  const [items, setItems] = useState<HostOpportunityItem[]>(
    data.items.map((i) => ({
      ...i,
      listingId: i.listingId ?? "host",
      listingTitle: i.listingTitle ?? "Your hosting",
      category: i.category as OpportunityCategory,
      impact: (i.impact as "High" | "Medium" | "Low") || "Medium",
      status: "AVAILABLE",
      dismissible: i.priority !== "CRITICAL",
    })),
  );
  const [healthData, setHealthData] = useState<{
    averageCompletenessPercentage: number;
    completedChecksCount: number;
    totalChecksCount: number;
    listingsHealth: ListingHealthSummary[];
  } | null>(null);
  const [activeModalItem, setActiveModalItem] = useState<HostOpportunityItem | null>(null);
  const [isDismissing, setIsDismissing] = useState<string | null>(null);

  // Fetch full opportunity rules and health details on mount or listing switch
  useEffect(() => {
    let isMounted = true;
    const fetchOpportunities = async () => {
      try {
        const query = selectedListingId ? `?propertyId=${selectedListingId}` : "";
        const res = await fetch(`/api/v1/host/insights/opportunities${query}`);
        const payload = await res.json();
        if (payload?.data && isMounted) {
          if (payload.data.opportunities?.items) {
            setItems(payload.data.opportunities.items);
          }
          if (payload.data.overallHealth) {
            setHealthData(payload.data.overallHealth);
          }
        }
      } catch {
        // Fallback to initial items on error
      }
    };

    void fetchOpportunities();
    return () => {
      isMounted = false;
    };
  }, [selectedListingId]);

  const handleDismiss = async (e: React.MouseEvent, item: HostOpportunityItem) => {
    e.stopPropagation();
    setIsDismissing(item.id);
    try {
      const res = await fetch("/api/v1/host/insights/opportunities/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: item.id,
          listingId: item.listingId,
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        if (activeModalItem?.id === item.id) {
          setActiveModalItem(null);
        }
      }
    } finally {
      setIsDismissing(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedCategory === "ALL") return true;
    return item.category === selectedCategory;
  });

  const categories: Array<{ id: OpportunityCategory; label: string }> = [
    { id: "ALL", label: `All (${items.length})` },
    { id: "PHOTOS", label: "Photos" },
    { id: "AMENITIES", label: "Amenities" },
    { id: "FAMILY", label: "Family" },
    { id: "WORKSPACE", label: "Workspace" },
    { id: "SETTINGS", label: "Settings" },
    { id: "PRICING", label: "Discounts & Pricing" },
    { id: "REVIEWS", label: "Reviews" },
    { id: "CALENDAR", label: "Calendar" },
  ];

  const priorityStyle = (priority: HostOpportunityItem["priority"]) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "HIGH":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "MEDIUM":
        return "bg-sky-50 text-sky-800 border-sky-200";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  // Compute completeness score from health data or dashboard data
  const completenessPct =
    healthData?.averageCompletenessPercentage ??
    (data.totalChecksCount > 0 ? Math.round((data.completedChecksCount / data.totalChecksCount) * 100) : 100);

  const completedChecks = healthData?.completedChecksCount ?? data.completedChecksCount;
  const totalChecks = healthData?.totalChecksCount ?? data.totalChecksCount;

  return (
    <div className="space-y-8">
      {/* Listing Health & Completeness Section */}
      <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-[#EDEDED] pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#727272]">Quality Benchmark</p>
            <h2 className="mt-1 text-xl font-bold text-[#1F1F1F]">Listing Health & Completeness</h2>
            <p className="mt-0.5 text-xs text-[#727272]">
              Evaluated across 14 core listing readiness checks including photos, amenities, rules, and booking settings
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-[#1F1F1F] font-mono sm:text-4xl">
              {completenessPct}%
            </span>
            <span className="text-xs font-semibold text-[#727272]">Completeness</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1F1F1F] mb-2">
            <span>Overall profile readiness</span>
            <span className="font-mono text-[#727272]">
              {completedChecks} of {totalChecks} checks completed
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-[#F3F4F5] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completenessPct >= 90 ? "bg-emerald-600" : completenessPct >= 70 ? "bg-[#1F1F1F]" : "bg-amber-600"
              }`}
              style={{ width: `${Math.min(100, completenessPct)}%` }}
            />
          </div>
        </div>

        {/* Detailed Property Health Checklist if single listing */}
        {healthData?.listingsHealth && healthData.listingsHealth.length > 0 && (
          <div className="mt-6 divide-y divide-[#EDEDED] border-t border-[#EDEDED] pt-4">
            {healthData.listingsHealth.map((prop) => (
              <div key={prop.listingId} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F1F1F]">{prop.title}</span>
                  <span className="text-xs font-mono font-bold text-[#727272]">
                    {prop.completenessPercentage}% ({prop.completedChecksCount}/{prop.totalChecksCount})
                  </span>
                </div>
                {prop.missingCount > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {prop.checks
                      .filter((c) => !c.isComplete)
                      .slice(0, 4)
                      .map((c) => (
                        <Link
                          key={c.id}
                          href={c.actionHref}
                          className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-900 border border-amber-200 hover:bg-amber-100"
                        >
                          + Add {c.label}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Category Filter Pills & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F1F1F]">Hosting opportunities</h2>
          <p className="mt-0.5 text-xs text-[#727272]">
            Actionable listing recommendations to increase booking appeal and guest satisfaction
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? "bg-[#1F1F1F] text-white"
                  : "bg-[#F3F4F5] text-[#1F1F1F] border border-[#EDEDED] hover:bg-[#E5E5E5]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredItems.map((opp) => (
            <div
              key={opp.id}
              className="flex flex-col justify-between rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm transition hover:border-[#1F1F1F]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${priorityStyle(
                        opp.priority,
                      )}`}
                    >
                      {opp.priority}
                    </span>
                    <span className="rounded-full bg-[#F3F4F5] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#727272]">
                      {opp.category}
                    </span>
                  </div>
                  {opp.listingTitle && (
                    <span className="max-w-[160px] truncate text-xs font-medium text-[#727272]">
                      {opp.listingTitle}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-base font-bold text-[#1F1F1F]">{opp.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#727272]">{opp.description}</p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#EDEDED] pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[#727272]">Impact: {opp.impact}</span>
                  {opp.dismissible && (
                    <button
                      type="button"
                      disabled={isDismissing === opp.id}
                      onClick={(e) => void handleDismiss(e, opp)}
                      className="text-[11px] font-medium text-[#727272] underline hover:text-[#1F1F1F] disabled:opacity-50 cursor-pointer"
                    >
                      {isDismissing === opp.id ? "Dismissing..." : "Dismiss"}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalItem(opp)}
                    className="cursor-pointer rounded-full border border-[#D7D7D7] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1F1F1F] shadow-2xs transition hover:border-[#1F1F1F] hover:bg-[#F3F4F5]"
                  >
                    Details
                  </button>
                  <Link
                    href={opp.actionHref}
                    className="rounded-full bg-[#1F1F1F] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
                  >
                    {opp.actionLabel} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-[#E5E5E5] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 border border-emerald-200">
            ✓
          </div>
          <h3 className="mt-4 text-xl font-bold text-[#1F1F1F]">No opportunities at this time</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#727272]">
            Great job! Your listings meet our core quality benchmarks with complete photos, amenities, and accurate
            details.
          </p>
          <Link
            href="/host/listings"
            className="mt-6 inline-flex rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
          >
            Manage all listings
          </Link>
        </div>
      )}

      {/* Opportunity Detail Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-center justify-between border-b border-[#EDEDED] pb-4">
              <div>
                <span className="rounded-full bg-[#F3F4F5] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#727272]">
                  {activeModalItem.category}
                </span>
                <h3 className="mt-1 text-lg font-bold text-[#1F1F1F]">{activeModalItem.title}</h3>
                <p className="text-xs text-[#727272]">{activeModalItem.listingTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#727272] hover:bg-[#F3F4F5] hover:text-[#1F1F1F] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="leading-relaxed text-[#1F1F1F]">{activeModalItem.description}</p>

              {activeModalItem.currentValueDescription && (
                <div className="rounded-2xl border border-[#EDEDED] bg-[#F9F9F9] p-3.5">
                  <p className="font-semibold text-[#1F1F1F]">Current setting</p>
                  <p className="mt-0.5 text-[#727272]">{activeModalItem.currentValueDescription}</p>
                </div>
              )}

              {activeModalItem.recommendedChangeDescription && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                  <p className="font-semibold text-emerald-950">Recommended enhancement</p>
                  <p className="mt-0.5 text-emerald-800">{activeModalItem.recommendedChangeDescription}</p>
                </div>
              )}

              <div className="rounded-2xl border border-[#EDEDED] bg-[#F9F9F9] p-3 text-[11px] text-[#727272]">
                <span>Deterministic rule · Estimated impact: </span>
                <span className="font-semibold text-[#1F1F1F]">{activeModalItem.impact}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[#EDEDED] pt-4">
              {activeModalItem.dismissible ? (
                <button
                  type="button"
                  disabled={isDismissing === activeModalItem.id}
                  onClick={(e) => void handleDismiss(e, activeModalItem)}
                  className="text-xs font-semibold text-[#727272] underline hover:text-[#1F1F1F] disabled:opacity-50 cursor-pointer"
                >
                  {isDismissing === activeModalItem.id ? "Dismissing..." : "Dismiss recommendation"}
                </button>
              ) : (
                <span className="text-[11px] text-[#727272]">Mandatory requirement</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalItem(null)}
                  className="cursor-pointer rounded-full border border-[#D7D7D7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F3F4F5]"
                >
                  Close
                </button>
                <Link
                  href={activeModalItem.actionHref}
                  onClick={() => setActiveModalItem(null)}
                  className="rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
                >
                  {activeModalItem.actionLabel} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
