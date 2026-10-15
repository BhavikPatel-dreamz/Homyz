"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";

interface ModerationReportItem {
  id: string;
  caseId: string;
  targetType: string;
  targetId: string;
  category: string;
  reasonCode: string;
  description: string | null;
  relatedBookingId: string | null;
  createdAt: string;
  case?: {
    id?: string;
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

  const [selectedRfiReport, setSelectedRfiReport] = useState<ModerationReportItem | null>(null);
  const [uploadEvidenceReport, setUploadEvidenceReport] = useState<ModerationReportItem | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState<{ id: string; caseId: string; displayName: string; mimeType?: string } | null>(null);
  const [expandedCaseEvidence, setExpandedCaseEvidence] = useState<Record<string, any[]>>({});
  const [loadingEvidenceCaseIds, setLoadingEvidenceCaseIds] = useState<Set<string>>(new Set());
  const [selectedAppealReport, setSelectedAppealReport] = useState<ModerationReportItem | null>(null);
  const [appealsByCaseId, setAppealsByCaseId] = useState<Record<string, any[]>>({});
  const [withdrawingAppealId, setWithdrawingAppealId] = useState<string | null>(null);
  const [enforcementStatus, setEnforcementStatus] = useState<any | null>(null);

  const fetchEnforcementStatus = async () => {
    try {
      const res = await fetch("/api/v1/moderation/me/enforcement", { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setEnforcementStatus(payload.data || null);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  const fetchAppealsForCase = async (caseId: string) => {
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/appeals`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setAppealsByCaseId((prev) => ({ ...prev, [caseId]: payload.data || [] }));
      }
    } catch {
      // Ignore background fetch error
    }
  };

  const handleWithdrawAppeal = async (caseId: string, appealId: string) => {
    if (!window.confirm("Are you sure you want to withdraw this appeal?")) return;
    setWithdrawingAppealId(appealId);
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/appeals/${appealId}/withdraw`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchAppealsForCase(caseId);
      }
    } catch {
      window.alert("Failed to withdraw appeal.");
    } finally {
      setWithdrawingAppealId(null);
    }
  };

  const loadReports = (page = 1) => {
    setLoading(true);
    setError(null);
    fetch(`/api/v1/moderation/reports?page=${page}&limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load reports");
        return res.json();
      })
      .then((data) => {
        const items = data.data || [];
        setReports(items);
        if (data.pagination) setPagination(data.pagination);
        items.forEach((item: ModerationReportItem) => {
          const cid = item.case?.id || item.caseId;
          if (cid) void fetchAppealsForCase(cid);
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error loading reports");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const toggleEvidence = async (caseId: string) => {
    if (expandedCaseEvidence[caseId]) {
      // Toggle off
      setExpandedCaseEvidence((prev) => {
        const next = { ...prev };
        delete next[caseId];
        return next;
      });
      return;
    }

    setLoadingEvidenceCaseIds((prev) => new Set(prev).add(caseId));
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/evidence`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setExpandedCaseEvidence((prev) => ({ ...prev, [caseId]: payload.data || [] }));
      }
    } catch {
      // Ignore error
    } finally {
      setLoadingEvidenceCaseIds((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    }
  };

  useEffect(() => {
    loadReports(1);
    void fetchEnforcementStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reports &amp; Disputes</h2>
          <p className="mt-1 text-xs text-slate-500">
            Track your review-removal requests, content policy reports, and submit supporting evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadReports(pagination.page);
            void fetchEnforcementStatus();
          }}
          disabled={loading || isPending}
          className="self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh Status"}
        </button>
      </div>

      {/* TRUST & SAFETY ENFORCEMENT NOTICES */}
      {enforcementStatus?.isSuspended && (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-5 shadow-sm text-xs text-red-950 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-red-600 text-white font-bold text-xs">!</span>
            <h3 className="text-sm font-bold text-red-900">Account Access Suspended</h3>
          </div>
          <p className="leading-relaxed">
            Your account has been suspended by Trust &amp; Safety due to confirmed policy violations.
            {enforcementStatus.suspension?.reason ? ` Reason: "${enforcementStatus.suspension.reason}"` : ""}
          </p>
          <p className="text-red-800">
            While suspended, you cannot book stays, publish listings, or send messages. If you believe this action was taken in error, you may file an appeal through an eligible moderation report below or contact support.
          </p>
        </div>
      )}

      {enforcementStatus?.activeRestrictions?.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm text-xs text-amber-950 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-xs">!</span>
            <h3 className="text-sm font-bold text-amber-900">Active Account Restrictions</h3>
          </div>
          <p className="leading-relaxed text-amber-800">
            Our moderation team has placed temporary restrictions on specific features of your account:
          </p>
          <div className="space-y-1.5">
            {enforcementStatus.activeRestrictions.map((rst: any) => {
              const scopeLabel = rst.type.replace("RESTRICT_", "").toLowerCase().replace(/_/g, " ");
              const expiry = rst.expiresAt ? `Until ${new Date(rst.expiresAt).toLocaleDateString()}` : "Indefinite";
              return (
                <div key={rst.id} className="rounded-lg bg-white/80 p-2.5 border border-amber-200 flex flex-wrap items-center justify-between gap-1">
                  <span className="font-semibold text-slate-800 capitalize">{scopeLabel} Restricted</span>
                  <span className="text-amber-800 font-medium">{expiry}</span>
                  <p className="w-full text-slate-600 text-[11px] mt-0.5">Reason: {rst.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {enforcementStatus?.activeWarnings?.length > 0 && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50/80 p-4 text-xs text-yellow-950 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-yellow-800">⚠️ Account Warning on Record</span>
          </div>
          <div className="space-y-1">
            {enforcementStatus.activeWarnings.map((w: any) => (
              <p key={w.id} className="text-yellow-900">
                • {w.reason} <span className="text-yellow-700 text-[11px]">({new Date(w.issuedAt).toLocaleDateString()})</span>
              </p>
            ))}
          </div>
        </div>
      )}

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
            const caseId = report.case?.id || report.caseId;
            const statusInfo = getStatusBadge(report.case?.status || "NEW");
            const isActionRequired = report.case?.status === "NEEDS_INFORMATION";
            const isClosed = report.case?.status === "RESOLVED" || report.case?.status === "DISMISSED";
            const evidenceList = expandedCaseEvidence[caseId];
            const isLoadingEvidence = loadingEvidenceCaseIds.has(caseId);

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

                {/* RFI ACTION REQUIRED CALLOUT */}
                {isActionRequired && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-amber-950 text-sm">Action Required: Information Requested</p>
                        <p className="mt-0.5 text-amber-800">
                          Our Trust &amp; Safety team has requested additional information or evidence from you to proceed with this investigation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedRfiReport(report)}
                        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-amber-700 transition-colors"
                      >
                        View Request &amp; Respond →
                      </button>
                    </div>
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

                {/* APPEALS SECTION FOR CLIENT / HOST */}
                {(() => {
                  const caseAppeals = appealsByCaseId[caseId] || [];

                  if (caseAppeals.length > 0) {
                    return (
                      <div className="mt-3 space-y-2 rounded-xl bg-purple-50/60 border border-purple-200 p-3.5 text-xs text-purple-950">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-purple-900">Moderation Appeal Status</p>
                          <span className="font-mono text-[11px] text-purple-600">{caseAppeals[0].id}</span>
                        </div>
                        {caseAppeals.map((appeal: any) => (
                          <div key={appeal.id} className="rounded-lg bg-white p-3 border border-purple-100 shadow-2xs space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="font-medium text-slate-800">
                                Reason: {appeal.reason.replaceAll("_", " ")}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                appeal.status === "SUBMITTED"
                                  ? "bg-amber-100 text-amber-800"
                                  : appeal.status === "UNDER_REVIEW"
                                  ? "bg-blue-100 text-blue-800"
                                  : appeal.status === "DECIDED"
                                  ? appeal.decision === "APPROVED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}>
                                {appeal.status === "DECIDED" ? `Decision: ${appeal.decision}` : appeal.status.replaceAll("_", " ")}
                              </span>
                            </div>

                            <p className="text-slate-600 italic whitespace-pre-wrap">{appeal.explanation}</p>

                            {appeal.status === "DECIDED" && appeal.decisionReason && (
                              <div className="rounded bg-purple-50 p-2 text-purple-900 border border-purple-100 font-medium">
                                Decision Rationale: {appeal.decisionReason}
                              </div>
                            )}

                            {(appeal.status === "SUBMITTED" || appeal.status === "UNDER_REVIEW") && (
                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  disabled={withdrawingAppealId === appeal.id}
                                  onClick={() => handleWithdrawAppeal(caseId, appeal.id)}
                                  className="text-[11px] text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                                >
                                  {withdrawingAppealId === appeal.id ? "Withdrawing..." : "Withdraw Appeal"}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (isClosed) {
                    return (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                        <span className="text-slate-600">Believe this moderation decision was in error?</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAppealReport(report)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
                        >
                          Appeal This Decision →
                        </button>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* EVIDENCE FOOTER */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleEvidence(caseId)}
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {isLoadingEvidence
                        ? "Loading evidence..."
                        : evidenceList
                        ? "Hide Attached Evidence"
                        : "View Attached Evidence"}
                    </button>
                  </div>

                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => setUploadEvidenceReport(report)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      + Attach Supporting File
                    </button>
                  )}
                </div>

                {/* EXPANDED EVIDENCE DRAWER */}
                {evidenceList && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-2 text-xs">
                    <p className="font-semibold text-slate-700">Attached Evidence Files ({evidenceList.length})</p>
                    {evidenceList.length === 0 ? (
                      <p className="text-slate-500">No evidence files currently attached to this case.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {evidenceList.map((ev: any) => {
                          const mime = ev.metadata?.mimeType || "";
                          const isPdf = mime === "application/pdf" || ev.displayName?.toLowerCase().endsWith(".pdf");
                          const isImage = mime.startsWith("image/");
                          const canPreview = isPdf || isImage;

                          return (
                            <div key={ev.id} className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium text-slate-900 truncate" title={ev.displayName}>
                                  📎 {ev.displayName || "Evidence file"}
                                </span>
                                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                                  {mime || "file"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                                <div className="flex items-center gap-2">
                                  {canPreview && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewEvidence({ id: ev.id, caseId, displayName: ev.displayName, mimeType: mime })}
                                      className="font-semibold text-indigo-600 hover:underline"
                                    >
                                      Preview
                                    </button>
                                  )}
                                  <a
                                    href={`/api/v1/moderation/cases/${caseId}/evidence/${ev.id}?download=true`}
                                    download
                                    className="font-medium text-slate-600 hover:underline"
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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

      {selectedRfiReport && (
        <RespondRfiDialog
          report={selectedRfiReport}
          onClose={() => setSelectedRfiReport(null)}
          onSuccess={() => {
            setSelectedRfiReport(null);
            loadReports(pagination.page);
          }}
        />
      )}

      {uploadEvidenceReport && (
        <ClientUploadEvidenceDialog
          caseId={uploadEvidenceReport.case?.id || uploadEvidenceReport.caseId}
          onClose={() => setUploadEvidenceReport(null)}
          onSuccess={() => {
            const caseId = uploadEvidenceReport.case?.id || uploadEvidenceReport.caseId;
            setUploadEvidenceReport(null);
            // Refresh evidence drawer
            void toggleEvidence(caseId);
          }}
        />
      )}

      {previewEvidence && (
        <ClientPreviewEvidenceDialog
          evidence={previewEvidence}
          onClose={() => setPreviewEvidence(null)}
        />
      )}

      {selectedAppealReport && (
        <SubmitAppealModal
          isOpen={!!selectedAppealReport}
          onClose={() => setSelectedAppealReport(null)}
          report={selectedAppealReport}
          onSuccess={async () => {
            const cid = selectedAppealReport.case?.id || selectedAppealReport.caseId;
            setSelectedAppealReport(null);
            if (cid) await fetchAppealsForCase(cid);
          }}
        />
      )}
    </div>
  );
}

function RespondRfiDialog({
  report,
  onClose,
  onSuccess,
}: {
  report: ModerationReportItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const caseId = report.case?.id || report.caseId;
  const [rfis, setRfis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState("");
  const [attachedEvidence, setAttachedEvidence] = useState<Array<{ id: string; name: string }>>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/moderation/cases/${caseId}/information-requests`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data) {
          setRfis(payload.data);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [caseId]);

  const activeRfi = rfis.find((r) => r.status === "REQUESTED") || rfis[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("displayName", file.name);
      formData.append("accessScope", "CASE_PARTICIPANTS");
      if (activeRfi) {
        formData.append("informationRequestId", activeRfi.id);
      }

      const res = await fetch(`/api/v1/moderation/cases/${caseId}/evidence`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to upload file");
      }
      setAttachedEvidence((prev) => [...prev, { id: data.data.id, name: file.name }]);
      e.target.value = "";
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeRfi) {
      setError("No active information request found.");
      return;
    }
    if (!responseText.trim() && attachedEvidence.length === 0) {
      setError("Please provide an explanation or attach supporting evidence.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/information-requests/${activeRfi.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseText: responseText.trim(),
          evidenceIds: attachedEvidence.map((e) => e.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to submit response");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit response");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="respond-rfi-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="respond-rfi-title" className="text-lg font-bold text-slate-900">
            Trust &amp; Safety Information Request
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Case Reference: <span className="font-mono font-semibold text-indigo-700">{report.case?.caseReference}</span>
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading inquiry details...</div>
        ) : !activeRfi ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No pending information request found for this report.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* INQUIRY FROM MODERATOR */}
            <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3.5 space-y-1.5">
              <p className="font-semibold text-amber-950">
                Inquiry from Moderation Team:
              </p>
              <p className="whitespace-pre-wrap text-slate-800 font-medium">
                {activeRfi.requestText}
              </p>
              {activeRfi.deadline && (
                <p className="text-[11px] text-amber-800 pt-1">
                  Response Requested By: <strong>{new Date(activeRfi.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>
                </p>
              )}
            </div>

            {/* RESPONSE TEXTAREA */}
            <div>
              <label className="block font-semibold text-slate-700">
                Your Explanation / Clarification
              </label>
              <textarea
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Provide detailed context, answers to the questions above, or clarify key facts..."
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* ATTACH EVIDENCE */}
            <div>
              <label className="block font-semibold text-slate-700">
                Attach Supporting Evidence (Images or PDF)
              </label>
              <input
                type="file"
                disabled={uploadingFile || submitting}
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileUpload}
                className="mt-1 w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Supported formats: JPEG, PNG, WebP, PDF (max 15MB each). Files are virus-scanned.
              </p>

              {uploadingFile && (
                <p className="mt-1 text-xs text-indigo-600 font-medium">Uploading and scanning file...</p>
              )}

              {attachedEvidence.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="font-semibold text-slate-700">Attached Files:</p>
                  {attachedEvidence.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 border border-slate-200 text-xs">
                      <span className="truncate text-slate-800">📎 {file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachedEvidence((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-800 font-semibold text-xs ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploadingFile}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Response"}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}

function ClientUploadEvidenceDialog({
  caseId,
  onClose,
  onSuccess,
}: {
  caseId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("displayName", file.name);
      formData.append("accessScope", "CASE_PARTICIPANTS");
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      const res = await fetch(`/api/v1/moderation/cases/${caseId}/evidence`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to upload file");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-client-evidence-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="upload-client-evidence-title" className="text-lg font-bold text-slate-900">
            Attach Supporting Evidence
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Upload receipts, photos, or documents to support your report. Files are stored securely and reviewed by moderators.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">
              Select File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              required
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Supported formats: JPEG, PNG, WebP, PDF (max 15MB).
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">
              Description / Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this file show?"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={uploading}
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function ClientPreviewEvidenceDialog({
  evidence,
  onClose,
}: {
  evidence: { id: string; caseId: string; displayName: string; mimeType?: string };
  onClose: () => void;
}) {
  const isPdf = evidence.mimeType === "application/pdf" || evidence.displayName.toLowerCase().endsWith(".pdf");
  const streamUrl = `/api/v1/moderation/cases/${evidence.caseId}/evidence/${evidence.id}`;

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-client-evidence-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="preview-client-evidence-title" className="text-sm font-semibold text-slate-900 truncate">
            {evidence.displayName}
          </h2>
          <div className="flex items-center gap-2">
            <a
              href={`${streamUrl}?download=true`}
              download
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-900/5 p-4 flex items-center justify-center">
          {isPdf ? (
            <iframe
              src={streamUrl}
              title={evidence.displayName}
              className="h-[65vh] w-full rounded border border-slate-200 bg-white"
            />
          ) : (
            <img
              src={streamUrl}
              alt={evidence.displayName}
              className="max-h-[65vh] max-w-full rounded-lg object-contain shadow"
            />
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function SubmitAppealModal({
  isOpen,
  onClose,
  report,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  report: ModerationReportItem;
  onSuccess: () => void;
}) {
  const caseId = report.case?.id || report.caseId;
  const [eligibility, setEligibility] = useState<any | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [reason, setReason] = useState("MISTAKEN_ENFORCEMENT");
  const [explanation, setExplanation] = useState("");
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingEligibility(true);
    setError(null);

    Promise.all([
      fetch(`/api/v1/moderation/cases/${caseId}/appeals/eligibility`).then((r) => r.json()),
      fetch(`/api/v1/moderation/cases/${caseId}/evidence`).then((r) => r.json()),
    ])
      .then(([eligRes, evidRes]) => {
        setEligibility(eligRes?.data || null);
        setEvidenceList(evidRes?.data || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load appeal eligibility.");
      })
      .finally(() => {
        setLoadingEligibility(false);
      });
  }, [isOpen, caseId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (explanation.trim().length < 10) {
      setError("Please provide an explanation of at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/appeals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          explanation: explanation.trim(),
          evidenceIds: selectedEvidenceIds,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to submit appeal.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit appeal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-appeal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 id="submit-appeal-title" className="text-lg font-bold text-slate-900">
              Appeal Moderation Decision
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Case Reference: <span className="font-mono font-semibold text-indigo-700">{report.case?.caseReference}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {loadingEligibility ? (
          <div className="py-8 text-center text-xs text-slate-500">Checking appeal eligibility…</div>
        ) : eligibility && !eligibility.eligible ? (
          <div className="py-6 space-y-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
              <p className="font-bold">Not Eligible for Appeal</p>
              <p className="mt-1">{eligibility.reason || "This case is not eligible for appeal under community trust guidelines."}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {eligibility?.deadlineAt && (
              <div className="rounded-lg bg-blue-50/70 p-2.5 border border-blue-200 text-blue-900 text-[11px]">
                ℹ️ Appeal Deadline: <strong>{new Date(eligibility.deadlineAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Appeal *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
              >
                <option value="MISTAKEN_ENFORCEMENT">Mistaken enforcement / false positive</option>
                <option value="NEW_EVIDENCE">New supporting facts or evidence</option>
                <option value="POLICY_MISINTERPRETATION">Policy misinterpreted or misapplied</option>
                <option value="CONTENT_CORRECTED">Content was corrected or edited</option>
                <option value="OTHER">Other justification</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Explanation &amp; Statement *
              </label>
              <textarea
                required
                rows={4}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Clearly state why this decision should be reviewed or reconsidered (minimum 10 characters)..."
                className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
              />
            </div>

            {evidenceList.length > 0 && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Attach Case Evidence Files (Optional)
                </label>
                <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 max-h-32 overflow-y-auto">
                  {evidenceList.map((ev: any) => (
                    <label key={ev.id} className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedEvidenceIds.includes(ev.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvidenceIds((prev) => [...prev, ev.id]);
                          } else {
                            setSelectedEvidenceIds((prev) => prev.filter((id) => id !== ev.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span className="truncate">{ev.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || explanation.trim().length < 10}
                className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? "Submitting Appeal..." : "Submit Appeal"}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}


