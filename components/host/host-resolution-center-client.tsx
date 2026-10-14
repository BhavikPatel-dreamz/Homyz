"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type DisputeRow = {
  id: string;
  caseReference: string;
  category: string;
  status: string;
  disputeWorkflowStatus: string;
  responseRequired: boolean;
  reporterRole: string;
  createdAt: string;
  updatedAt: string;
  listing: {
    id: string;
    title: string;
    photos?: string[];
    city?: string | null;
    country?: string | null;
  };
  booking: {
    id: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    totalPrice?: number | null;
    currency?: string | null;
  } | null;
};

type Props = {
  data: {
    disputes: DisputeRow[];
    summary: { totalCases: number; responseRequired: number; underReview: number; resolved: number };
    pagination: { page: number; totalPages: number; total: number };
  };
  listings: { id: string; title: string }[];
};

const tabs = [
  ["all", "All Disputes"],
  ["response_required", "Response Required"],
  ["open", "Under Review"],
  ["resolved", "Resolved & Closed"],
] as const;

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildQuery(params: URLSearchParams, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  next.delete("page");
  return next.toString();
}

export function HostResolutionCenterClient({ data, listings }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const activeTab = searchParams.get("tab") || "all";

  useEffect(() => {
    const current = searchParams.get("search") || "";
    if (search === current) return;
    const timeout = window.setTimeout(
      () => router.replace(`${pathname}?${buildQuery(searchParams, { search })}`),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [search, searchParams, router, pathname]);

  const navigate = (patch: Record<string, string | undefined>) => {
    const query = buildQuery(searchParams, patch);
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const hasActiveFilters = Boolean(
    searchParams.get("search") ||
      searchParams.get("propertyId") ||
      searchParams.get("status") ||
      searchParams.get("startDate") ||
      searchParams.get("endDate") ||
      searchParams.get("tab"),
  );

  return (
    <div className="w-full space-y-8 font-sans text-[#1F1F1F]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Host Operations
            </span>
            <span className="text-zinc-300">/</span>
            <span className="text-xs sm:text-sm text-[#727272]">Resolution Center</span>
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1F1F1F]">
            Resolution Center
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-[#727272] max-w-2xl leading-relaxed">
            Manage booking complaints, respond to support inquiries, submit evidence, and propose resolutions for your properties.
          </p>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[20px] border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-[#727272]">
            Total Disputes
          </span>
          <p className="mt-2 text-3xl sm:text-4xl font-bold text-[#1F1F1F]">
            {data.summary.totalCases.toLocaleString()}
          </p>
        </div>

        <div className="rounded-[20px] border border-amber-300 bg-amber-50/70 p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-amber-900">
            Response Required
          </span>
          <p className="mt-2 text-3xl sm:text-4xl font-bold text-amber-900">
            {data.summary.responseRequired.toLocaleString()}
          </p>
        </div>

        <div className="rounded-[20px] border border-blue-200 bg-blue-50/70 p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-blue-900">
            Under Review
          </span>
          <p className="mt-2 text-3xl sm:text-4xl font-bold text-blue-900">
            {data.summary.underReview.toLocaleString()}
          </p>
        </div>

        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6 shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-emerald-900">
            Resolved
          </span>
          <p className="mt-2 text-3xl sm:text-4xl font-bold text-emerald-900">
            {data.summary.resolved.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate({ tab: id === "all" ? undefined : id })}
            className={`min-h-11 shrink-0 rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === id
                ? "bg-[#1F1F1F] text-white shadow-xs"
                : "border border-zinc-200 bg-white text-[#555] hover:border-zinc-400 hover:text-[#1F1F1F]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter Controls Panel */}
      <div className="grid gap-3.5 rounded-[20px] border border-zinc-200 bg-zinc-50/80 p-5 md:grid-cols-6 text-sm">
        <label className="md:col-span-2">
          <span className="sr-only">Search disputes</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search case #, booking #, or property title..."
            className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none focus:border-zinc-900"
          />
        </label>

        <select
          value={searchParams.get("propertyId") || ""}
          onChange={(e) => navigate({ propertyId: e.target.value || undefined })}
          className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none focus:border-zinc-900 cursor-pointer"
        >
          <option value="">All Properties</option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.title}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("status") || ""}
          onChange={(e) => navigate({ status: e.target.value || undefined })}
          className="min-h-11 rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none focus:border-zinc-900 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Open</option>
          <option value="CONFIRMED">Under Review</option>
          <option value="RESOLVED">Resolved</option>
        </select>

        <label>
          <span className="sr-only">Filed from</span>
          <input
            type="date"
            value={searchParams.get("startDate") || ""}
            onChange={(e) => navigate({ startDate: e.target.value || undefined })}
            className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none focus:border-zinc-900"
            aria-label="Filed from"
          />
        </label>

        <label>
          <span className="sr-only">Filed through</span>
          <input
            type="date"
            value={searchParams.get("endDate") || ""}
            onChange={(e) => navigate({ endDate: e.target.value || undefined })}
            className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm outline-none focus:border-zinc-900"
            aria-label="Filed through"
          />
        </label>
      </div>

      {/* Disputes List */}
      {data.disputes.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-20 text-center text-sm text-[#727272] space-y-3">
          <p className="font-semibold text-base sm:text-lg text-[#1F1F1F]">No dispute cases found</p>
          <p className="max-w-md mx-auto text-xs sm:text-sm">There are no cases matching the selected filter criteria.</p>
          {hasActiveFilters && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.push(pathname)}
                className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-100 cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-xs">
          <div className="divide-y divide-zinc-100">
            {data.disputes.map((dispute) => {
              const isResolved = dispute.status === "RESOLVED" || dispute.disputeWorkflowStatus === "RESOLVED";
              const isClosed = dispute.disputeWorkflowStatus === "CLOSED";
              const isOpen = !isResolved && !isClosed;

              return (
                <div
                  key={dispute.id}
                  className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center md:justify-between hover:bg-zinc-50/70 transition-colors"
                >
                  {/* Left: Thumbnail & Content Info */}
                  <div className="flex items-start gap-4 sm:gap-5 min-w-0">
                    {/* Property Thumbnail */}
                    <div className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100">
                      {dispute.listing.photos?.[0] ? (
                        <img
                          src={dispute.listing.photos[0]}
                          alt={dispute.listing.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-2">
                      {/* Badges Line */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-[#1F1F1F]">
                          #{dispute.caseReference}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                            isResolved
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : isClosed
                                ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                                : dispute.disputeWorkflowStatus === "UNDER_REVIEW"
                                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isResolved
                            ? "Resolved"
                            : isClosed
                              ? "Closed"
                              : dispute.disputeWorkflowStatus.replaceAll("_", " ")}
                        </span>

                        {/* Response Required Badge - only when genuinely open */}
                        {isOpen && dispute.responseRequired && (
                          <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-0.5 text-xs font-bold text-amber-900 shadow-2xs">
                            Response Required
                          </span>
                        )}

                        {/* Reporter Badge */}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          <span className="size-1.5 rounded-full bg-zinc-400" />
                          Reported by {dispute.reporterRole.toLowerCase()}
                        </span>
                      </div>

                      {/* Property Title */}
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="truncate text-base sm:text-lg font-bold text-[#1F1F1F]">
                          {dispute.listing.title}
                        </p>
                        {dispute.listing.city && (
                          <span className="text-xs sm:text-sm text-zinc-500 font-normal">
                            · {dispute.listing.city}
                          </span>
                        )}
                      </div>

                      {/* Metadata Row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm text-[#727272]">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700">
                          {formatCategory(dispute.category)}
                        </span>

                        {dispute.booking?.id && (
                          <Link
                            href={`/host/bookings/${dispute.booking.id}`}
                            className="hover:text-black hover:underline"
                          >
                            Booking:{" "}
                            <span className="font-mono text-zinc-800 font-medium">
                              #{dispute.booking.id.slice(0, 10)}
                            </span>
                          </Link>
                        )}

                        {dispute.booking?.startDate && dispute.booking?.endDate && (
                          <span className="text-zinc-500">
                            Stay: {formatDate(dispute.booking.startDate)} – {formatDate(dispute.booking.endDate)}
                          </span>
                        )}

                        <span className="text-zinc-400 hidden sm:inline">·</span>
                        <span>Filed: {formatDate(dispute.createdAt)}</span>
                        <span className="text-zinc-400 hidden sm:inline">·</span>
                        <span>Updated: {formatDate(dispute.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center pt-2 md:pt-0">
                    {dispute.booking?.id && (
                      <Link
                        href={`/host/bookings/${dispute.booking.id}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-100 transition-colors"
                      >
                        Booking
                      </Link>
                    )}

                    <Link
                      href={`/host/resolution-center/${dispute.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1F1F1F] px-5 py-2 text-sm font-semibold text-white hover:bg-black transition-colors shadow-2xs"
                    >
                      {isResolved || isClosed ? "View Decision" : "View Case"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 p-5 text-sm">
              <span className="text-[#727272]">
                Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} cases
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={data.pagination.page <= 1}
                  onClick={() => navigate({ page: String(data.pagination.page - 1) })}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:bg-zinc-50 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  onClick={() => navigate({ page: String(data.pagination.page + 1) })}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-40 hover:bg-zinc-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
