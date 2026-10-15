"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";

interface ModerationReportItem {
  id: string;
  targetType: string;
  targetId: string;
  category: string;
  reasonCode: string;
  description: string | null;
  relatedBookingId: string | null;
  createdAt: string;
  case?: {
    caseReference: string;
    status: string;
    severity: string;
    updatedAt: string;
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "RESOLVED":
      return { label: "Resolved", className: "bg-emerald-100 text-emerald-800" };
    case "DISMISSED":
      return { label: "Dismissed (No Violation)", className: "bg-slate-100 text-slate-700" };
    case "NEEDS_INFORMATION":
      return { label: "Action Required", className: "bg-amber-100 text-amber-800" };
    case "IN_REVIEW":
      return { label: "Under Investigation", className: "bg-blue-100 text-blue-800" };
    case "NEW":
    default:
      return { label: "Submitted", className: "bg-purple-100 text-purple-800" };
  }
}

export function MyReportsView() {
  const [reports, setReports] = useState<ModerationReportItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadReports = (page = 1) => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/moderation/reports?page=${page}&limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load reports");
        return res.json();
      })
      .then((data) => {
        setReports(data.data || []);
        if (data.pagination) setPagination(data.pagination);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error loading reports");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadReports(1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports &amp; Disputes</h2>
          <p className="mt-1 text-xs text-slate-500">
            Track your review-removal requests and content policy reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadReports(pagination.page)}
          disabled={loading || isPending}
          className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {loading && reports.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">
          Loading your report history...
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8">
          <svg className="mx-auto size-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5l5 5V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No reports submitted</h3>
          <p className="mt-1 text-xs text-slate-500">
            You haven't submitted any review disputes or content reports.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const statusInfo = getStatusBadge(report.case?.status || "NEW");
            const isActionRequired = report.case?.status === "NEEDS_INFORMATION";

            return (
              <article
                key={report.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                  isActionRequired ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-indigo-700">
                      {report.case?.caseReference || `REP-${report.id.slice(0, 8)}`}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs font-medium text-slate-500 capitalize">
                      {report.targetType.toLowerCase().replaceAll("_", " ")} Report
                    </span>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Report Reason</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {report.reasonCode.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Date Submitted</p>
                    <p className="mt-0.5 text-sm text-slate-700">
                      {new Date(report.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {report.description && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold text-slate-600">Your Explanation:</p>
                    <p className="mt-1 whitespace-pre-wrap">{report.description}</p>
                  </div>
                )}

                {isActionRequired && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    <span className="font-semibold">Update: </span>
                    Our Trust &amp; Safety team has reviewed your report and requested additional information. Please check your notification messages for next steps.
                  </div>
                )}

                {report.case?.status === "RESOLVED" && (
                  <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                    <span className="font-semibold">Outcome: </span>
                    Investigation complete. Authorized policy action has been finalized by our moderation team.
                  </div>
                )}

                {report.case?.status === "DISMISSED" && (
                  <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-700">
                    <span className="font-semibold">Outcome: </span>
                    Investigation concluded. The reported content was determined not to violate our published marketplace standards.
                  </div>
                )}
              </article>
            );
          })}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => loadReports(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => loadReports(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

