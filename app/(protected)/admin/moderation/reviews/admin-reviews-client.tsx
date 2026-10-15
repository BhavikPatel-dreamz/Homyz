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
          <nav className="text-xs text-slate-500">
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>{" "}
            &gt;{" "}
            <Link href="/admin/moderation" className="hover:underline">
              Moderation
            </Link>{" "}
            &gt; Reviews
          </nav>
          <h1 className="mt-1">Review Management &amp; Moderation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage two-directional guest and host reviews, monitor reciprocal blind states, and execute moderation policies.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/moderation"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Moderation Dashboard
          </Link>
          <Link
            href="/admin/moderation/cases"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cases Queue
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total in View</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{initialPagination.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{publishedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pending Reciprocal</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{privateCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Hidden / Moderated</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{hiddenCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Flagged Cases</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">{flaggedCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {/* Direction */}
          <div>
            <label className="text-xs font-medium text-slate-600">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
            >
              <option value="">All Directions</option>
              <option value="GUEST_TO_PROPERTY">Guest to Property</option>
              <option value="HOST_TO_GUEST">Host to Guest</option>
            </select>
          </div>


          {/* Rating */}
          <div>
            <label className="text-xs font-medium text-slate-600">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
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
            <label className="text-xs font-medium text-slate-600">Search text / user</label>
            <input
              type="text"
              placeholder="Search comments, reviewer name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs"
            />
          </div>

          <div className="mt-5 flex w-full items-center justify-center gap-2 p-2">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => applyFilters(1)}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
          </div>
        </div>

      </div>

      {/* Reviews Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600">
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
            <tbody className="divide-y divide-slate-200">
              {initialReviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No reviews found matching your criteria.
                  </td>
                </tr>
              ) : (
                initialReviews.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-amber-500">
                      {"★".repeat(r.rating)}
                      <span className="ml-1 text-slate-600 font-normal">({r.rating})</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.author.name || "Anonymous"}</p>
                      <p className="text-[10px] text-slate-400">{r.author.email || r.author.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate">
                      {r.targetUser ? (
                        <div>
                          <p className="font-medium text-slate-900 truncate">{r.targetUser.name || "User"}</p>
                          <p className="text-[10px] text-slate-400 truncate">{r.targetUser.email}</p>
                        </div>
                      ) : r.listing ? (
                        <p className="font-medium text-slate-900 truncate" title={r.listing.title}>
                          {r.listing.title}
                        </p>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.direction === "GUEST_TO_PROPERTY"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          }`}
                      >
                        {r.direction === "GUEST_TO_PROPERTY" ? "Guest → Property" : "Host → Guest"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.status === "PUBLISHED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : r.status === "PRIVATE"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : r.status === "HIDDEN"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                      >
                        {r.status}
                      </span>
                      {r.moderationCase && (
                        <span className="ml-1 inline-block rounded bg-purple-100 px-1 text-[9px] font-bold text-purple-800">
                          FLAGGED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-slate-700">
                      {r.comment ? (
                        <span title={r.comment}>{r.comment}</span>
                      ) : (
                        <span className="italic text-slate-400">Rating only</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-500">
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReview(r)}
                        className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
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
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              Page {initialPagination.page} of {initialPagination.totalPages} ({initialPagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={initialPagination.page <= 1}
                onClick={() => applyFilters(initialPagination.page - 1)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={initialPagination.page >= initialPagination.totalPages}
                onClick={() => applyFilters(initialPagination.page + 1)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
