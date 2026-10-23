"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HostInsightsData } from "@/services/host-insights.service";
import type { HostOpportunitiesOverviewData, HostOpportunityItem, OpportunityCategory, OpportunityPriority, OpportunitySort, OpportunityStatus } from "@/services/host-opportunities.service";

interface InsightsOpportunitiesTabProps { data: HostInsightsData["opportunities"]; selectedListingId?: string | null; }

const categories: Array<{ id: OpportunityCategory; label: string }> = [
  { id: "ALL", label: "All" }, { id: "PRICING_AVAILABILITY", label: "Pricing & availability" },
  { id: "LISTING_QUALITY", label: "Listing quality" }, { id: "REVIEWS_GUEST_EXPERIENCE", label: "Reviews & guest experience" },
  { id: "SEARCH_CONVERSION", label: "Search & conversion" }, { id: "COMPETITOR_UPDATES", label: "Competitor updates" },
];
const statuses: Array<{ id: OpportunityStatus; label: string }> = [
  { id: "ACTIVE", label: "Active" }, { id: "SNOOZED", label: "Snoozed" }, { id: "RESOLVED", label: "Resolved" }, { id: "DISMISSED", label: "Dismissed" },
];

function priorityClass(priority: OpportunityPriority) {
  if (priority === "CRITICAL") return "bg-rose-50 text-rose-800 ring-rose-200";
  if (priority === "HIGH") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (priority === "MEDIUM") return "bg-sky-50 text-sky-800 ring-sky-200";
  return "bg-zinc-100 text-zinc-700 ring-zinc-200";
}
function categoryLabel(category: OpportunityCategory) { return categories.find((entry) => entry.id === category)?.label ?? category; }
function oneWeekFromNow() { return new Date(Date.now() + 7 * 86400000).toISOString(); }

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
    setLoading(true); setError(null);
    const params = new URLSearchParams({ category, status, sort, page: String(page), pageSize: "10" });
    if (selectedListingId) params.set("propertyId", selectedListingId);
    if (priority !== "ALL") params.set("priority", priority);
    try {
      const response = await fetch(`/api/v1/host/insights/opportunities?${params}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to load opportunities.");
      setOverview(payload.data);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Unable to load opportunities.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [category, page, priority, selectedListingId, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [load]);

  const updateLifecycle = async (item: HostOpportunityItem, action: "dismiss" | "snooze") => {
    setIsUpdating(item.id); setMenuFor(null);
    try {
      const response = await fetch(`/api/v1/host/insights/opportunities/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: item.id, listingId: item.listingId, ...(action === "snooze" ? { snoozedUntil: oneWeekFromNow() } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Unable to update this opportunity.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this opportunity."); }
    finally { setIsUpdating(null); }
  };

  const items = overview?.opportunities.items ?? [];
  const summary = overview?.summary ?? { activeCount: data.totalCount, highPriorityCount: 0, listingsNeedingAttentionCount: 0, resolvedCount: 0 };
  return <div className="space-y-7">
    <section className="flex flex-col gap-3 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-2xl font-bold tracking-tight text-zinc-950">Opportunities</h2><p className="mt-1 text-sm text-zinc-600">Discover practical ways to improve your listings and hosting performance.</p></div>
      <p className="text-xs text-zinc-500">Recommendations use current listing data and supported comparison evidence.</p>
    </section>

    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4" aria-label="Opportunity summary">
      <Summary label="Active opportunities" value={summary.activeCount} />
      <Summary label="High priority" value={summary.highPriorityCount} />
      <Summary label="Listings needing attention" value={summary.listingsNeedingAttentionCount} />
      <Summary label="Resolved opportunities" value={summary.resolvedCount} />
    </section>

    {status === "ACTIVE" && overview?.topPriorities.length ? <section>
      <div className="mb-3 flex items-end justify-between"><div><h3 className="text-lg font-bold text-zinc-950">Top priority</h3><p className="mt-0.5 text-xs text-zinc-500">The most urgent, actionable items in your current scope.</p></div></div>
      <div className="grid gap-3 lg:grid-cols-2">{overview.topPriorities.map((item) => <FeaturedItem key={item.id} item={item} />)}</div>
    </section> : null}

    <section className="space-y-4">
      {status === "ACTIVE" && overview?.topPriorities.length ? <div><h3 className="text-lg font-bold text-zinc-950">Remaining active opportunities</h3><p className="mt-0.5 text-xs text-zinc-500">Top-priority items are shown above; use filters to view the full active queue.</p></div> : null}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Opportunity category">
          {categories.map((entry) => <button key={entry.id} type="button" onClick={() => { setCategory(entry.id); setPage(1); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === entry.id ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>{entry.label}{entry.id === "ALL" && overview ? ` (${overview.opportunities.countsByCategory.ALL})` : ""}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Opportunity status" value={status} onChange={(event) => { setStatus(event.target.value as OpportunityStatus); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800"><>{statuses.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</></select>
          <select aria-label="Opportunity priority" value={priority} onChange={(event) => { setPriority(event.target.value as OpportunityPriority | "ALL"); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800"><option value="ALL">All priorities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
          <select aria-label="Sort opportunities" value={sort} onChange={(event) => { setSort(event.target.value as OpportunitySort); setPage(1); }} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800"><option value="PRIORITY">Recommended priority</option><option value="RECENT">Recently detected</option><option value="LISTING">Listing name</option><option value="CATEGORY">Category</option></select>
        </div>
      </div>
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Retry</button></div> : null}
      {loading ? <ListSkeleton /> : items.length ? <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"><div className="divide-y divide-zinc-100">{items.map((item) => <OpportunityRow key={`${item.status}:${item.id}`} item={item} menuOpen={menuFor === item.id} isUpdating={isUpdating === item.id} onMenu={() => setMenuFor(menuFor === item.id ? null : item.id)} onDismiss={() => void updateLifecycle(item, "dismiss")} onSnooze={() => void updateLifecycle(item, "snooze")} />)}</div></div> : <EmptyState status={status} />}
      {overview && overview.opportunities.totalPages > 1 ? <div className="flex items-center justify-between text-sm"><span className="text-zinc-500">Page {overview.opportunities.page} of {overview.opportunities.totalPages}</span><div className="flex gap-2"><button type="button" disabled={overview.opportunities.page === 1} onClick={() => setPage(overview.opportunities.page - 1)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={overview.opportunities.page === overview.opportunities.totalPages} onClick={() => setPage(overview.opportunities.page + 1)} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold disabled:opacity-40">Next</button></div></div> : null}
    </section>
  </div>;
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="bg-white p-4 sm:p-5"><p className="text-xs font-medium text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">{value}</p></div>; }
function FeaturedItem({ item }: { item: HostOpportunityItem }) { return <article className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${priorityClass(item.priority)}`}>{item.priority}</span><span className="truncate text-xs text-zinc-500">{item.listingTitle}</span></div><h4 className="mt-3 font-bold text-zinc-950">{item.title}</h4><p className="mt-1 text-sm text-zinc-600">{item.evidence}</p><Link href={item.actionHref} className="mt-4 inline-flex text-xs font-bold text-zinc-950 underline underline-offset-4">{item.actionLabel} →</Link></article>; }
function OpportunityRow({ item, menuOpen, isUpdating, onMenu, onDismiss, onSnooze }: { item: HostOpportunityItem; menuOpen: boolean; isUpdating: boolean; onMenu: () => void; onDismiss: () => void; onSnooze: () => void }) { return <article className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${priorityClass(item.priority)}`}>{item.priority}</span><span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{categoryLabel(item.category)}</span><span className="text-[11px] text-zinc-400">{item.listingTitle}</span></div><h3 className="mt-2 text-sm font-bold text-zinc-950">{item.title}</h3><p className="mt-1 text-sm text-zinc-600">{item.description}</p><p className="mt-2 text-xs text-zinc-500"><span className="font-semibold text-zinc-700">Evidence:</span> {item.evidence}</p>{item.snoozedUntil ? <p className="mt-1 text-xs text-zinc-500">Snoozed until {new Date(item.snoozedUntil).toLocaleDateString()}</p> : null}</div><div className="flex shrink-0 items-center gap-2"><Link href={item.actionHref} className="rounded-lg bg-zinc-950 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-800">{item.actionLabel}</Link>{item.status === "ACTIVE" && item.dismissible ? <div className="relative"><button type="button" aria-label={`More actions for ${item.title}`} onClick={onMenu} className="rounded-lg border border-zinc-300 px-2.5 py-2 text-xs font-bold text-zinc-700">•••</button>{menuOpen ? <div className="absolute right-0 z-10 mt-1 w-36 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg"><button type="button" disabled={isUpdating} onClick={onSnooze} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-zinc-50 disabled:opacity-50">Snooze 7 days</button><button type="button" disabled={isUpdating} onClick={onDismiss} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">Dismiss</button></div> : null}</div> : null}</div></article>; }
function EmptyState({ status }: { status: OpportunityStatus }) { return <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center"><h3 className="font-bold text-zinc-950">{status === "ACTIVE" ? "No active opportunities" : `No ${status.toLowerCase()} opportunities`}</h3><p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">{status === "ACTIVE" ? "There are no supported actions in this scope right now." : "Items with this lifecycle status will appear here."}</p></div>; }
function ListSkeleton() { return <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white animate-pulse">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 border-b border-zinc-100 p-5"><div className="h-3 w-36 rounded bg-zinc-200" /><div className="mt-4 h-4 w-2/5 rounded bg-zinc-200" /><div className="mt-3 h-3 w-3/5 rounded bg-zinc-100" /></div>)}</div>; }
