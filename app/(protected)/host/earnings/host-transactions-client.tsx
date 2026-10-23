"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCurrency } from "@/lib/currency-context";
import { BackButton } from "@/components/ui/back-button";
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
      ? "bg-amber-50 text-amber-700 border border-amber-200"
      : "bg-[#FEF9EE] text-[#D97706] border border-[#FCDF9C]";

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
    <div className="space-y-8 pb-16">
      {/* Header */}
      <header className="space-y-3">
        <BackButton
          href="/host/earnings"
          aria-label="Back to Earnings"
        />
        <div>
          <span className="text-sm font-medium text-[#727272]">Hosting · Payouts</span>
          <h1 className="mt-1">
            {title} payouts
          </h1>
          <p className="mt-1.5 text-sm text-[#727272]">
            {isUpcoming
              ? "Scheduled, ready and currently processing host payouts"
              : "Completed and verified payout executions"}
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
        {/* Search */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727272]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reservation, property or guest…"
            className="w-full rounded-full border border-[#D7D7D7] bg-[#F9F9F9] py-2.5 pl-10 pr-10 text-sm text-[#1F1F1F] transition placeholder:text-[#A0A0A0] focus:border-[#1F1F1F] focus:bg-white focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#727272] hover:text-[#1F1F1F]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter chips — scrollable row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile: date filter button */}
          <button
            type="button"
            onClick={openDateFilter}
            className="inline-flex items-center gap-2 shrink-0 rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-3 py-1.5 text-xs font-medium text-[#1F1F1F] transition hover:border-[#1F1F1F] sm:hidden"
          >
            <span>
              {datePreset === "all"
                ? "All dates"
                : datePreset.replaceAll("_", " ")}
            </span>
            <svg
              className="h-3.5 w-3.5 text-[#727272]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {/* Desktop: date select */}
          <div className="group relative hidden shrink-0 sm:inline-flex items-center">
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
              className="appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-1.5 text-sm font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
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
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Listing filter */}
          <div className="group relative shrink-0 inline-flex items-center">
            <select
              aria-label="Listing filter"
              value={searchParams.get("propertyId") || ""}
              onChange={(e) => update({ propertyId: e.target.value || null })}
              className="max-w-[260px] sm:max-w-[320px] truncate appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-1.5 text-sm font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="">All listings</option>
              {data.listings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Payout status filter */}
          <div className="group relative shrink-0 inline-flex items-center">
            <select
              aria-label="Payout status"
              value={searchParams.get("payoutStatus") || ""}
              onChange={(e) => update({ payoutStatus: e.target.value || null })}
              className="appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-1.5 text-sm font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
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
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Sort filter */}
          <div className="group relative shrink-0 inline-flex items-center">
            <select
              aria-label="Sort"
              value={searchParams.get("sort") || "date_desc"}
              onChange={(e) =>
                update({ sort: e.target.value === "date_desc" ? null : e.target.value })
              }
              className="appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-1.5 text-sm font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="date_desc">Most recent</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Highest amount</option>
              <option value="amount_asc">Lowest amount</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Currency filter */}
          <div className="group relative shrink-0 inline-flex items-center">
            <select
              aria-label="Currency filter"
              value={searchParams.get("currency") || ""}
              onChange={(e) => update({ currency: e.target.value || null })}
              className="appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-1.5 text-sm font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="">All currencies</option>
              {data.totalsByCurrency.map((item) => (
                <option key={item.currency} value={item.currency}>
                  {item.currency}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

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
              className="ml-auto shrink-0 rounded-full px-3 py-1.5 text-sm font-medium hover:text-[#1f1f1f] underline text-[#727272] underline-offset-3"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Custom date pickers (desktop) */}
        {datePreset === "custom" && (
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#EDEDED]">
            <label className="text-xs font-semibold text-[#727272]">
              From
              <input
                type="date"
                value={searchParams.get("startDate") || ""}
                onChange={(e) => setCustomDate("startDate", e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-[#D7D7D7] px-3.5 py-2 text-sm text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-[#727272]">
              To
              <input
                type="date"
                value={searchParams.get("endDate") || ""}
                onChange={(e) => setCustomDate("endDate", e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-[#D7D7D7] px-3.5 py-2 text-sm text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              />
            </label>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() =>
              void load(new URLSearchParams(searchParams.toString()))
            }
            className="font-semibold underline hover:text-rose-950"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <section
        aria-busy={loading}
        className={`flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between transition-opacity ${loading ? "opacity-50" : ""}`}
      >
        <div>
          <p className="text-sm font-normal text-[#1f1f1f]">
            Total ({data.pagination.total} transaction
            {data.pagination.total === 1 ? "" : "s"} · based on{" "}
            {data.dateBasis === "EXECUTED_AT"
              ? "execution date"
              : "scheduled payout date"}
            )
          </p>
          <p className="mt-1 text-2xl font-medium tracking-tight text-[#1F1F1F] sm:text-3xl">{total}</p>
        </div>

        {/* Export */}
        <a
          href={`/api/v1/host/earnings/export?status=${kind}&${searchParams.toString()}`}
          className="inline-flex items-center justify-center gap-1.5 shrink-0 rounded-full border border-[#1F1F1F] hover:bg-white px-4 py-2 text-sm font-medium hover:text-[#1F1F1F] transition hover:border-[#1F1F1F] bg-[#1F1F1F] text-white"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export filtered CSV
        </a>
      </section>

      {/* Transaction list */}
      <div
        aria-busy={loading}
        className={`divide-y divide-[#EDEDED] rounded-3xl border border-[#E5E5E5] bg-white shadow-sm transition-opacity ${loading ? "opacity-50" : ""}`}
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
                className="group flex w-full items-center gap-3.5 px-5 py-4 text-left first:rounded-t-3xl last:rounded-b-3xl transition hover:bg-[#F9F9F9]"
              >
                {/* Listing photo */}
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F4F5] text-sm text-[#727272]">
                  {item.listingPhoto ? (
                    <Image
                      src={item.listingPhoto}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="size-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <svg className="h-5 w-5 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1F1F1F]">
                    {item.listingTitle}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#727272]">
                    {item.guestName} · {dt(item.startDate)} – {dt(item.endDate)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#A0A0A0]">
                    Payout:{" "}
                    {dt(
                      isUpcoming
                        ? item.scheduledPayoutDate
                        : item.executionDetails?.executedAt || item.scheduledPayoutDate,
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#1F1F1F]">
                    {money(item.netPayout, item.currency)}
                  </p>
                  <span
                    className={`mt-0.5 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${statusStyle(item.status)}`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </div>
                <svg className="h-4 w-4 shrink-0 text-[#C7C7C7] transition group-hover:translate-x-0.5 group-hover:text-[#1F1F1F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            );
          })
        ) : (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4F5] text-[#727272]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <p className="mt-3 font-semibold text-[#1F1F1F]">No transactions found</p>
            <p className="mt-1 text-xs text-[#727272]">
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
            className="rounded-full border border-[#D7D7D7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs font-medium text-[#727272]">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={data.pagination.page >= data.pagination.totalPages || loading}
            onClick={() => update({ page: String(data.pagination.page + 1) })}
            className="rounded-full border border-[#D7D7D7] bg-white px-4 py-2 text-xs font-semibold text-[#1F1F1F] transition hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40"
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
      <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-[#E5E5E5] bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl">
        <div className="flex items-center justify-between">
          <h2
            id="date-filter-title"
            className="text-lg font-bold text-[#1F1F1F]"
          >
            Date filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close date filter"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#727272] transition hover:bg-[#F3F4F5] hover:text-[#1F1F1F]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mt-4 space-y-1">
          {options.map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center justify-between rounded-2xl px-3.5 py-3 transition hover:bg-[#F9F9F9]"
            >
              <span className="text-sm font-medium text-[#1F1F1F]">{label}</span>
              <input
                type="radio"
                name="mobile-date-filter"
                checked={preset === value}
                onChange={() => onPresetChange(value)}
                className="size-4 accent-[#1F1F1F]"
              />
            </label>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-[#EDEDED]">
            <label className="text-xs font-semibold text-[#727272]">
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-[#D7D7D7] px-3.5 py-2 text-sm text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-[#727272]">
              To
              <input
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="mt-1 block w-full rounded-2xl border border-[#D7D7D7] px-3.5 py-2 text-sm text-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
              />
            </label>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-xs font-semibold text-rose-600">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onApply}
          className="mt-6 w-full rounded-full bg-[#1F1F1F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
        >
          Apply
        </button>
      </div>
    </ModalOverlay>
  );
}
