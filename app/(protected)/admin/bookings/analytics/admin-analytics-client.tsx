"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/lib/currency-context";

type Period = "today" | "7d" | "30d" | "this_month" | "last_month" | "90d" | "this_year" | "custom";
type MoneyByCurrency = Record<string, number>;
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Overview = {
  dateRange: { start: string; end: string; period: string };
  kpi: { totalBookings: number; confirmedBookings: number; completedBookings: number; cancelledBookings: number; pendingBookings: number; cancellationRate: number; currencies: Record<string, { grossCaptured: number; refunded: number; netCollected: number }> };
  statusDistribution: Record<string, number>;
  bookingTrends: Array<{ date: string; newBookings: number; confirmed: number; completed: number; cancelled: number }>;
  cancellationAnalytics: { reasons: Record<string, number> };
  paymentPerformance: { totalAttempts: number; successfulCaptures: number; failedAttempts: number; providers: Record<string, { count: number; volumeByCurrency: MoneyByCurrency }> };
  disputeAnalytics: { activeCases: number };
};
type PropertyRow = { listingId: string; title: string; city: string | null; host: { name: string | null }; totalBookings: number; completedStays: number; cancellations: number; grossBookingValueByCurrency: MoneyByCurrency; grossCapturedByCurrency: MoneyByCurrency; successfulRefundsByCurrency: MoneyByCurrency; netFinancialVolumeByCurrency: MoneyByCurrency };
type HostRow = { hostId: string; name: string | null; email: string | null; listingCount: number; totalBookings: number; completedStays: number; cancellations: number; grossBookingValueByCurrency: MoneyByCurrency; recordedNetHostPayoutByCurrency: MoneyByCurrency };

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" }, { id: "7d", label: "Last 7 Days" }, { id: "30d", label: "Last 30 Days" },
  { id: "this_month", label: "This Month" }, { id: "last_month", label: "Last Month" }, { id: "90d", label: "Last 90 Days" }, { id: "this_year", label: "This Year" },
];

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return debounced;
}

function unwrapApi<T>(payload: unknown): T {
  return payload && typeof payload === "object" && "data" in payload ? (payload as { data: T }).data : payload as T;
}

export function AdminAnalyticsClient({ initialOverview, initialPeriod }: { initialOverview: Overview; initialPeriod: Period }) {
  const { formatPrice } = useCurrency();
  const [period, setPeriod] = useState<Period>(initialPeriod || "30d");
  const [overview, setOverview] = useState(initialOverview);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [propertyPagination, setPropertyPagination] = useState<Pagination | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(true);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [propSearch, setPropSearch] = useState("");
  const [propPage, setPropPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeZeroActivity, setIncludeZeroActivity] = useState(false);
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [hostPagination, setHostPagination] = useState<Pagination | null>(null);
  const [hostLoading, setHostLoading] = useState(true);
  const [hostError, setHostError] = useState<string | null>(null);
  const [hostSearch, setHostSearch] = useState("");
  const [hostPage, setHostPage] = useState(1);
  const debouncedPropSearch = useDebouncedValue(propSearch.trim());
  const debouncedHostSearch = useDebouncedValue(hostSearch.trim());
  const overviewRequest = useRef(0);

  const formatMoney = useCallback((amounts: MoneyByCurrency, empty = "—") => {
    const entries = Object.entries(amounts).sort(([a], [b]) => a.localeCompare(b));
    return entries.length ? entries.map(([currency, amount]) => formatPrice(amount, currency)).join(" · ") : empty;
  }, [formatPrice]);

  const fetchOverview = useCallback(async (selectedPeriod: Period) => {
    const requestId = ++overviewRequest.current;
    setOverviewLoading(true); setOverviewError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/analytics/overview?period=${selectedPeriod}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to refresh analytics.");
      const data = unwrapApi<Overview>(await res.json());
      if (requestId === overviewRequest.current) setOverview(data);
    } catch (error) {
      if (requestId === overviewRequest.current) setOverviewError(error instanceof Error ? error.message : "Unable to refresh analytics.");
    } finally { if (requestId === overviewRequest.current) setOverviewLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ period, page: String(propPage), limit: "20", includeInactive: String(includeInactive), includeZeroActivity: String(includeZeroActivity) });
    if (debouncedPropSearch) params.set("search", debouncedPropSearch);
    fetch(`/api/v1/admin/bookings/analytics/properties?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => { if (!res.ok) throw new Error("Unable to load property performance."); return unwrapApi<{ properties: PropertyRow[]; pagination: Pagination }>(await res.json()); })
      .then((data) => { setProperties(data.properties); setPropertyPagination(data.pagination); })
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setPropertyError(error instanceof Error ? error.message : "Unable to load property performance."); })
      .finally(() => { if (!controller.signal.aborted) setPropertyLoading(false); });
    return () => controller.abort();
  }, [period, propPage, debouncedPropSearch, includeInactive, includeZeroActivity, refreshVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ period, page: String(hostPage), limit: "20" });
    if (debouncedHostSearch) params.set("search", debouncedHostSearch);
    fetch(`/api/v1/admin/bookings/analytics/hosts?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => { if (!res.ok) throw new Error("Unable to load Host performance."); return unwrapApi<{ hosts: HostRow[]; pagination: Pagination }>(await res.json()); })
      .then((data) => { setHosts(data.hosts); setHostPagination(data.pagination); })
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setHostError(error instanceof Error ? error.message : "Unable to load Host performance."); })
      .finally(() => { if (!controller.signal.aborted) setHostLoading(false); });
    return () => controller.abort();
  }, [period, hostPage, debouncedHostSearch, refreshVersion]);

  const changePeriod = (nextPeriod: Period) => {
    setPeriod(nextPeriod); setPropPage(1); setHostPage(1);
    setPropertyLoading(true); setPropertyError(null); setHostLoading(true); setHostError(null);
    window.history.replaceState(null, "", `/admin/bookings/analytics?period=${nextPeriod}`);
    void fetchOverview(nextPeriod);
  };
  const refreshAll = () => { void fetchOverview(period); setPropertyLoading(true); setPropertyError(null); setHostLoading(true); setHostError(null); setRefreshVersion((version) => version + 1); };
  const financialCurrencies = Object.entries(overview.kpi.currencies || {});
  const trendMax = useMemo(() => Math.max(1, ...overview.bookingTrends.map((point) => point.newBookings + point.confirmed + point.completed + point.cancelled)), [overview.bookingTrends]);
  const hasTrendActivity = overview.bookingTrends.some((point) => point.newBookings + point.confirmed + point.completed + point.cancelled > 0);

  return <div className="flex flex-col gap-6 pb-20 font-sans text-muted-foreground">
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 md:flex-row md:items-center md:justify-between">
      <div><div className="flex items-center gap-2"><Link href="/admin/bookings" className="text-xs font-semibold text-[var(--accent)] hover:underline">← Bookings Hub</Link><span>/</span><span className="text-xs">Analytics</span></div><h1 className="mt-1">Booking &amp; Financial Analytics</h1><p className="mt-0.5 text-sm text-[#727272]">Booking cohorts, transaction cash flow, cancellations, and portfolio performance.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Link href="/admin/bookings/reports" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]">Generate Reports</Link><Link href="/admin/bookings/payments" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]">Payments</Link><button type="button" onClick={refreshAll} disabled={overviewLoading} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-foreground)] disabled:opacity-50">{overviewLoading ? "Updating…" : "Refresh Data"}</button></div>
    </header>
    {overviewError && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{overviewError}</p>}
    <nav aria-label="Analytics date range" className="flex w-full gap-1.5 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-1 sm:w-max">{PERIODS.map((tab) => <button key={tab.id} type="button" onClick={() => changePeriod(tab.id)} className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold ${period === tab.id ? "bg-[var(--surface)] text-foreground shadow-2xs" : "hover:text-foreground"}`}>{tab.label}</button>)}</nav>
    <section aria-label="Booking and financial summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {[["Total Bookings", overview.kpi.totalBookings.toLocaleString(), "text-foreground"], ["Confirmed", overview.kpi.confirmedBookings.toLocaleString(), "text-blue-600"], ["Completed Stays", overview.kpi.completedBookings.toLocaleString(), "text-emerald-600"], ["Cancellation Rate", `${overview.kpi.cancellationRate}%`, "text-rose-600"]].map(([label, value, color]) => <KpiCard key={label} label={label} value={value} color={color} />)}
      {([
        ["Gross Captured", "grossCaptured"],
        ["Successful Refunds", "refunded"],
        ["Net Collected", "netCollected"],
      ] as const).map(([label, field]) => <KpiCard key={field} label={label} value={financialCurrencies.length ? financialCurrencies.map(([currency, totals]) => formatPrice(totals[field], currency)).join(" · ") : "No verified transactions"} color="text-foreground" compact />)}
    </section>
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs lg:col-span-2"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-foreground">Booking Activity Trends</h2><p className="text-xs">Daily booking cohorts grouped by current lifecycle state (UTC).</p></div><span className="rounded-lg bg-[var(--surface-secondary)] px-2.5 py-1 font-mono text-3xs">{overview.dateRange.period}</span></div><div className="h-56 min-w-0 overflow-x-auto overflow-y-hidden border-b border-[var(--border)] pb-5">{!hasTrendActivity ? <div className="flex h-full items-center justify-center text-sm">No booking cohorts in this period.</div> : <div className="flex h-full min-w-[720px] items-end gap-1 pt-4">{overview.bookingTrends.map((point) => { const total = point.newBookings + point.confirmed + point.completed + point.cancelled; return <div key={point.date} className="group relative flex h-full min-w-8 flex-1 flex-col items-center justify-end"><div className="pointer-events-none absolute bottom-full z-20 mb-2 hidden w-44 rounded-lg bg-[var(--primary)] px-2.5 py-2 text-3xs text-primary-foreground shadow-lg group-hover:block"><strong>{point.date}</strong><br />New: {point.newBookings} · Confirmed: {point.confirmed}<br />Completed: {point.completed} · Cancelled: {point.cancelled}</div><div style={{ height: `${Math.max(4, total / trendMax * 100)}%` }} className="flex w-full max-w-7 flex-col overflow-hidden rounded-t-sm bg-[var(--surface-secondary)]">{point.cancelled > 0 && <span style={{ flex: point.cancelled }} className="bg-rose-500" />}{point.completed > 0 && <span style={{ flex: point.completed }} className="bg-emerald-500" />}{point.confirmed > 0 && <span style={{ flex: point.confirmed }} className="bg-blue-500" />}{point.newBookings > 0 && <span style={{ flex: point.newBookings }} className="bg-[var(--accent)]" />}</div><span className="mt-1 w-full truncate text-center text-4xs">{point.date.slice(5)}</span></div>; })}</div>}</div><Legend /></div>
      <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><h2 className="text-base font-bold text-foreground">Status Distribution</h2><p className="mb-4 text-xs">Mutually exclusive lifecycle classification for this booking cohort.</p><div className="space-y-3">{[["Confirmed", overview.statusDistribution.CONFIRMED || 0, "bg-blue-500"], ["Completed", overview.statusDistribution.COMPLETED || 0, "bg-emerald-500"], ["Pending", overview.statusDistribution.PENDING || 0, "bg-amber-500"], ["Cancelled", overview.statusDistribution.CANCELLED || 0, "bg-rose-500"]].map(([label, count, color]) => <DistributionRow key={String(label)} label={String(label)} count={Number(count)} total={overview.kpi.totalBookings} color={String(color)} />)}</div><p className="mt-5 border-t border-[var(--border)] pt-4 text-xs">Active disputes opened in period: <strong className="text-foreground">{overview.disputeAnalytics.activeCases || 0}</strong></p></div>
    </section>
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><h2 className="text-base font-bold text-foreground">Gateway Performance</h2><p className="mb-4 text-xs">Local transaction records only; captured volume excludes pending, failed, and voided payments.</p><div className="mb-4 grid grid-cols-3 gap-3"><Metric label="Attempts" value={overview.paymentPerformance.totalAttempts} /><Metric label="Captured" value={overview.paymentPerformance.successfulCaptures} /><Metric label="Failed" value={overview.paymentPerformance.failedAttempts} /></div><div className="space-y-2">{Object.entries(overview.paymentPerformance.providers).length ? Object.entries(overview.paymentPerformance.providers).map(([provider, data]) => <div key={provider} className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs"><strong className="text-foreground">{provider}</strong><span>{data.count} captures · {formatMoney(data.volumeByCurrency, "No captured amount")}</span></div>) : <EmptyState text="No payment transactions recorded in this period." />}</div></div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><h2 className="text-base font-bold text-foreground">Cancellation Analysis</h2><p className="mb-4 text-xs">“Unspecified” means no authoritative cancellation reason was recorded.</p><div className="space-y-2">{Object.entries(overview.cancellationAnalytics.reasons).length ? Object.entries(overview.cancellationAnalytics.reasons).map(([reason, count]) => <div key={reason} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs"><span className="truncate font-semibold text-foreground">{reason}</span><span className="shrink-0 font-bold text-rose-600">{count} booking{count === 1 ? "" : "s"}</span></div>) : <EmptyState text="No cancellations in this booking cohort." />}</div></div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs"><div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-base font-bold text-foreground">Property Performance</h2><p className="text-xs">Active, in-period properties by default. Financial columns use local verified payment and refund records.</p></div><div className="flex flex-wrap items-center gap-2"><input value={propSearch} onChange={(event) => { setPropertyLoading(true); setPropertyError(null); setPropSearch(event.target.value); setPropPage(1); }} placeholder="Search property, city, Host" className="h-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground" /><Toggle checked={includeInactive} onChange={(checked) => { setPropertyLoading(true); setPropertyError(null); setIncludeInactive(checked); setPropPage(1); }} label="Include inactive" /><Toggle checked={includeZeroActivity} onChange={(checked) => { setPropertyLoading(true); setPropertyError(null); setIncludeZeroActivity(checked); setPropPage(1); }} label="Include zero activity" /></div></div><PerformanceTable loading={propertyLoading} error={propertyError} colSpan={10} empty="No properties match the current operational view." headers={["Property", "Host", "City", "Bookings", "Completed", "Cancellations", "Booked value", "Gross captured", "Successful refunds", "Net financial volume"]} rows={properties.map((property) => <tr key={property.listingId} className="hover:bg-[var(--surface-secondary)]/30"><Cell strong>{property.title}</Cell><Cell>{property.host.name || "Host"}</Cell><Cell>{property.city || "—"}</Cell><Cell>{property.totalBookings}</Cell><Cell tone="text-emerald-600">{property.completedStays}</Cell><Cell tone="text-rose-600">{property.cancellations}</Cell><Cell>{formatMoney(property.grossBookingValueByCurrency)}</Cell><Cell>{formatMoney(property.grossCapturedByCurrency)}</Cell><Cell tone="text-rose-600">{formatMoney(property.successfulRefundsByCurrency)}</Cell><Cell strong>{formatMoney(property.netFinancialVolumeByCurrency)}</Cell></tr>)} /><PaginationControls pagination={propertyPagination} onPageChange={(nextPage) => { setPropertyLoading(true); setPropertyError(null); setPropPage(nextPage); }} /></section>
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs"><div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-bold text-foreground">Host Performance</h2><p className="text-xs">Payout snapshots are shown only when recorded; no payout settlement ledger exists.</p></div><input value={hostSearch} onChange={(event) => { setHostLoading(true); setHostError(null); setHostSearch(event.target.value); setHostPage(1); }} placeholder="Search Host name or email" className="h-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-foreground" /></div><PerformanceTable loading={hostLoading} error={hostError} colSpan={8} empty="No Hosts match the current period and search." headers={["Host", "Email", "Listings", "Bookings", "Completed", "Cancellations", "Booked value", "Recorded payout snapshot"]} rows={hosts.map((host) => <tr key={host.hostId} className="hover:bg-[var(--surface-secondary)]/30"><Cell strong>{host.name || "Host"}</Cell><Cell>{host.email || "—"}</Cell><Cell>{host.listingCount}</Cell><Cell>{host.totalBookings}</Cell><Cell tone="text-emerald-600">{host.completedStays}</Cell><Cell tone="text-rose-600">{host.cancellations}</Cell><Cell>{formatMoney(host.grossBookingValueByCurrency)}</Cell><Cell strong>{formatMoney(host.recordedNetHostPayoutByCurrency, "No recorded payout")}</Cell></tr>)} /><PaginationControls pagination={hostPagination} onPageChange={(nextPage) => { setHostLoading(true); setHostError(null); setHostPage(nextPage); }} /></section>
  </div>;
}

function KpiCard({ label, value, color, compact = false }: { label: string; value: string; color: string; compact?: boolean }) { return <div className="min-h-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs"><span className="text-3xs font-bold uppercase tracking-wider">{label}</span><p className={`mt-1 font-black ${compact ? "text-sm" : "text-2xl"} ${color}`}>{value}</p></div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3"><span className="block text-3xs">{label}</span><strong className="mt-0.5 block text-base text-foreground">{value}</strong></div>; }
function EmptyState({ text }: { text: string }) { return <p className="py-6 text-center text-sm">{text}</p>; }
function Legend() { return <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-3xs">{[["bg-[var(--accent)]", "New bookings"], ["bg-blue-500", "Confirmed"], ["bg-emerald-500", "Completed stays"], ["bg-rose-500", "Cancellations"]].map(([color, label]) => <span key={label} className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>)}</div>; }
function DistributionRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) { const percentage = count / Math.max(1, total) * 100; return <div><div className="flex justify-between text-xs"><span className="font-semibold text-foreground">{label}</span><span>{count} ({percentage.toFixed(1)}%)</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} /></div></div>; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) { return <label className="flex cursor-pointer items-center gap-1.5 text-3xs"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function Cell({ children, strong = false, tone = "" }: { children: React.ReactNode; strong?: boolean; tone?: string }) { return <td className={`whitespace-nowrap px-4 py-3 text-xs ${strong ? "font-bold text-foreground" : tone || ""}`}>{children}</td>; }
function PerformanceTable({ headers, rows, loading, error, empty, colSpan }: { headers: string[]; rows: React.ReactNode[]; loading: boolean; error: string | null; empty: string; colSpan: number }) { return <div className="overflow-x-auto"><table className="w-full min-w-[940px] border-collapse text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/50 text-3xs font-semibold uppercase tracking-wider">{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{loading ? <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm">Loading performance data…</td></tr> : error ? <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-rose-700">{error}</td></tr> : rows.length ? rows : <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm">{empty}</td></tr>}</tbody></table></div>; }
function PaginationControls({ pagination, onPageChange }: { pagination: Pagination | null; onPageChange: (page: number) => void }) { if (!pagination) return null; return <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs"><span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span><div className="flex gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 disabled:opacity-40">Previous</button><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)} className="rounded-lg border border-[var(--border)] px-2.5 py-1 disabled:opacity-40">Next</button></div></div>; }
