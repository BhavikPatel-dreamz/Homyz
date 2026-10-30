"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export interface PropertyComparisonItem {
  listingId: string;
  title: string;
  eligibleAccommodationRevenueCents: number;
  netHostEarningsCents: number;
  revpanCents: number | null;
  qualifyingBookingsCount: number;
  bookableNights: number;
  bookedNights: number;
  occupancyRatePercentage: number;
  averageRealizedNightlyRateCents: number | null;
  coverPhotoUrl?: string | null;
  location?: string | null;
}

interface PropertyComparisonTableProps {
  properties: PropertyComparisonItem[];
  currency?: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    eligibleListingsCount: number;
    listingsWithEarningsCount: number;
    highestEarningProperty: { title: string; netHostEarningsCents: number } | null;
  };
  selectedStatus?: string;
  selectedSort?: string;
  searchQuery?: string;
  analyticsQuery?: string;
  onFilterChange: (changes: {
    propertySearch?: string | null;
    propertyStatus?: string | null;
    propertySort?: string | null;
    propertyPage?: string | null;
    propertyPageSize?: string | null;
  }) => void;
  className?: string;
}

const fmt = (cents: number | null, curr = "SAR") => {
  if (cents === null) return "—";
  const val = Math.round(cents / 100);
  return `${curr} ${val.toLocaleString("en-US")}`;
};

function propertyAnalyticsHref(listingId: string, analyticsQuery = "") {
  const params = new URLSearchParams(analyticsQuery);
  params.set("propertyId", listingId);
  params.delete("listingId");
  params.set("propertyPage", "1");
  return `/host/earnings/analytics?${params.toString()}`;
}

function PropertyMobileCard({
  property,
  currency,
  analyticsQuery,
}: {
  property: PropertyComparisonItem;
  currency: string;
  analyticsQuery?: string;
}) {
  const href = propertyAnalyticsHref(property.listingId, analyticsQuery);
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          {property.coverPhotoUrl ? (
            <Image src={property.coverPhotoUrl} alt="" fill className="object-cover" sizes="44px" />
          ) : (
            <div className="flex size-full items-center justify-center text-zinc-400" aria-hidden="true">🏠</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-sm font-medium text-zinc-950 hover:text-amber-800" title={property.title}>
            {property.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{property.location || "Location not recorded"}</p>
        </div>
        <Link href={href} aria-label={`View analytics for ${property.title}`} className="shrink-0 rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
          •••
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-100 pt-3 text-xs">
        <div><dt className="text-zinc-500">Revenue</dt><dd className="mt-0.5 font-medium text-zinc-950">{fmt(property.eligibleAccommodationRevenueCents, currency)}</dd></div>
        <div><dt className="text-zinc-500">Net earnings</dt><dd className="mt-0.5 font-medium text-zinc-950">{fmt(property.netHostEarningsCents, currency)}</dd></div>
        <div><dt className="text-zinc-500">RevPAN</dt><dd className="mt-0.5 font-medium text-zinc-950">{fmt(property.revpanCents, currency)}</dd></div>
        <div><dt className="text-zinc-500">Occupancy</dt><dd className="mt-0.5 font-medium text-zinc-950">{property.occupancyRatePercentage}%</dd></div>
        <div><dt className="text-zinc-500">Bookings</dt><dd className="mt-0.5 font-medium text-zinc-950">{property.qualifyingBookingsCount}</dd></div>
      </dl>
    </article>
  );
}

export function PropertyComparisonTable({
  properties,
  currency = "SAR",
  pagination,
  summary,
  selectedStatus = "all",
  selectedSort = "net",
  searchQuery = "",
  analyticsQuery = "",
  onFilterChange,
  className = "",
}: PropertyComparisonTableProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const maxRevenue = Math.max(
    1,
    ...properties.map((p) => p.eligibleAccommodationRevenueCents),
  );
  const maxNet = Math.max(
    1,
    ...properties.map((p) => p.netHostEarningsCents),
  );
  const maxRevpan = Math.max(
    1,
    ...properties.map((p) => p.revpanCents || 0),
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      propertySearch: localSearch.trim() || null,
      propertyPage: "1",
    });
  };

  return (
    <div
      className={`rounded-3xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-xs ${className}`}
    >
      {/* ── 1. Top Header Row with 3 Summary KPI Badges ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 21h18M3 7v14M9 3v18M15 10v11M21 5v16" />
              </svg>
            </div>
            <h2 className="text-base sm:text-lg font-medium text-zinc-950">
              Your listings, compared
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500 font-normal">
            No external or competitor data. Calculated strictly from authorized completed stays.
          </p>
        </div>

        {/* 3 Summary KPIs on Right */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2">
            <div className="flex size-7 items-center justify-center rounded-xl bg-amber-100/60 text-amber-800">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-950 leading-none">
                {summary.eligibleListingsCount}
              </p>
              <p className="text-[10px] text-zinc-500 font-normal mt-0.5">
                Eligible listings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2">
            <div className="flex size-7 items-center justify-center rounded-xl bg-amber-100/60 text-amber-800">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-950 leading-none">
                {summary.listingsWithEarningsCount}
              </p>
              <p className="text-[10px] text-zinc-500 font-normal mt-0.5">
                Listings with earnings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-100 bg-zinc-50/70 px-3.5 py-2">
            <div className="flex size-7 items-center justify-center rounded-xl bg-amber-100/60 text-amber-800">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div className="max-w-[160px]">
              <p className="text-sm font-medium text-zinc-950 leading-none truncate">
                {summary.highestEarningProperty
                  ? fmt(summary.highestEarningProperty.netHostEarningsCents, currency)
                  : "—"}
              </p>
              <p className="text-[10px] text-zinc-500 font-normal mt-0.5 truncate" title={summary.highestEarningProperty?.title}>
                {summary.highestEarningProperty?.title || "Highest net earnings"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Filters & Search Bar ── */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex w-full items-center gap-2 sm:max-w-sm sm:flex-1">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search properties..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 transition"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Dropdowns */}
        <div className="flex w-full flex-col gap-2 min-[430px]:flex-row sm:w-auto">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) =>
              onFilterChange({ propertyStatus: e.target.value, propertyPage: "1" })
            }
            className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none focus:border-amber-400 font-medium cursor-pointer"
          >
            <option value="all">All properties</option>
            <option value="with_earnings">With earnings</option>
            <option value="without_earnings">Without earnings</option>
          </select>

          {/* Sort dropdown */}
          <select
            value={selectedSort}
            onChange={(e) =>
              onFilterChange({ propertySort: e.target.value, propertyPage: "1" })
            }
            className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800 outline-none focus:border-amber-400 font-medium cursor-pointer"
          >
            <option value="net">Sort by: Net earnings</option>
            <option value="gross">Sort by: Revenue</option>
            <option value="revpan">Sort by: RevPAN</option>
            <option value="occupancy">Sort by: Occupancy</option>
            <option value="bookings">Sort by: Bookings</option>
            <option value="nightly_rate">Sort by: Nightly rate</option>
          </select>
        </div>
      </div>

      {/* ── 3. Compact mobile listing cards ── */}
      <div className="mt-4 space-y-3 md:hidden">
        {properties.length > 0 ? properties.map((property) => (
          <PropertyMobileCard key={property.listingId} property={property} currency={currency} analyticsQuery={analyticsQuery} />
        )) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-center text-xs text-zinc-500">
            No properties match your filter criteria.
          </div>
        )}
      </div>

      {/* ── 4. Desktop/tablet comparison table ── */}
      <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-zinc-200 md:block">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-zinc-50/80 text-[11px] font-medium uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
            <tr>
              <th className="py-3 px-4 font-medium">Listing</th>
              <th className="py-3 px-4 font-medium">Revenue</th>
              <th className="py-3 px-4 font-medium">Net Earnings</th>
              <th className="py-3 px-4 font-medium">RevPAN</th>
              <th className="py-3 px-4 font-medium">Occupancy</th>
              <th className="py-3 px-4 font-medium">Bookings</th>
              <th className="py-3 px-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {properties.length > 0 ? (
              properties.map((p) => {
                const revPct = Math.min(
                  100,
                  Math.max(4, (p.eligibleAccommodationRevenueCents / maxRevenue) * 100),
                );
                const netPct = Math.min(
                  100,
                  Math.max(4, (p.netHostEarningsCents / maxNet) * 100),
                );
                const revpanPct = Math.min(
                  100,
                  Math.max(4, ((p.revpanCents || 0) / maxRevpan) * 100),
                );

                return (
                  <tr
                    key={p.listingId}
                    className="hover:bg-zinc-50/60 transition group"
                  >
                    {/* Listing Thumbnail + Title + Location */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/80">
                          {p.coverPhotoUrl ? (
                            <Image
                              src={p.coverPhotoUrl}
                              alt={p.title}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center text-zinc-400 bg-zinc-100">
                              🏠
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <Link
                            href={propertyAnalyticsHref(p.listingId, analyticsQuery)}
                            className="font-medium text-zinc-950 hover:text-amber-800 transition truncate block leading-tight"
                            title={p.title}
                          >
                            {p.title}
                          </Link>
                          {p.location && (
                            <span className="text-[11px] text-zinc-500 font-normal truncate block mt-0.5">
                              {p.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Revenue with mini bar */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900 w-16">
                          {fmt(p.eligibleAccommodationRevenueCents, currency)}
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                          <div
                            style={{ width: `${revPct}%` }}
                            className="h-full rounded-full bg-amber-400"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Net Earnings with mini bar */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900 w-16">
                          {fmt(p.netHostEarningsCents, currency)}
                        </span>
                        <div className="w-12 h-1.5 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                          <div
                            style={{ width: `${netPct}%` }}
                            className="h-full rounded-full bg-amber-500"
                          />
                        </div>
                      </div>
                    </td>

                    {/* RevPAN with mini bar */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900 w-14">
                          {fmt(p.revpanCents, currency)}
                        </span>
                        <div className="w-10 h-1.5 rounded-full bg-zinc-100 overflow-hidden shrink-0">
                          <div
                            style={{ width: `${revpanPct}%` }}
                            className="h-full rounded-full bg-amber-300"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Occupancy % */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-zinc-900">
                      {p.occupancyRatePercentage}%
                    </td>

                    {/* Bookings */}
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-zinc-900">
                      {p.qualifyingBookingsCount}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={propertyAnalyticsHref(p.listingId, analyticsQuery)}
                        className="inline-flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
                        title="View property analytics"
                      >
                        •••
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center text-xs text-zinc-500 font-normal"
                >
                  No properties match your filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 4. Pagination Controls ── */}
      <div className="mt-4 flex flex-col gap-3 text-xs font-normal text-zinc-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span>
          {pagination.total} result{pagination.total === 1 ? "" : "s"} · Page{" "}
          <strong className="font-medium text-zinc-900">
            {pagination.page}
          </strong>{" "}
          of {pagination.totalPages}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rows per page */}
          <select
            value={String(pagination.pageSize)}
            onChange={(e) =>
              onFilterChange({
                propertyPageSize: e.target.value,
                propertyPage: "1",
              })
            }
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none font-medium cursor-pointer"
          >
            <option value="10">10 rows</option>
            <option value="25">25 rows</option>
            <option value="50">50 rows</option>
          </select>

          {/* Prev */}
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() =>
              onFilterChange({ propertyPage: String(pagination.page - 1) })
            }
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹ Previous
          </button>

          {/* Page numbers (up to 5 pages shown) */}
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            const pNum = i + 1;
            const isCurrent = pNum === pagination.page;
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => onFilterChange({ propertyPage: String(pNum) })}
                className={`size-7 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isCurrent
                    ? "bg-amber-800 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {pNum}
              </button>
            );
          })}

          {pagination.totalPages > 5 && (
            <>
              <span className="text-zinc-400">…</span>
              <button
                type="button"
                onClick={() =>
                  onFilterChange({ propertyPage: String(pagination.totalPages) })
                }
                className={`size-7 rounded-lg text-xs font-medium transition cursor-pointer ${
                  pagination.totalPages === pagination.page
                    ? "bg-amber-800 text-white"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {pagination.totalPages}
              </button>
            </>
          )}

          {/* Next */}
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              onFilterChange({ propertyPage: String(pagination.page + 1) })
            }
            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next ›
          </button>
        </div>
      </div>
    </div>
  );
}
