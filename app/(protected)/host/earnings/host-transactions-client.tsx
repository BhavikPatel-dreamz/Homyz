"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type {
  HostEarningsTransactionKind,
  HostEarningsTransactionResult,
} from "@/services/payout.service";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const dt = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "Date pending";

const statusLabel = (status: string) =>
  ({
    SCHEDULED: "Scheduled",
    ELIGIBLE_SETTLEMENT: "Ready",
    PROCESSING: "Processing",
    PAID: "Paid",
  })[status] ?? status.replaceAll("_", " ");

const statusStyle = (status: string) =>
  status === "PAID"
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : status === "PROCESSING"
      ? "bg-violet-50 text-violet-700 border border-violet-200"
      : "bg-sky-50 text-sky-700 border border-sky-200";

export function HostTransactionsClient({
  kind,
  initialData,
}: {
  kind: HostEarningsTransactionKind;
  initialData: HostEarningsTransactionResult;
}) {
  const pathname = usePathname(),
    router = useRouter(),
    searchParams = useSearchParams();
  const { currency: globalDisplayCurrency } = useCurrency();
  const prevGlobalCurrency = useRef(globalDisplayCurrency);
  const [data, setData] = useState(initialData),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [draftDatePreset, setDraftDatePreset] = useState("all");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [dateFilterError, setDateFilterError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(
    async (params: URLSearchParams) => {
      const id = ++request.current;
      setLoading(true);
      setError(null);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      try {
        const response = await fetch(
          `/api/v1/host/earnings/transactions?status=${kind}&${params.toString()}`,
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload?.error?.message || "Unable to load transactions.",
          );
        if (id === request.current) setData(payload.data || payload);
      } catch (cause) {
        if (id === request.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load transactions.",
          );
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [kind, pathname, router],
  );

  const update = useCallback(
    (values: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(values).forEach(([key, value]) =>
        value ? params.set(key, value) : params.delete(key),
      );
      if (!Object.hasOwn(values, "page")) params.delete("page");
      void load(params);
    },
    [load, searchParams],
  );

  // Real-time synchronization: when the user changes main currency in the global "Languages & currency" modal
  useEffect(() => {
    if (globalDisplayCurrency && prevGlobalCurrency.current !== globalDisplayCurrency) {
      prevGlobalCurrency.current = globalDisplayCurrency;
      update({ currency: globalDisplayCurrency });
    }
  }, [globalDisplayCurrency, update]);

  const setCustomDate = (key: "startDate" | "endDate", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("datePreset", "custom");
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    if (params.get("startDate") && params.get("endDate")) {
      void load(params);
    } else {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const debounceTarget = useRef({ searchParams, update });
  useEffect(() => {
    debounceTarget.current = { searchParams, update };
  }, [searchParams, update]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const target = debounceTarget.current;
      if (search !== (target.searchParams.get("search") || ""))
        target.update({ search: search || null });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const isUpcoming = kind === "upcoming";
  const title = isUpcoming ? "Upcoming" : "Paid";
  const total = data.totalsByCurrency.length
    ? data.totalsByCurrency
        .map((item) => money(item.amount, item.currency))
        .join(" · ")
    : "—";
  const datePreset = searchParams.get("datePreset") || "all";

  const openDateFilter = () => {
    setDraftDatePreset(datePreset);
    setDraftStartDate(searchParams.get("startDate") || "");
    setDraftEndDate(searchParams.get("endDate") || "");
    setDateFilterError(null);
    setDateFilterOpen(true);
  };

  const applyDateFilter = () => {
    if (draftDatePreset === "custom" && (!draftStartDate || !draftEndDate)) {
      setDateFilterError("Choose both dates for a custom range.");
      return;
    }
    if (draftDatePreset === "custom" && draftStartDate > draftEndDate) {
      setDateFilterError("The start date must be before the end date.");
      return;
    }
    setDateFilterOpen(false);
    update({
      datePreset: draftDatePreset === "all" ? null : draftDatePreset,
      startDate: draftDatePreset === "custom" ? draftStartDate : null,
      endDate: draftDatePreset === "custom" ? draftEndDate : null,
    });
  };

  const hasActiveFilters =
    searchParams.get("datePreset") ||
    searchParams.get("propertyId") ||
    searchParams.get("currency") ||
    searchParams.get("earningsType") ||
    searchParams.get("payoutStatus") ||
    searchParams.get("sort") ||
    search;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <header>
        <Link
          href="/host/earnings"
          className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
        >
          ← Earnings
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950">
          {title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {isUpcoming
            ? "Scheduled, ready and processing payouts"
            : "Verified payout executions"}
        </p>
      </header>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-zinc-400">
            🔍
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reservation, property or guest…"
            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 py-2.5 pl-9 pr-10 text-sm focus:border-zinc-600 focus:bg-white focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-900"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter chips — scrollable row */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {/* Mobile: date filter button */}
          <button
            type="button"
            onClick={openDateFilter}
            className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold sm:hidden"
          >
            {datePreset === "all"
              ? "All dates"
              : datePreset.replaceAll("_", " ")}
          </button>

          {/* Desktop: date select */}
          <select
            aria-label="Date filter"
            value={datePreset}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") {
                const params = new URLSearchParams(searchParams.toString());
                params.set("datePreset", "custom");
                params.delete("page");
                router.replace(`${pathname}?${params.toString()}`, {
                  scroll: false,
                });
              } else {
                update({ datePreset: v === "all" ? null : v, startDate: null, endDate: null });
              }
            }}
            className="hidden shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold sm:block"
          >
            <option value="all">All dates</option>
            {isUpcoming && (
              <>
                <option value="next_30_days">Next 30 days</option>
                <option value="next_60_days">Next 60 days</option>
                <option value="next_90_days">Next 90 days</option>
              </>
            )}
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="this_year">This year</option>
            <option value="custom">Custom range</option>
          </select>

          <select
            aria-label="Listing filter"
            value={searchParams.get("propertyId") || ""}
            onChange={(e) => update({ propertyId: e.target.value || null })}
            className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="">All listings</option>
            {data.listings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Payout status"
            value={searchParams.get("payoutStatus") || ""}
            onChange={(e) => update({ payoutStatus: e.target.value || null })}
            className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="">All statuses</option>
            {isUpcoming ? (
              <>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ELIGIBLE_SETTLEMENT">Ready for settlement</option>
                <option value="PROCESSING">Processing</option>
              </>
            ) : (
              <option value="PAID">Paid</option>
            )}
          </select>

          <select
            aria-label="Sort"
            value={searchParams.get("sort") || "date_desc"}
            onChange={(e) =>
              update({ sort: e.target.value === "date_desc" ? null : e.target.value })
            }
            className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="date_desc">Most recent</option>
            <option value="date_asc">Oldest first</option>
            <option value="amount_desc">Highest amount</option>
            <option value="amount_asc">Lowest amount</option>
          </select>

          <select
            aria-label="Currency filter"
            value={searchParams.get("currency") || ""}
            onChange={(e) => update({ currency: e.target.value || null })}
            className="shrink-0 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="">All currencies</option>
            {data.totalsByCurrency.map((item) => (
              <option key={item.currency} value={item.currency}>
                {item.currency}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                update({
                  datePreset: null,
                  propertyId: null,
                  currency: null,
                  earningsType: null,
                  payoutStatus: null,
                  sort: null,
                  search: null,
                  startDate: null,
                  endDate: null,
                });
              }}
              className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold text-rose-700 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Custom date pickers (desktop) */}
        {datePreset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-zinc-600">
              From
              <input
                type="date"
                value={searchParams.get("startDate") || ""}
                onChange={(e) => setCustomDate("startDate", e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-zinc-600">
              To
              <input
                type="date"
                value={searchParams.get("endDate") || ""}
                onChange={(e) => setCustomDate("endDate", e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() =>
              void load(new URLSearchParams(searchParams.toString()))
            }
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <section
        aria-busy={loading}
        className={`flex items-baseline justify-between transition-opacity ${loading ? "opacity-50" : ""}`}
      >
        <div>
          <p className="text-xs font-medium text-zinc-500">
            Total ({data.pagination.total} transaction
            {data.pagination.total === 1 ? "" : "s"} · based on{" "}
            {data.dateBasis === "EXECUTED_AT"
              ? "execution date"
              : "scheduled payout date"}
            )
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-950">{total}</p>
        </div>

        {/* Export */}
        <a
          href={`/api/v1/host/earnings/export?status=${kind}&${searchParams.toString()}`}
          className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-900 hover:border-zinc-900"
        >
          Export filtered CSV
        </a>
      </section>

      {/* Transaction list */}
      <div
        aria-busy={loading}
        className={`divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white transition-opacity ${loading ? "opacity-50" : ""}`}
      >
        {data.transactions.length ? (
          data.transactions.map((item) => {
            const returnTo = encodeURIComponent(
              pathname + (searchParams.toString() ? "?" + searchParams.toString() : ""),
            );
            return (
              <Link
                key={item.bookingId}
                href={`/host/earnings/transactions/${item.bookingId}?returnTo=${returnTo}`}
                className="flex w-full items-center gap-3 px-4 py-4 text-left first:rounded-t-2xl last:rounded-b-2xl hover:bg-zinc-50"
              >
                {/* Listing photo */}
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-sm">
                  {item.listingPhoto ? (
                    <Image
                      src={item.listingPhoto}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    "🏠"
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {item.listingTitle}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {item.guestName} ·{" "}
                    {dt(item.startDate)} – {dt(item.endDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Payout:{" "}
                    {dt(
                      isUpcoming
                        ? item.scheduledPayoutDate
                        : item.executionDetails?.executedAt || item.scheduledPayoutDate,
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-zinc-950">
                    {money(item.netPayout, item.currency)}
                  </p>
                  <span
                    className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyle(item.status)}`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </div>
                <span className="text-lg text-zinc-300">›</span>
              </Link>
            );
          })
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-zinc-800">No transactions found</p>
            <p className="mt-1 text-sm text-zinc-500">
              Try adjusting your filters or date range.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={data.pagination.page <= 1 || loading}
            onClick={() => update({ page: String(data.pagination.page - 1) })}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:border-zinc-900"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-500">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={data.pagination.page >= data.pagination.totalPages || loading}
            onClick={() => update({ page: String(data.pagination.page + 1) })}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:border-zinc-900"
          >
            Next
          </button>
        </div>
      )}

      {/* Mobile date filter sheet */}
      {dateFilterOpen && (
        <MobileDateFilterSheet
          kind={kind}
          preset={draftDatePreset}
          startDate={draftStartDate}
          endDate={draftEndDate}
          error={dateFilterError}
          onClose={() => setDateFilterOpen(false)}
          onPresetChange={(v) => {
            setDraftDatePreset(v);
            setDateFilterError(null);
          }}
          onStartDateChange={setDraftStartDate}
          onEndDateChange={setDraftEndDate}
          onApply={applyDateFilter}
        />
      )}
    </div>
  );
}

/* ─── Mobile Date Filter Bottom Sheet ────────────────────────────────────── */
function MobileDateFilterSheet({
  kind,
  preset,
  startDate,
  endDate,
  error,
  onClose,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
}: {
  kind: HostEarningsTransactionKind;
  preset: string;
  startDate: string;
  endDate: string;
  error: string | null;
  onClose: () => void;
  onPresetChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onApply: () => void;
}) {
  const options =
    kind === "upcoming"
      ? [
          ["all", "All dates"],
          ["next_30_days", "Next 30 days"],
          ["next_60_days", "Next 60 days"],
          ["next_90_days", "Next 90 days"],
          ["this_month", "This month"],
          ["custom", "Custom dates"],
        ]
      : [
          ["all", "All dates"],
          ["this_month", "This month"],
          ["last_month", "Last month"],
          ["last_30_days", "Last 30 days"],
          ["this_year", "This year"],
          ["custom", "Custom dates"],
        ];

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-filter-title"
      className="fixed inset-0 z-50 flex items-end bg-black/45 sm:hidden"
    >
      <div className="w-full rounded-t-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2
            id="date-filter-title"
            className="text-xl font-bold text-zinc-950"
          >
            Date filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close date filter"
            className="rounded-full p-2 text-xl text-zinc-400 hover:bg-zinc-100"
          >
            ×
          </button>
        </div>
        <div className="mt-5 space-y-1">
          {options.map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 hover:bg-zinc-50"
            >
              <span className="text-sm font-medium text-zinc-900">{label}</span>
              <input
                type="radio"
                name="mobile-date-filter"
                checked={preset === value}
                onChange={() => onPresetChange(value)}
                className="size-4 accent-zinc-900"
              />
            </label>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-zinc-600">
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-zinc-600">
              To
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onApply}
          className="mt-6 w-full rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Apply
        </button>
      </div>
    </ModalOverlay>
  );
}
