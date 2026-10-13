"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";
import {
  SearchableFilterCombobox,
  type SearchableFilterPage,
} from "@/components/ui/searchable-filter-combobox";
import type { CalendarBookingItem } from "./admin-calendar-client";

export interface AdminAllPropertiesCalendarData {
  properties: Array<{
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    propertyType: string | null;
    photos: string[];
    price: number;
    status: string;
    host: { id: string; name: string | null; email: string | null };
    blockedDates: string[];
    bookings: CalendarBookingItem[];
  }>;
  range: { startDate: string; endDate: string };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type RangeMode = "7" | "14" | "month";

interface AllPropertiesCalendarProps {
  initialData: AdminAllPropertiesCalendarData | null;
  onSelectProperty: (listingId: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function daysBetween(start: string, end: string): number {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / DAY_MS);
}

function rangeFor(anchor: string, mode: RangeMode): { startDate: string; endDate: string } {
  if (mode === "month") {
    const date = parseDateKey(anchor);
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { startDate: dateKey(start), endDate: dateKey(end) };
  }
  return { startDate: anchor, endDate: addDays(anchor, Number(mode)) };
}

function modeFromRange(range: { startDate: string; endDate: string } | undefined): RangeMode {
  if (!range) return "14";
  const length = daysBetween(range.startDate, range.endDate);
  const start = parseDateKey(range.startDate);
  if (start.getUTCDate() === 1 && length >= 28 && length <= 31) return "month";
  return length === 7 ? "7" : "14";
}

function bookingLanes(bookings: CalendarBookingItem[], range: { startDate: string; endDate: string }) {
  const sorted = [...bookings]
    .filter((booking) => booking.endDate > range.startDate && booking.startDate < range.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const laneEnds: string[] = [];
  return sorted.map((booking) => {
    let lane = laneEnds.findIndex((endDate) => endDate <= booking.startDate);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(booking.endDate);
    } else {
      laneEnds[lane] = booking.endDate;
    }
    return { booking, lane };
  });
}

export function AdminAllPropertiesCalendar({
  initialData,
  onSelectProperty,
}: AllPropertiesCalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const firstRange = initialData?.range;
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ booking: CalendarBookingItem; propertyTitle: string } | null>(null);
  const initialUrl = useRef(searchParams.toString());
  const controller = useRef<AbortController | null>(null);
  const fallbackRange = useMemo(
    () => firstRange || rangeFor(dateKey(new Date()), "14"),
    [firstRange],
  );
  const range = useMemo(() => ({
    startDate: searchParams.get("startDate") || fallbackRange.startDate,
    endDate: searchParams.get("endDate") || fallbackRange.endDate,
  }), [fallbackRange, searchParams]);
  const rangeMode = modeFromRange(range);

  const days = useMemo(() => {
    const total = Math.max(1, daysBetween(range.startDate, range.endDate));
    return Array.from({ length: total }, (_, index) => addDays(range.startDate, index));
  }, [range]);

  const navigate = useCallback((updates: Record<string, string | undefined>, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "all");
    params.delete("listingId");
    params.delete("propertyId");
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const url = `/admin/bookings/calendar?${params.toString()}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [router, searchParams]);

  const load = useCallback(async (params: URLSearchParams) => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/bookings/calendar?${params.toString()}`, {
        signal: nextController.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Could not load reservation timeline.");
      const calendarData = (payload.data || payload) as AdminAllPropertiesCalendarData;
      if (!Array.isArray(calendarData.properties) || !calendarData.pagination || !calendarData.range) {
        throw new Error("The reservation timeline returned an invalid response.");
      }
      setData(calendarData);
    } catch (requestError: unknown) {
      if (requestError instanceof Error && requestError.name !== "AbortError") {
        setError(requestError.message || "Could not load reservation timeline.");
      }
    } finally {
      if (!nextController.signal.aborted) setLoading(false);
    }
  }, []);

  const loadFilterOptions = useCallback(async (
    type: "properties" | "hosts" | "cities" | "countries" | "propertyTypes",
    search: string,
    page: number,
    signal: AbortSignal,
    selected?: string,
    country?: string,
  ): Promise<SearchableFilterPage> => {
    const params = new URLSearchParams({ type, search, page: String(page), limit: "20" });
    if (selected) params.set("selected", selected);
    if (country) params.set("country", country);
    const response = await fetch(`/api/v1/admin/bookings/calendar/listings?${params.toString()}`, { signal });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || payload?.message || "Could not load filter options.");
    const result = payload.data || payload;
    return { options: result.options || [], hasMore: Boolean(result.pagination?.hasMore) };
  }, []);

  // Browser navigation and copied URLs are the source of truth after the
  // server-rendered initial payload has been displayed.
  useEffect(() => {
    const url = searchParams.toString();
    if (!searchParams.get("startDate") || !searchParams.get("endDate")) {
      const params = new URLSearchParams(url);
      params.set("view", "all");
      params.set("startDate", range.startDate);
      params.set("endDate", range.endDate);
      params.set("page", params.get("page") || "1");
      params.set("limit", params.get("limit") || "20");
      initialUrl.current = params.toString();
      router.replace(`/admin/bookings/calendar?${params.toString()}`, { scroll: false });
      return;
    }
    if (url !== initialUrl.current) void load(new URLSearchParams(url));
  }, [searchParams, load, range, router]);

  useEffect(() => () => {
    controller.current?.abort();
  }, []);

  const setFilter = (key: string, value: string) => navigate({ [key]: value, page: "1" }, true);
  const setCountryFilter = (country: string) => {
    const cityKey = searchParams.get("cityKey");
    const cityCountryCode = cityKey?.match(/^([A-Za-z]{2}):/)?.[1]?.toUpperCase();
    navigate({
      country,
      cityKey: cityCountryCode && cityCountryCode !== country ? undefined : cityKey || undefined,
      city: undefined,
      page: "1",
    }, true);
  };
  const clearAllFilters = () => navigate({
    filterListingId: undefined,
    city: undefined,
    cityKey: undefined,
    country: undefined,
    hostId: undefined,
    propertyType: undefined,
    status: undefined,
    bookingStatus: undefined,
    page: "1",
  }, true);

  const changeRange = (nextMode: RangeMode, anchor = range.startDate) => {
    const nextRange = rangeFor(anchor, nextMode);
    navigate({ ...nextRange, page: "1" });
  };

  const moveRange = (direction: -1 | 1) => {
    const stride = rangeMode === "month" ? 1 : Number(rangeMode);
    const anchor = rangeMode === "month"
      ? dateKey(new Date(Date.UTC(parseDateKey(range.startDate).getUTCFullYear(), parseDateKey(range.startDate).getUTCMonth() + direction, 1)))
      : addDays(range.startDate, direction * stride);
    changeRange(rangeMode, anchor);
  };

  const timelineLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(parseDateKey(range.startDate));
  const page = data?.pagination?.page || Number(searchParams.get("page") || 1);
  const limit = data?.pagination?.limit || Number(searchParams.get("limit") || 20);

  return (
    <div className="flex flex-col gap-5 pb-16 text-muted-foreground">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Reservation Calendar</h1>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
            Read-only availability across all properties. Confirmed stays, active 24-hour holds, and blocks share one timeline.
          </p>
        </div>
        {/* <div className="flex flex-wrap gap-2">
          <Link href="/admin/bookings/all" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]">All Bookings</Link>
          <Link href="/admin/bookings/cancellations" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]">Cancellations</Link>
          <button type="button" onClick={() => load(new URLSearchParams(searchParams.toString()))} disabled={loading} className="rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-foreground)] disabled:opacity-60">{loading ? "Syncing…" : "Refresh"}</button>
        </div> */}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xs">
        <button type="button" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-foreground)]">All Properties</button>
        <button type="button" onClick={() => onSelectProperty(data?.properties[0]?.id || "")} disabled={!data?.properties.length} className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-50">Single Property</button>
        <span className="ml-auto px-2 text-[11px] font-medium text-[var(--muted-foreground)]">Admin view only — availability changes are managed by hosts.</span>
      </div>

      <section aria-label="Calendar filters" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-foreground">Filter properties</h2><p className="text-[11px] text-[var(--muted-foreground)]">Selections apply together and update the calendar immediately.</p></div><button type="button" onClick={clearAllFilters} className="text-xs font-semibold text-[var(--accent)] hover:underline">Clear all</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SearchableFilterCombobox label="Property" placeholder="All properties" value={searchParams.get("filterListingId") || ""} onChange={(value) => setFilter("filterListingId", value)} loadOptions={(search, page, signal, selected) => loadFilterOptions("properties", search, page, signal, selected)} />
          <SearchableFilterCombobox label="Host" placeholder="All hosts" value={searchParams.get("hostId") || ""} onChange={(value) => setFilter("hostId", value)} loadOptions={(search, page, signal, selected) => loadFilterOptions("hosts", search, page, signal, selected)} />
          <SearchableFilterCombobox label="Country" placeholder="All countries" value={searchParams.get("country") || ""} onChange={setCountryFilter} loadOptions={(search, page, signal, selected) => loadFilterOptions("countries", search, page, signal, selected)} />
          <SearchableFilterCombobox label="City" placeholder="All cities" value={searchParams.get("cityKey") || ""} onChange={(value) => setFilter("cityKey", value)} loadOptions={(search, page, signal, selected) => loadFilterOptions("cities", search, page, signal, selected, searchParams.get("country") || undefined)} cacheScope={searchParams.get("country") || "all-countries"} />
          <SearchableFilterCombobox label="Property type" placeholder="All property types" value={searchParams.get("propertyType") || ""} onChange={(value) => setFilter("propertyType", value)} loadOptions={(search, page, signal, selected) => loadFilterOptions("propertyTypes", search, page, signal, selected)} />
          <SearchableFilterCombobox label="Property status" placeholder="All property statuses" value={searchParams.get("status") || ""} onChange={(value) => setFilter("status", value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "DRAFT", label: "Draft" }, { value: "IN_PROGRESS", label: "In progress" }, { value: "PENDING_REVIEW", label: "Pending review" }, { value: "CHANGES_REQUESTED", label: "Changes requested" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }]} />
          <SearchableFilterCombobox label="Reservation status" placeholder="All reservations" value={searchParams.get("bookingStatus") || ""} onChange={(value) => setFilter("bookingStatus", value)} options={[{ value: "CONFIRMED", label: "Confirmed" }, { value: "PENDING", label: "Active hold (24h)" }]} />
        </div>
      </section>

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => moveRange(-1)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-foreground">←</button>
          <button type="button" onClick={() => changeRange(rangeMode, dateKey(new Date()))} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-foreground">Today</button>
          <button type="button" onClick={() => moveRange(1)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-foreground">→</button>
          <h2 className="ml-1 text-base font-bold text-foreground">{timelineLabel}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["7", "14", "month"] as const).map((mode) => <button key={mode} type="button" onClick={() => changeRange(mode)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${rangeMode === mode ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "border border-[var(--border)] bg-[var(--surface)] text-foreground"}`}>{mode === "month" ? "Month" : `${mode} days`}</button>)}
          <span className="ml-1 text-[11px] font-medium"><span className="text-emerald-600">■</span> Confirmed <span className="ml-2 text-amber-600">■</span> Hold <span className="ml-2 text-zinc-500">▨</span> Blocked</span>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
        <div className="min-w-[900px]">
          <div className="sticky top-0 z-10 flex border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="w-64 shrink-0 border-r border-[var(--border)] px-4 py-3 text-xs font-bold text-foreground">Property</div>
            <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(56px, 1fr))` }}>
              {days.map((day) => { const date = parseDateKey(day); return <div key={day} className={`border-r border-[var(--border)] px-1 py-2 text-center text-[10px] ${date.getUTCDay() === 0 || date.getUTCDay() === 6 ? "bg-[var(--surface-secondary)]/60" : ""}`}><div className="font-semibold text-[var(--muted-foreground)]">{date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" })}</div><div className="font-bold text-foreground">{date.getUTCDate()}</div></div>; })}
            </div>
          </div>
          {loading && !data ? <div className="p-8 text-center text-sm">Loading properties…</div> : data?.properties.map((property) => {
            const lanes = bookingLanes(property.bookings, range);
            const rowHeight = Math.max(64, 16 + (Math.max(1, ...lanes.map(({ lane }) => lane + 1)) * 26));
            return <div key={property.id} className="flex border-b border-[var(--border)] last:border-0" style={{ minHeight: rowHeight }}>
              <button type="button" onClick={() => onSelectProperty(property.id)} className="flex w-64 shrink-0 items-center gap-3 border-r border-[var(--border)] px-3 text-left hover:bg-[var(--surface-secondary)]/50">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-secondary)]">{property.photos[0] && <Image src={property.photos[0]} alt="" fill unoptimized className="object-cover" />}</div>
                <span className="min-w-0"><span className="block truncate text-xs font-bold text-foreground">{property.title}</span><span className="block truncate text-[10px] text-[var(--muted-foreground)]">{property.city || "Location unavailable"} · {property.host.name || property.host.email || "Host unavailable"}</span></span>
              </button>
              <div className="relative flex-1" style={{ minHeight: rowHeight }}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(56px, 1fr))` }}>{days.map((day) => <div key={day} title={property.blockedDates.includes(day) ? "Host blocked date" : "Available"} className={`border-r border-[var(--border)] ${property.blockedDates.includes(day) ? "bg-zinc-300/60 dark:bg-zinc-700/60" : "bg-[var(--surface)]"}`} />)}</div>
                {lanes.map(({ booking, lane }) => {
                  const startIndex = Math.max(0, daysBetween(range.startDate, booking.startDate));
                  const endIndex = Math.min(days.length, daysBetween(range.startDate, booking.endDate));
                  const width = Math.max(1, endIndex - startIndex);
                  return <button key={booking.id} type="button" onClick={() => setPreview({ booking, propertyTitle: property.title })} title={`${booking.user.name || "Guest"}: ${booking.startDate} to ${booking.endDate}`} className={`absolute z-[1] truncate rounded-md px-2 text-left text-[10px] font-bold shadow-sm ${booking.isPendingHold ? "bg-amber-200 text-amber-950 hover:bg-amber-300 dark:bg-amber-900 dark:text-amber-100" : "bg-emerald-200 text-emerald-950 hover:bg-emerald-300 dark:bg-emerald-900 dark:text-emerald-100"}`} style={{ top: 8 + lane * 26, left: `calc(${(startIndex / days.length) * 100}% + 2px)`, width: `calc(${(width / days.length) * 100}% - 4px)`, height: 21 }}>{booking.isPendingHold ? "⏳ " : "● "}{booking.user.name || "Guest"}</button>;
                })}
              </div>
            </div>;
          })}
          {!loading && data?.properties.length === 0 && <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">No properties match these filters.</div>}
        </div>
      </div>

      <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p>{data?.pagination.total || 0} properties · page {page} of {data?.pagination.totalPages || 1}</p>
        <div className="flex items-center gap-2"><label>Rows <select value={limit} onChange={(event) => navigate({ limit: event.target.value, page: "1" })} className="ml-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><button type="button" disabled={page <= 1} onClick={() => navigate({ page: String(page - 1) })} className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page >= (data?.pagination.totalPages || 1)} onClick={() => navigate({ page: String(page + 1) })} className="rounded-lg border border-[var(--border)] px-3 py-1.5 disabled:opacity-40">Next</button></div>
      </div>

      {preview && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">{preview.propertyTitle}</p><h3 className="mt-1 text-lg font-bold text-foreground">Reservation preview</h3></div>
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg p-1 text-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)]">×</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${preview.booking.isPendingHold ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"}`}>{preview.booking.isPendingHold ? "Pending hold (24h)" : "Confirmed reservation"}</span><span className="rounded-full bg-[var(--surface-secondary)] px-2.5 py-1 font-mono text-[10px] text-[var(--muted-foreground)]">Ref {preview.booking.id.slice(0, 12)}</span></div>
            <div className="mt-5 grid grid-cols-2 gap-4 text-xs"><div><p className="text-[var(--muted-foreground)]">Guest</p><p className="mt-1 font-bold text-foreground">{preview.booking.user.name || "Unknown guest"}</p><p>{preview.booking.user.email || "No email available"}</p></div><div><p className="text-[var(--muted-foreground)]">Payment status</p><p className="mt-1 font-bold text-foreground">{preview.booking.payments?.[0]?.status?.replace(/_/g, " ") || "Unavailable"}</p><p>{preview.booking.bookingType.replace(/_/g, " ")}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[var(--border)] py-4 text-xs"><div><p className="text-[var(--muted-foreground)]">Check-in</p><p className="mt-1 font-bold text-foreground">{preview.booking.startDate}</p></div><div><p className="text-[var(--muted-foreground)]">Check-out</p><p className="mt-1 font-bold text-foreground">{preview.booking.endDate}</p></div><div><p className="text-[var(--muted-foreground)]">Total</p><p className="mt-1 font-bold text-foreground">{formatPrice(preview.booking.totalPrice || 0, preview.booking.currency || "SAR")}</p></div></div>
            {preview.booking.isPendingHold && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">This is an active hold and will release automatically if it expires. {preview.booking.countdownText || ""}</p>}
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-foreground">Close</button><Link href={`/admin/bookings/all?search=${encodeURIComponent(preview.booking.id)}`} className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-foreground)]">View booking details</Link></div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
