"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DatePeriodPicker, type DatePeriodPickerState } from "@/components/host/reporting/date-period-picker";
import { PeriodComparisonModal, type ComparisonPeriodConfig } from "@/components/host/reporting/period-comparison-modal";
import type { TimeframeGranularity } from "@/lib/dashboard/reporting-filter";
import type { HostEarningsAnalyticsData } from "@/services/host-earnings-analytics.service";

const money = (cents: number | null, currency: string) => cents === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function reportingRange(value: DatePeriodPickerState) {
  const now = new Date();
  const year = value.year || now.getUTCFullYear();
  const month = value.month || now.getUTCMonth() + 1;
  const oneDay = (date: string) => ({ startDate: date, endDate: date });
  if (value.timeframe === "daily" && value.date) return oneDay(value.date);
  if (value.timeframe === "weekly") {
    const startDate = value.weekStart || value.date || isoDate(now);
    const end = new Date(`${startDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { startDate, endDate: isoDate(end) };
  }
  if (value.timeframe === "quarterly") {
    const startMonth = ((value.quarter || 1) - 1) * 3;
    return { startDate: isoDate(new Date(Date.UTC(year, startMonth, 1))), endDate: isoDate(new Date(Date.UTC(year, startMonth + 3, 0))) };
  }
  if (value.timeframe === "yearly") return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  if (value.timeframe === "custom" && value.startDate && value.endDate) return { startDate: value.startDate, endDate: value.endDate };
  return { startDate: isoDate(new Date(Date.UTC(year, month - 1, 1))), endDate: isoDate(new Date(Date.UTC(year, month, 0))) };
}

export function HostEarningsAnalyticsClient({ initialData }: { initialData: HostEarningsAnalyticsData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const queryKey = searchParams.toString();
  const lastLoadedQuery = useRef(queryKey);
  const currency = data.currency || "SAR";
  const analyticsTimeframe = (params.get("analyticsTimeframe") as TimeframeGranularity) || "monthly";
  const update = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);
  useEffect(() => {
    if (lastLoadedQuery.current === queryKey) return;
    lastLoadedQuery.current = queryKey;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch(`/api/v1/host/earnings/analytics?${queryKey}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || "Unable to load advanced earnings analytics.");
        setData(payload.data ?? payload);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Unable to load advanced earnings analytics.");
      } finally {
        if (activeRequest.current === controller) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [queryKey]);
  const maximum = Math.max(...data.trend.map((point) => point.netHostEarningsCents), 1);
  const scopedHref = (href: string) => { const query = params.toString(); return query ? `${href}?${query}` : href; };
  const handlePeriodChange = (next: DatePeriodPickerState) => {
    const range = reportingRange(next);
    void update({ period: "custom", startDate: range.startDate, endDate: range.endDate, analyticsTimeframe: next.timeframe });
  };
  const handleComparison = (config: ComparisonPeriodConfig | null) => {
    if (!config?.enabled) {
      void update({ comparisonStartDate: null, comparisonEndDate: null });
      return;
    }
    const range = reportingRange({
      timeframe: config.timeframe,
      startDate: config.startDate,
      endDate: config.endDate,
      month: config.month,
      year: config.year,
      quarter: config.quarter,
    });
    void update({ comparisonStartDate: range.startDate, comparisonEndDate: range.endDate });
  };
  const refreshAnalytics = () => void update({ expensesUpdated: String(Date.now()) });
  const start = params.get("startDate") || isoDate(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)));
  const startDate = new Date(`${start}T00:00:00.000Z`);

  return <div className="space-y-10" aria-busy={loading}>
    <header className="border-b border-zinc-200 pb-5"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Dashboard Plus</p><div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight text-zinc-950">Advanced Earnings Analytics</h1><p className="mt-2 text-sm text-zinc-600">Understand your revenue, costs, and financial performance across your listings.</p></div><div className="flex items-center gap-4"><Link href="/host/operations" className="text-xs font-semibold underline underline-offset-4">Property operations</Link><Link href="/host/earnings" className="text-xs font-semibold underline underline-offset-4">Back to Earnings</Link></div></div>
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center"><select aria-label="Filter advanced analytics by property" value={data.selectedListingId ?? ""} onChange={(event) => void update({ propertyId: event.target.value || null })} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"><option value="">All listings</option>{data.listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select><DatePeriodPicker value={{ timeframe: analyticsTimeframe, date: params.get("date") || undefined, weekStart: params.get("weekStart") || undefined, month: startDate.getUTCMonth() + 1, year: startDate.getUTCFullYear(), quarter: Math.floor(startDate.getUTCMonth() / 3) + 1, startDate: params.get("startDate") || undefined, endDate: params.get("endDate") || undefined }} onChange={handlePeriodChange} displayLabel={data.reportingPeriod.label} disabled={loading} /><div className="flex items-center gap-2"><button type="button" onClick={() => setShowComparison(true)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50">Compare periods</button>{params.get("comparisonStartDate") && <button type="button" onClick={() => handleComparison(null)} className="text-xs font-semibold underline underline-offset-4">Clear</button>}</div></div>
    </header>
    {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    <section><SectionTitle eyebrow="Revenue performance" title="Actual realized revenue" detail={data.reportingPeriod.label} /><div className="mt-5 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7"><div className="flex h-48 items-end gap-1.5 border-b border-zinc-200">{data.trend.length ? data.trend.map((point) => <Link key={point.dateKey} href={scopedHref("/host/earnings/transactions")} title={`${point.label}: ${money(point.netHostEarningsCents, currency)} net earnings`} className="group flex min-w-2 flex-1 flex-col justify-end"><span className="sr-only">{point.label}</span><span className="rounded-t bg-zinc-900 transition group-hover:bg-amber-400" style={{ height: `${Math.max(point.netHostEarningsCents ? 4 : 1, Math.round((point.netHostEarningsCents / maximum) * 100))}%` }} /></Link>) : <p className="m-auto text-sm text-zinc-500">No qualifying completed stays in this period.</p>}</div><div className="mt-3 flex justify-between text-xs text-zinc-500"><span>Completed-stay net earnings</span><span>{data.revenue.qualifyingBookingsCount} qualifying bookings</span></div></div><div className="mt-4 grid grid-cols-2 divide-x divide-y divide-zinc-200 border-b border-zinc-200 sm:grid-cols-4"><Metric label="Accommodation revenue" value={money(data.revenue.eligibleAccommodationRevenueCents, currency)} detail="From immutable booking snapshots" /><Metric label="Net host earnings" value={money(data.revenue.netHostEarningsCents, currency)} detail={`${data.reportingPeriod.comparisonLabel}: ${money(data.revenue.previousNetHostEarningsCents, currency)}`} /><Metric label="Revenue per booking" value={money(data.revenue.revenuePerBookingCents, currency)} detail="Qualifying completed stays" /><Metric label="Net per booking" value={money(data.revenue.netPerBookingCents, currency)} detail="After recorded host fees" /></div></section>
    <section><SectionTitle eyebrow="RevPAN" title="Revenue per available night" detail="Eligible accommodation revenue ÷ bookable inventory nights" /><div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]"><Link href={scopedHref("/host/earnings/analytics/revpan")} className="rounded-3xl bg-zinc-950 p-6 text-white transition hover:bg-zinc-800 sm:p-8"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Current RevPAN</p><p className="mt-5 text-4xl font-bold tracking-tight">{money(data.revpan.valueCents, currency)}</p><p className="mt-3 text-sm text-zinc-300">{data.revpan.bookableNights} bookable nights · {data.revpan.bookedNights} booked · {data.revpan.availableNights} unbooked available</p><p className="mt-5 text-xs font-semibold underline underline-offset-4">View RevPAN details →</p></Link><div className="rounded-3xl border border-zinc-200 p-6"><p className="text-sm font-semibold">Occupancy relationship</p><p className="mt-5 text-3xl font-bold">{data.revpan.occupancyRatePercentage}%</p><p className="mt-2 text-sm text-zinc-500">Occupancy uses the same active-listing, confirmed-booking and blocked-night inventory policy as Host Dashboard.</p><p className="mt-5 text-xs text-zinc-500">Previous RevPAN: {money(data.revpan.previousValueCents, currency)}</p></div></div></section>
    <section className="grid gap-5 lg:grid-cols-2"><OperatingCosts data={data} currency={currency} onCreated={refreshAnalytics} /><ProfitSummary data={data} currency={currency} /></section>
    <section><SectionTitle eyebrow="Property financial performance" title="Your listings, compared" detail="No external or competitor data" /><div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="p-4">Listing</th><th className="p-4">Revenue</th><th className="p-4">Net earnings</th><th className="p-4">RevPAN</th><th className="p-4">Bookings</th></tr></thead><tbody>{data.properties.map((property) => <tr key={property.listingId} className="border-t border-zinc-200"><td className="p-4 font-semibold text-zinc-950">{property.title}</td><td className="p-4">{money(property.eligibleAccommodationRevenueCents, currency)}</td><td className="p-4">{money(property.netHostEarningsCents, currency)}</td><td className="p-4">{money(property.revpanCents, currency)}</td><td className="p-4">{property.qualifyingBookingsCount}</td></tr>)}</tbody></table></div>{data.dataQuality.unavailableFinancialSnapshotCount > 0 && <p className="mt-3 text-xs text-zinc-500">{data.dataQuality.unavailableFinancialSnapshotCount} completed booking{data.dataQuality.unavailableFinancialSnapshotCount === 1 ? "" : "s"} excluded because an eligible immutable financial snapshot was unavailable.</p>}</section>
    <PeriodComparisonModal isOpen={showComparison} onClose={() => setShowComparison(false)} currentPeriodLabel={data.reportingPeriod.label} currentYear={startDate.getUTCFullYear()} currentMonth={startDate.getUTCMonth() + 1} onApplyComparison={handleComparison} />
  </div>;
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">{title}</h2><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="min-h-32 p-4 sm:p-5"><p className="text-xs font-medium text-zinc-600">{label}</p><p className="mt-4 text-2xl font-bold tracking-tight text-zinc-950">{value}</p><p className="mt-2 text-[11px] text-zinc-500">{detail}</p></div>; }
function OperatingCosts({ data, currency, onCreated }: { data: HostEarningsAnalyticsData; currency: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [listingId, setListingId] = useState(data.selectedListingId || data.listings[0]?.id || ""); const [category, setCategory] = useState("CLEANING"); const [amount, setAmount] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const amountCents = Math.round(Number(amount) * 100); if (!listingId || !Number.isFinite(amountCents) || amountCents <= 0) { setError("Choose a property and enter a positive amount."); return; } setSaving(true); setError(null); try { const response = await fetch("/api/v1/host/earnings/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, category, amountCents, currency, expenseDate: new Date().toISOString().slice(0, 10), idempotencyKey: crypto.randomUUID() }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload?.error?.message || "Unable to record expense."); setAmount(""); setOpen(false); onCreated(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record expense."); } finally { setSaving(false); } };
  const voidExpense = async (id: string) => { if (!window.confirm("Void this expense? This preserves its audit history.")) return; setError(null); try { const response = await fetch(`/api/v1/host/earnings/expenses/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Corrected by host" }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload?.error?.message || "Unable to void expense."); onCreated(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to void expense."); } };
  return <div className="rounded-3xl border border-zinc-200 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Operating expenses</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">Recorded costs</h2></div><button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800">{open ? "Close" : "Add expense"}</button></div><p className="mt-3 text-sm text-zinc-600">{data.costs.message}</p><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Recorded costs" value={money(data.costs.totalRecordedOperatingCostsCents, currency)} detail={data.costs.expenseCoverage.replaceAll("_", " ").toLowerCase()} /><Metric label="Cost per stay" value={money(data.costs.costPerCompletedStayCents, currency)} detail="Completed stays" /></div>{data.costs.categoryBreakdown.length > 0 && <div className="mt-5 space-y-2">{data.costs.categoryBreakdown.map((item) => <div key={item.category} className="flex items-center justify-between text-xs"><span className="text-zinc-600">{item.category.replaceAll("_", " ")}</span><span className="font-semibold text-zinc-950">{money(item.amountCents, currency)}</span></div>)}</div>}{data.costs.expenseHistory.length > 0 && <div className="mt-5 border-t border-zinc-100 pt-4"><p className="text-xs font-semibold text-zinc-800">Recent expense history</p><div className="mt-2 max-h-48 divide-y divide-zinc-100 overflow-y-auto">{data.costs.expenseHistory.map((expense) => <div key={expense.id} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="min-w-0 truncate text-zinc-600">{new Date(expense.expenseDate).toLocaleDateString()} · {expense.category.replaceAll("_", " ")}{expense.description ? ` · ${expense.description}` : ""}</span><span className="flex shrink-0 items-center gap-2 font-semibold text-zinc-950">{money(expense.amountCents, expense.currency)}<button type="button" onClick={() => voidExpense(expense.id)} className="text-zinc-500 underline underline-offset-2 hover:text-rose-700">Void</button></span></div>)}</div></div>}{open && <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3"><select value={listingId} onChange={(event) => setListingId(event.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm">{data.listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm">{["CLEANING", "MAINTENANCE", "LAUNDRY", "GUEST_SUPPLIES", "UTILITIES", "PROPERTY_MANAGEMENT", "OTHER"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><input aria-label="Expense amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="Amount" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm" /><div className="sm:col-span-3 flex items-center justify-between gap-3">{error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : <p className="text-xs text-zinc-500">Recorded costs are never assumed to be zero.</p>}<button disabled={saving} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save expense"}</button></div></form>}</div>;
}
function ProfitSummary({ data, currency }: { data: HostEarningsAnalyticsData; currency: string }) { return <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Revenue vs operating profit</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">Estimated profit</h2><p className="mt-3 text-sm leading-relaxed text-zinc-600">{data.profit.message}</p><div className="mt-6 grid grid-cols-2 gap-3"><Metric label="Net host earnings" value={money(data.revenue.netHostEarningsCents, currency)} detail="Immutable booking snapshots" /><Metric label="Estimated profit" value={money(data.profit.estimatedOperatingProfitCents, currency)} detail={data.profit.profitMarginPercentage === null ? "Costs not recorded" : `${data.profit.profitMarginPercentage}% margin`} /></div></div>; }
