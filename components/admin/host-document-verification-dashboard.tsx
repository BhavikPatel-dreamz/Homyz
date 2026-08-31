"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { Alert } from "../ui";

export interface DocumentVerificationItem {
  id: string;
  requestId: string;
  applicantName: string;
  applicantEmail: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  uploadedAt: string;
  expiryDate: string | null;
  rejectionReason?: string | null;
  resubmissionRequested?: boolean;
}

const STANDARD_REJECTION_REASONS = [
  "Invalid document",
  "Unreadable document",
  "Information mismatch",
  "Expired document",
  "Wrong document type",
];

export function HostDocumentVerificationDashboard() {
  const [documents, setDocuments] = useState<DocumentVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Modals
  const [previewDoc, setPreviewDoc] = useState<DocumentVerificationItem | null>(null);
  const [targetDoc, setTargetDoc] = useState<DocumentVerificationItem | null>(null);
  
  // Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReasonSelect, setRejectionReasonSelect] = useState(STANDARD_REJECTION_REASONS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState("");

  // Resubmit Modal State
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitInstructions, setResubmitInstructions] = useState("");

  // Fetch documents from API
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch registration requests to aggregate document lists
      const res = await fetch("/api/v1/admin/hosts/registration-requests?pageSize=100");
      if (!res.ok) {
        throw new Error("Failed to fetch host registration data");
      }
      const data = await res.json();
      
      const docsList: DocumentVerificationItem[] = [];
      const requests = data.requests || [];

      // Fetch details for requests to aggregate documents
      await Promise.all(
        requests.slice(0, 20).map(async (req: any) => {
          try {
            const detailRes = await fetch(`/api/v1/admin/hosts/registration-requests/${req.id}`);
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.request?.documents) {
                detailData.request.documents.forEach((doc: any) => {
                  docsList.push({
                    id: doc.id,
                    requestId: req.id,
                    applicantName: req.applicantName,
                    applicantEmail: req.applicantEmail,
                    documentType: doc.documentType,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    mimeType: doc.mimeType,
                    fileSize: doc.fileSize,
                    status: doc.status,
                    uploadedAt: doc.uploadedAt,
                    expiryDate: doc.expiryDate,
                    rejectionReason: doc.rejectionReason,
                    resubmissionRequested: doc.resubmissionRequested,
                  });
                });
              }
            }
          } catch (e) {
            // ignore individual fetch errors
          }
        })
      );

      setDocuments(docsList);
    } catch (err: any) {
      setError(err.message || "Failed to load document verification queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle Verify Document
  async function handleVerify(doc: DocumentVerificationItem) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${doc.requestId}/documents/${doc.id}/verify`,
          { method: "POST" }
        );
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to verify document");
        }
        setFeedback({ tone: "success", msg: `Document '${doc.fileName}' verified successfully!` });
        fetchDocuments();
      } catch (err: any) {
        setFeedback({ tone: "error", msg: err.message });
      }
    });
  }

  // Handle Reject Document
  async function handleConfirmReject() {
    if (!targetDoc) return;
    const finalReason = customRejectionReason.trim() || rejectionReasonSelect;
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${targetDoc.requestId}/documents/${targetDoc.id}/reject`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: finalReason }),
          }
        );
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to reject document");
        }
        setFeedback({ tone: "success", msg: `Document '${targetDoc.fileName}' rejected.` });
        setRejectModalOpen(false);
        setTargetDoc(null);
        setCustomRejectionReason("");
        fetchDocuments();
      } catch (err: any) {
        setFeedback({ tone: "error", msg: err.message });
      }
    });
  }

  // Handle Request Resubmission
  async function handleConfirmResubmit() {
    if (!targetDoc) return;
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${targetDoc.requestId}/documents/${targetDoc.id}/request-resubmission`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instructions: resubmitInstructions }),
          }
        );
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to request document resubmission");
        }
        setFeedback({ tone: "success", msg: `Resubmission requested for '${targetDoc.fileName}'.` });
        setResubmitModalOpen(false);
        setTargetDoc(null);
        setResubmitInstructions("");
        fetchDocuments();
      } catch (err: any) {
        setFeedback({ tone: "error", msg: err.message });
      }
    });
  }

  // Statistics
  const totalCount = documents.length;
  const pendingCount = documents.filter((d) => d.status === "PENDING").length;
  const verifiedCount = documents.filter((d) => d.status === "VERIFIED").length;
  const rejectedCount = documents.filter((d) => d.status === "REJECTED").length;
  const expiredCount = documents.filter((d) => d.status === "EXPIRED").length;

  // Filtered documents
  const filtered = documents.filter((d) => {
    const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
    const matchesType = typeFilter === "ALL" || d.documentType === typeFilter;
    const matchesSearch =
      !search.trim() ||
      d.applicantName.toLowerCase().includes(search.toLowerCase()) ||
      d.applicantEmail.toLowerCase().includes(search.toLowerCase()) ||
      d.fileName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Document Verification Workspace
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Review, inspect, verify, or request resubmission for host onboarding compliance documentation.
          </p>
        </div>
      </div>

      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
            Total Queue
          </span>
          <p className="text-2xl font-black mt-1 text-[var(--foreground)]">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            Pending Review
          </span>
          <p className="text-2xl font-black mt-1 text-amber-900 dark:text-amber-200">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            Verified
          </span>
          <p className="text-2xl font-black mt-1 text-emerald-900 dark:text-emerald-200">{verifiedCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-300/60 bg-rose-50/50 dark:bg-rose-950/30 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            Rejected
          </span>
          <p className="text-2xl font-black mt-1 text-rose-900 dark:text-rose-200">{rejectedCount}</p>
        </div>
        <div className="rounded-2xl border border-purple-300/60 bg-purple-50/50 dark:bg-purple-950/30 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
            Expired
          </span>
          <p className="text-2xl font-black mt-1 text-purple-900 dark:text-purple-200">{expiredCount}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search host name, email or file name..."
            className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-1.5 px-4 text-xs outline-none focus:border-[var(--accent)] min-w-[200px]"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-1.5 px-3 text-xs outline-none focus:border-[var(--accent)]"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="VERIFIED">Verified</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-1.5 px-3 text-xs outline-none focus:border-[var(--accent)]"
          >
            <option value="ALL">All Document Types</option>
            <option value="GOVERNMENT_ID">Government ID</option>
            <option value="PROOF_OF_ADDRESS">Proof of Address</option>
            <option value="BUSINESS_LICENSE">Business License</option>
            <option value="PROPERTY_DEED">Property Deed</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
            Loading document verification queue...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--muted-foreground)]">
            No document verification requests matching your criteria.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-secondary)] text-[var(--muted-foreground)] uppercase tracking-wider font-extrabold border-b border-[var(--border-subtle)] text-[10px]">
              <tr>
                <th className="py-3 px-4">Applicant Host</th>
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">File Details</th>
                <th className="py-3 px-4">Uploaded / Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/admin/hosts/onboarding/registration-requests/${doc.requestId}`}
                      className="font-bold text-[var(--foreground)] hover:text-[var(--accent)] underline"
                    >
                      {doc.applicantName}
                    </Link>
                    <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{doc.applicantEmail}</p>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border-subtle)]">
                      {doc.documentType.replace("_", " ")}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[var(--foreground)] truncate max-w-[180px] inline-block">
                      {doc.fileName}
                    </span>
                    {doc.fileSize && (
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">
                    <div>Up: {new Date(doc.uploadedAt).toLocaleDateString()}</div>
                    {doc.expiryDate && (
                      <div className="text-[10px]">Exp: {new Date(doc.expiryDate).toLocaleDateString()}</div>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${
                        doc.status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : doc.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
                          : doc.status === "EXPIRED"
                          ? "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {doc.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
                      >
                        Preview
                      </button>

                      {doc.status !== "VERIFIED" && (
                        <button
                          type="button"
                          onClick={() => handleVerify(doc)}
                          disabled={pendingTransition}
                          className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[11px] font-extrabold transition-all shadow-2xs disabled:opacity-50"
                        >
                          Verify
                        </button>
                      )}

                      {doc.status !== "REJECTED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetDoc(doc);
                            setRejectModalOpen(true);
                          }}
                          disabled={pendingTransition}
                          className="rounded-full border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-100 transition-all shadow-2xs disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setTargetDoc(doc);
                          setResubmitModalOpen(true);
                        }}
                        disabled={pendingTransition}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] px-2.5 py-1 text-[11px] font-bold hover:opacity-80 transition-all shadow-2xs disabled:opacity-50"
                      >
                        Request Resubmit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PREVIEW DOCUMENT MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Preview: {previewDoc.fileName}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Applicant: <strong>{previewDoc.applicantName}</strong> ({previewDoc.applicantEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-xs font-bold px-3 py-1 rounded-full border border-[var(--border)] hover:bg-[var(--surface-secondary)]"
              >
                Close
              </button>
            </div>

            <div className="min-h-[300px] flex items-center justify-center bg-zinc-900 rounded-xl p-4 text-center">
              {previewDoc.mimeType?.startsWith("image/") || previewDoc.fileUrl.match(/\.(jpeg|jpg|png|webp|gif)$/i) ? (
                <img
                  src={previewDoc.fileUrl}
                  alt={previewDoc.fileName}
                  className="max-h-[500px] object-contain rounded-lg shadow-md"
                />
              ) : (
                <div className="text-zinc-300 text-xs space-y-3">
                  <p>📄 Document Format: <strong>{previewDoc.mimeType || "PDF/Binary"}</strong></p>
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-4 py-2 font-bold shadow-2xs hover:opacity-90"
                  >
                    Open Document in New Tab ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen && targetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-base font-bold">Reject Document: {targetDoc.fileName}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Specify the reason why this document is being rejected.
            </p>

            <div>
              <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1">Standard Reason</label>
              <select
                value={rejectionReasonSelect}
                onChange={(e) => setRejectionReasonSelect(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs outline-none"
              >
                {STANDARD_REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1">Custom Note (Optional)</label>
              <textarea
                rows={2}
                value={customRejectionReason}
                onChange={(e) => setCustomRejectionReason(e.target.value)}
                placeholder="Additional details for host..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={pendingTransition}
                className="rounded-full bg-rose-600 text-white px-5 py-2 font-extrabold hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST RESUBMISSION MODAL */}
      {resubmitModalOpen && targetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-base font-bold">Request Resubmission: {targetDoc.fileName}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Send detailed instructions to the applicant for uploading an updated version of this document.
            </p>

            <div>
              <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1">Resubmission Instructions</label>
              <textarea
                rows={3}
                value={resubmitInstructions}
                onChange={(e) => setResubmitInstructions(e.target.value)}
                placeholder="Explain what needs to be fixed..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-2.5 text-xs outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="rounded-full border border-[var(--border)] px-4 py-2 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResubmit}
                disabled={pendingTransition}
                className="rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-5 py-2 font-extrabold hover:opacity-90 disabled:opacity-50"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
