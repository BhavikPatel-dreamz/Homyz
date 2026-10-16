"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { ModerationAppeal } from "@/services/moderation.service";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Summary {
  total: number;
  submitted: number;
  underReview: number;
  decided: number;
  approved: number;
  rejected: number;
}

interface Moderator {
  id: string;
  name: string | null;
  email: string | null;
}

const statusTabs = ["ALL", "SUBMITTED", "UNDER_REVIEW", "DECIDED", "WITHDRAWN"] as const;

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "—";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "bg-amber-100 text-amber-800";
    case "UNDER_REVIEW":
      return "bg-blue-100 text-blue-800";
    case "DECIDED":
      return "bg-purple-100 text-purple-800";
    case "WITHDRAWN":
      return "bg-slate-200 text-slate-700";
    case "CLOSED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function getDecisionBadge(decision: string) {
  switch (decision) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800";
    case "PARTIALLY_APPROVED":
      return "bg-teal-100 text-teal-800";
    case "REJECTED":
      return "bg-red-100 text-red-800";
    case "PENDING":
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function AdminAppealsClient({
  initialAppeals,
  initialPagination,
  initialSummary,
  initialFilters,
  moderators,
}: {
  initialAppeals: ModerationAppeal[];
  initialPagination: Pagination;
  initialSummary: Summary;
  initialFilters: Record<string, string | undefined>;
  moderators: Moderator[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<ModerationAppeal[]>(initialAppeals);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [filters, setFilters] = useState<Record<string, string | undefined>>(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedAppeal, setSelectedAppeal] = useState<ModerationAppeal | null>(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "PARTIALLY_APPROVED">("APPROVED");
  const [decisionReason, setDecisionReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reinstateContent, setReinstateContent] = useState(true);
  const [reopenCase, setReopenCase] = useState(true);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const initialMount = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const activeStatus = filters.status || "ALL";

  const updateFilters = (updates: Record<string, string | undefined>) => {
    setFilters((current) => ({ ...current, ...updates, page: "1" }));
  };

  const buildParams = useCallback(
    (page?: number) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value && key !== "page") params.set(key, value);
      }
      params.set("page", String(page ?? (Number(filters.page) || 1)));
      params.set("limit", filters.limit || "20");
      return params;
    },
    [filters],
  );

  const load = useCallback(
    async (page = 1) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const params = buildParams(page);
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/moderation/appeals?${params}`, { signal: controller.signal });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error?.message || "Failed to load appeals.");

        if (!controller.signal.aborted) {
          setItems(payload.data?.items || []);
          if (payload.data?.summary) setSummary(payload.data.summary);
          setPagination({
            page: payload.data?.page || 1,
            limit: payload.data?.limit || 20,
            total: payload.data?.total || 0,
            totalPages: payload.data?.totalPages || 1,
          });
          router.replace(`${pathname}?${params}`);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load appeals.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [buildParams, pathname, router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== (filters.search || "")) {
        updateFilters({ search: searchInput.trim() || undefined });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search]);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    void load(1);
  }, [filters.status, filters.decision, filters.assignedReviewerId, filters.sort, filters.limit, filters.search, load]);

  const handleOpenReview = (appeal: ModerationAppeal) => {
    setSelectedAppeal(appeal);
    setDecision("APPROVED");
    setDecisionReason("");
    setReviewNotes("");
    setReinstateContent(true);
    setReopenCase(true);
    setDecisionError(null);
    setAssignError(null);
    setDecisionModalOpen(true);
  };

  const handleAssignReviewer = async (reviewerId: string | null) => {
    if (!selectedAppeal) return;
    setIsAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/v1/moderation/cases/${selectedAppeal.caseId}/appeals/${selectedAppeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to assign reviewer.");
      // Update local state
      setSelectedAppeal((prev) =>
        prev
          ? {
              ...prev,
              assignedReviewerId: payload.data?.reviewerId || null,
              assignedReviewerName: payload.data?.reviewerName || null,
              status: prev.status === "SUBMITTED" ? "UNDER_REVIEW" : prev.status,
            }
          : null,
      );
      void load(pagination.page);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign reviewer.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal) return;
    if (decisionReason.trim().length < 5) {
      setDecisionError("Please provide a decision explanation of at least 5 characters.");
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);

    try {
      const res = await fetch(
        `/api/v1/moderation/cases/${selectedAppeal.caseId}/appeals/${selectedAppeal.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            decisionReason: decisionReason.trim(),
            reviewNotes: reviewNotes.trim() || undefined,
            reinstateContent,
            reopenCase,
          }),
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to record appeal decision.");

      setDecisionModalOpen(false);
      setSelectedAppeal(null);
      void load(pagination.page);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Failed to record appeal decision.");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Support &amp; Operations / Moderation</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Appeals Queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review, investigate, and decide client and host moderation appeals.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/moderation/cases"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Moderation Cases
          </Link>
          <Link
            href="/admin/moderation"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 shadow-sm"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Appeals</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-700">Submitted</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{summary.submitted}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-700">Under Review</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">{summary.underReview}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-700">Decided</p>
          <p className="mt-2 text-2xl font-bold text-purple-900">{summary.decided}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Approved</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{summary.approved}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-red-700">Rejected</p>
          <p className="mt-2 text-2xl font-bold text-red-900">{summary.rejected}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <nav aria-label="Appeal status tabs" className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => updateFilters({ status: tab === "ALL" ? undefined : tab })}
            className={`whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition ${
              activeStatus === tab
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.replaceAll("_", " ")}
          </button>
        ))}
      </nav>

      {/* Filters Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Search</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search reference, appellant, or reason…"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Decision Outcome</label>
            <select
              value={filters.decision || ""}
              onChange={(e) => updateFilters({ decision: e.target.value || undefined })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">All Decisions</option>
              <option value="PENDING">Pending Decision</option>
              <option value="APPROVED">Approved</option>
              <option value="PARTIALLY_APPROVED">Partially Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Assigned Reviewer</label>
            <select
              value={filters.assignedReviewerId || ""}
              onChange={(e) => updateFilters({ assignedReviewerId: e.target.value || undefined })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="">All Reviewers</option>
              {moderators.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.name || mod.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Sort By</label>
            <select
              value={filters.sort || "newest"}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="newest">Newest Submission</option>
              <option value="oldest">Oldest Submission</option>
              <option value="deadline">Approaching Deadline</option>
            </select>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Appeals Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Appeal / Case</th>
                <th className="px-4 py-3 font-semibold">Appellant</th>
                <th className="px-4 py-3 font-semibold">Policy / Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3 font-semibold">Reviewer</th>
                <th className="px-4 py-3 font-semibold">Submitted</th>
                <th className="px-4 py-3 font-semibold">Deadline</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((appeal) => (
                <tr key={appeal.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-indigo-700">{appeal.id}</p>
                    <Link
                      href={`/admin/moderation/cases/${appeal.caseId}`}
                      className="text-xs text-slate-500 hover:text-indigo-600 hover:underline"
                    >
                      {appeal.caseReference} ({appeal.targetType})
                    </Link>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {appeal.appellantName || appeal.appellantEmail || "User"}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {appeal.appellantRole}
                      </span>
                    </div>
                    {appeal.appellantEmail && (
                      <p className="text-xs text-slate-400">{appeal.appellantEmail}</p>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{appeal.reason.replaceAll("_", " ")}</p>
                    <p className="max-w-44 truncate text-xs text-slate-500">
                      {appeal.policyName || appeal.policyCode || "Policy violation"}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(appeal.status)}`}>
                      {appeal.status.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getDecisionBadge(appeal.decision)}`}>
                      {appeal.decision.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {appeal.assignedReviewerName || (
                      <span className="text-xs italic text-slate-400">Unassigned</span>
                    )}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                    {formatDate(appeal.createdAt)}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                    {formatDate(appeal.deadlineAt)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenReview(appeal)}
                      className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}

              {!items.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                    {loading ? "Loading appeals…" : "No moderation appeals match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            {loading ? "Refreshing…" : `${pagination.total} appeal${pagination.total === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center gap-3">
            <select
              aria-label="Appeals per page"
              value={filters.limit || "20"}
              onChange={(e) => updateFilters({ limit: e.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
            <AdminPagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              itemLabel="appeals"
              onPageChange={(page) => void load(page)}
            />
          </div>
        </div>
      </section>

      {/* Appeal Review & Decision Modal */}
      {decisionModalOpen && selectedAppeal && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          onClick={() => setDecisionModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 overflow-y-auto"
        >
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Review Appeal: {selectedAppeal.id}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Case:{" "}
                    <Link
                      href={`/admin/moderation/cases/${selectedAppeal.caseId}`}
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      {selectedAppeal.caseReference}
                    </Link>{" "}
                    ({selectedAppeal.targetType})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDecisionModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Appellant & Appeal Info */}
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                  <div>
                    <span className="text-slate-500">Appellant:</span>
                    <p className="font-semibold text-slate-900">
                      {selectedAppeal.appellantName || selectedAppeal.appellantEmail || "User"} (
                      {selectedAppeal.appellantRole})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Appeal Reason:</span>
                    <p className="font-semibold text-slate-900">
                      {selectedAppeal.reason.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Policy:</span>
                    <p className="font-semibold text-slate-900">
                      {selectedAppeal.policyName || selectedAppeal.policyCode || "Standard policy"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Submission Date:</span>
                    <p className="font-semibold text-slate-900">
                      {formatDate(selectedAppeal.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Appellant Statement &amp; Explanation
                  </label>
                  <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {selectedAppeal.explanation}
                  </div>
                </div>

                {/* Attached Evidence */}
                {selectedAppeal.evidenceIds && selectedAppeal.evidenceIds.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Attached Evidence ({selectedAppeal.evidenceIds.length})
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {selectedAppeal.evidenceIds.map((evidenceId) => (
                        <a
                          key={evidenceId}
                          href={`/api/v1/moderation/cases/${selectedAppeal.caseId}/evidence/${evidenceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                        >
                          📎 View File ({evidenceId})
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviewer Assignment */}
                <div className="rounded-lg border border-slate-200 p-3 bg-white">
                  <label className="text-xs font-semibold text-slate-700">Assign Reviewer</label>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={selectedAppeal.assignedReviewerId || ""}
                      onChange={(e) => handleAssignReviewer(e.target.value || null)}
                      disabled={isAssigning}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-slate-500 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {moderators.map((mod) => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name || mod.email}
                        </option>
                      ))}
                    </select>
                    {isAssigning && <span className="text-xs text-slate-400">Saving…</span>}
                  </div>
                  {assignError && <p className="mt-1 text-xs text-red-600">{assignError}</p>}
                </div>

                {/* If already decided */}
                {selectedAppeal.status === "DECIDED" ? (
                  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
                      Appeal Decision Recorded
                    </p>
                    <p className="mt-1 text-sm font-semibold text-purple-900">
                      Outcome: {selectedAppeal.decision}
                    </p>
                    {selectedAppeal.decisionReason && (
                      <p className="mt-1 text-xs text-purple-800">
                        Reason: {selectedAppeal.decisionReason}
                      </p>
                    )}
                    {selectedAppeal.decidedAt && (
                      <p className="mt-1 text-[11px] text-purple-600">
                        Decided at: {formatDate(selectedAppeal.decidedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Decision Form */
                  <form onSubmit={handleSubmitDecision} className="space-y-4 border-t border-slate-200 pt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Decision Outcome *
                      </label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setDecision("APPROVED")}
                          className={`rounded-lg border p-2.5 text-xs font-semibold transition ${
                            decision === "APPROVED"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          ✓ Approve Appeal
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecision("PARTIALLY_APPROVED")}
                          className={`rounded-lg border p-2.5 text-xs font-semibold transition ${
                            decision === "PARTIALLY_APPROVED"
                              ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          ◑ Partially Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecision("REJECTED")}
                          className={`rounded-lg border p-2.5 text-xs font-semibold transition ${
                            decision === "REJECTED"
                              ? "border-red-600 bg-red-50 text-red-800 ring-2 ring-red-500"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          ✕ Reject Appeal
                        </button>
                      </div>
                    </div>

                    {(decision === "APPROVED" || decision === "PARTIALLY_APPROVED") && (
                      <div className="space-y-2 rounded-lg bg-emerald-50/60 p-3 border border-emerald-200">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-emerald-950">
                          <input
                            type="checkbox"
                            checked={reinstateContent}
                            onChange={(e) => setReinstateContent(e.target.checked)}
                            className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Reinstate content (restore review/listing/photo)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-emerald-950">
                          <input
                            type="checkbox"
                            checked={reopenCase}
                            onChange={(e) => setReopenCase(e.target.checked)}
                            className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Reopen moderation case for further review</span>
                        </label>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Decision Explanation (Shared with appellant) *
                      </label>
                      <textarea
                        rows={3}
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        placeholder="Explain the justification for this appeal decision clearly…"
                        className="mt-1 w-full rounded-md border border-slate-300 p-2.5 text-sm focus:border-slate-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Internal Review Notes (Admin only, optional)
                      </label>
                      <textarea
                        rows={2}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Internal notes regarding evidence verification, policy interpretation…"
                        className="mt-1 w-full rounded-md border border-slate-300 p-2.5 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </div>

                    {decisionError && (
                      <p className="text-xs text-red-600">{decisionError}</p>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setDecisionModalOpen(false)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingDecision}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {isSubmittingDecision ? "Recording Decision…" : "Record Decision"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </main>
  );
}

