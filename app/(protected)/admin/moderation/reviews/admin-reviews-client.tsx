"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminReviewDetailModal,
  type AdminReviewItem,
} from "./admin-review-detail-modal";

interface AdminReviewsClientProps {
  initialReviews: AdminReviewItem[];
  initialPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  initialFilters: {
    direction?: string;
    status?: string;
    rating?: string;
    search?: string;
    flagged?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function AdminReviewsClient({
  initialReviews,
  initialPagination,
  initialFilters,
}: AdminReviewsClientProps) {
  const router = useRouter();

  const [direction, setDirection] = useState(initialFilters.direction || "");
  const [status, setStatus] = useState(initialFilters.status || "");
  const [rating, setRating] = useState(initialFilters.rating || "");
  const [search, setSearch] = useState(initialFilters.search || "");
  const [flagged, setFlagged] = useState(initialFilters.flagged === "true");
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom || "");
  const [dateTo, setDateTo] = useState(initialFilters.dateTo || "");

  const [selectedReview, setSelectedReview] = useState<AdminReviewItem | null>(null);

  function applyFilters(page = 1) {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (direction) params.set("direction", direction);
    if (status) params.set("status", status);
    if (rating) params.set("rating", rating);
    if (search.trim()) params.set("search", search.trim());
    if (flagged) params.set("flagged", "true");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    router.replace(`/admin/moderation/reviews?${params.toString()}`);
  }

  function clearFilters() {
    setDirection("");
    setStatus("");
    setRating("");
    setSearch("");
    setFlagged(false);
    setDateFrom("");
    setDateTo("");
    router.replace("/admin/moderation/reviews");
  }

  // Quick stats
  const publishedCount = initialReviews.filter((r) => r.status === "PUBLISHED").length;
  const privateCount = initialReviews.filter((r) => r.status === "PRIVATE").length;
  const hiddenCount = initialReviews.filter((r) => r.status === "HIDDEN").length;
  const flaggedCount = initialReviews.filter((r) => Boolean(r.moderationCase)).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="text-xs text-slate-500 dark:text-zinc-400">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>{" "}
            &gt;{" "}
            <Link href="/admin/moderation" className="hover:underline">
              Moderation
            </Link>{" "}
            &gt; Reviews
          </nav>
          <h1 className="mt-1 text-slate-900 dark:text-zinc-100 font-bold text-2xl">Review Management &amp; Moderation</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Manage two-directional guest and host reviews, monitor reciprocal blind states, and execute moderation policies.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/moderation"
            className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition"
          >
            Moderation Dashboard
          </Link>
          <Link
            href="/admin/moderation/cases"
            className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition"
          >
            Cases Queue
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total in View</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-zinc-100">{initialPagination.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{publishedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Pending Reciprocal</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{privateCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Hidden / Moderated</p>
          <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{hiddenCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Flagged Cases</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{flaggedCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {/* Direction */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 p-2 text-xs"
            >
              <option value="">All Directions</option>
              <option value="GUEST_TO_PROPERTY">Guest to Property</option>
              <option value="HOST_TO_GUEST">Host to Guest</option>
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 p-2 text-xs"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>

          {/* Search */}
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-zinc-400">Search text / user</label>
            <input
              type="text"
              placeholder="Search comments, reviewer name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 p-2 text-xs"
            />
          </div>

          <div className="mt-5 flex w-full items-center justify-center gap-2 p-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => applyFilters(1)}
              className="rounded-lg bg-slate-900 dark:bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800 text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 font-semibold text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Subject / Target</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Comment Preview</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {initialReviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-zinc-400">
                    No reviews found matching your criteria.
                  </td>
                </tr>
              ) : (
                initialReviews.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/75 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-amber-500">
                      {"★".repeat(r.rating)}
                      <span className="ml-1 text-slate-600 dark:text-zinc-400 font-normal">({r.rating})</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-zinc-100">{r.author.name || "Anonymous"}</p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">{r.author.email || r.author.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate">
                      {r.targetUser ? (
                        <div>
                          <p className="font-medium text-slate-900 dark:text-zinc-100 truncate">{r.targetUser.name || "User"}</p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{r.targetUser.email}</p>
                        </div>
                      ) : r.listing ? (
                        <p className="font-medium text-slate-900 dark:text-zinc-100 truncate" title={r.listing.title}>
                          {r.listing.title}
                        </p>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.direction === "GUEST_TO_PROPERTY"
                            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40"
                            : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40"
                        }`}
                      >
                        {r.direction === "GUEST_TO_PROPERTY" ? "Guest → Property" : "Host → Guest"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.status === "PUBLISHED"
                            ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40"
                            : r.status === "PRIVATE"
                              ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40"
                              : r.status === "HIDDEN"
                                ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
                                : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.moderationCase && (
                        <span className="ml-1 inline-block rounded bg-purple-100 dark:bg-purple-950/60 px-1 text-[9px] font-bold text-purple-800 dark:text-purple-300">
                          FLAGGED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-700 dark:text-zinc-300">
                      {r.comment ? (
                        <span title={r.comment}>{r.comment}</span>
                      ) : (
                        <span className="italic text-slate-400 dark:text-zinc-500">Rating only</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500 dark:text-zinc-400">
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReview(r)}
                        className="rounded-lg bg-slate-900 dark:bg-zinc-100 px-2.5 py-1 text-xs font-medium text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 transition"
                      >
                        View &amp; Moderate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {initialPagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50">
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Page {initialPagination.page} of {initialPagination.totalPages} ({initialPagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={initialPagination.page <= 1}
                onClick={() => applyFilters(initialPagination.page - 1)}
                className="rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={initialPagination.page >= initialPagination.totalPages}
                onClick={() => applyFilters(initialPagination.page + 1)}
                className="rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Detail & Moderation Modal */}
      {selectedReview && (
        <AdminReviewDetailModal
          review={selectedReview}
          isOpen={Boolean(selectedReview)}
          onClose={() => setSelectedReview(null)}
          onActionComplete={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
