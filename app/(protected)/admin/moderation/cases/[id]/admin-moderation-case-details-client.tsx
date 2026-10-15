"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma detail payload has target-specific shapes. */

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type Details = any;
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | Date | null | undefined) { return value ? dateTime.format(new Date(value)) : "—"; }
function title(value: string) { return value.replaceAll("_", " "); }
function badge(value: string) { return value === "RESOLVED" ? "bg-emerald-100 text-emerald-800" : value === "DISMISSED" ? "bg-slate-200 text-slate-700" : value === "CRITICAL" ? "bg-red-100 text-red-800" : value === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"; }

export function AdminModerationCaseDetailsClient({
  initialDetails,
  canUpdate,
  canAssign,
  canDecide,
  canEnforce = false,
}: {
  initialDetails: Details;
  canUpdate: boolean;
  canAssign: boolean;
  canDecide: boolean;
  canEnforce?: boolean;
}) {
  const router = useRouter(); const [details, setDetails] = useState(initialDetails); const caseRecord = details.case;
  const [moderators, setModerators] = useState<any[]>([]); const [note, setNote] = useState(""); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ status: string; resolutionCategory?: string; resolutionNotes?: string } | null>(null);
  const [rfis, setRfis] = useState<any[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState<any | null>(null);
  const [rfiModalOpen, setRfiModalOpen] = useState(false);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealDecisionModal, setAppealDecisionModal] = useState<any | null>(null);
  const [appealDecision, setAppealDecision] = useState<"APPROVED" | "REJECTED" | "PARTIALLY_APPROVED">("APPROVED");
  const [appealDecisionReason, setAppealDecisionReason] = useState("");
  const [appealReviewNotes, setAppealReviewNotes] = useState("");
  const [appealReinstateContent, setAppealReinstateContent] = useState(true);
  const [appealReopenCase, setAppealReopenCase] = useState(true);
  const [submittingAppealDecision, setSubmittingAppealDecision] = useState(false);
  const [appealDecisionError, setAppealDecisionError] = useState<string | null>(null);

  // Phase 6 Enforcement State
  const [enforcementModal, setEnforcementModal] = useState<{ action: "WARN" | "RESTRICT" | "SUSPEND"; targetUser: any } | null>(null);
  const [bookingImpactModal, setBookingImpactModal] = useState<any | null>(null);
  const [violationHistoryModal, setViolationHistoryModal] = useState<any | null>(null);
  const [messageContext, setMessageContext] = useState<any | null>(null);
  const [loadingMessageContext, setLoadingMessageContext] = useState(false);
  const [messageEnforcementModal, setMessageEnforcementModal] = useState<{ messageId: string; action: "HIDE" | "REMOVE" | "RESTORE" } | null>(null);

  const fetchRfis = async () => {
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseRecord.id}/information-requests`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setRfis(payload.data || []);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  const fetchAppeals = async () => {
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseRecord.id}/appeals`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setAppeals(payload.data || []);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  const fetchMessageContext = async () => {
    if (caseRecord.targetType !== "MESSAGE") return;
    setLoadingMessageContext(true);
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseRecord.id}/message-context`, { cache: "no-store" });
      if (res.ok) {
        const payload = await res.json();
        setMessageContext(payload.data || null);
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setLoadingMessageContext(false);
    }
  };

  useEffect(() => {
    if (!canAssign) return;
    fetch("/api/v1/admin/moderation/moderators").then(async (response) => response.ok ? response.json() : null).then((payload) => payload && setModerators(payload.data || [])).catch(() => undefined);
  }, [canAssign]);

  useEffect(() => {
    void fetchRfis();
    void fetchAppeals();
    if (caseRecord.targetType === "MESSAGE") void fetchMessageContext();
  }, [caseRecord.id, caseRecord.targetType]);

  const refresh = async () => {
    const response = await fetch(`/api/v1/admin/moderation/cases/${caseRecord.id}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || "Could not refresh the case.");
    setDetails(payload.data);
    await Promise.all([
      fetchRfis(),
      fetchAppeals(),
      caseRecord.targetType === "MESSAGE" ? fetchMessageContext() : Promise.resolve(),
    ]);
    router.refresh();
  };


  const update = async (input: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/moderation/cases/${caseRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, expectedUpdatedAt: new Date(caseRecord.updatedAt).toISOString() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to update the case.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the case.");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const addNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/moderation/cases/${caseRecord.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to add note.");
      setNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add note.");
    } finally {
      setSaving(false);
    }
  };

  const target = details.target?.data;
  const closed = ["RESOLVED", "DISMISSED"].includes(caseRecord.status);

  // Compile known participants for RFI targeting
  const candidates: Array<{ id: string; name: string; label: string }> = [];
  const seenIds = new Set<string>();
  for (const report of caseRecord.reports || []) {
    if (report.reporter && !seenIds.has(report.reporter.id)) {
      seenIds.add(report.reporter.id);
      candidates.push({
        id: report.reporter.id,
        name: report.reporter.name || report.reporter.email || "Reporter",
        label: `Reporter: ${report.reporter.name || report.reporter.email} (${report.reporter.role || "User"})`,
      });
    }
    if (report.relatedBooking?.guest && !seenIds.has(report.relatedBooking.guest.id)) {
      seenIds.add(report.relatedBooking.guest.id);
      candidates.push({
        id: report.relatedBooking.guest.id,
        name: report.relatedBooking.guest.name || report.relatedBooking.guest.email || "Guest",
        label: `Booking Guest: ${report.relatedBooking.guest.name || report.relatedBooking.guest.email}`,
      });
    }
    if (report.relatedBooking?.listing?.host && !seenIds.has(report.relatedBooking.listing.host.id)) {
      seenIds.add(report.relatedBooking.listing.host.id);
      candidates.push({
        id: report.relatedBooking.listing.host.id,
        name: report.relatedBooking.listing.host.name || report.relatedBooking.listing.host.email || "Host",
        label: `Booking Host: ${report.relatedBooking.listing.host.name || report.relatedBooking.listing.host.email}`,
      });
    }
  }
  if (target) {
    if ((caseRecord.targetType === "USER" || caseRecord.targetType === "PROFILE") && target.id && !seenIds.has(target.id)) {
      seenIds.add(target.id);
      candidates.unshift({
        id: target.id,
        name: target.name || target.email || "Target User",
        label: `Target User: ${target.name || target.email}`,
      });
    }
    if (caseRecord.targetType === "MESSAGE" && target.sender?.id && !seenIds.has(target.sender.id)) {
      seenIds.add(target.sender.id);
      candidates.unshift({
        id: target.sender.id,
        name: target.sender.name || target.sender.email || "Message Sender",
        label: `Message Sender: ${target.sender.name || target.sender.email}`,
      });
    }
    if (target.host && !seenIds.has(target.host.id)) {
      seenIds.add(target.host.id);
      candidates.unshift({
        id: target.host.id,
        name: target.host.name || target.host.email || "Host",
        label: `Listing Host: ${target.host.name || target.host.email}`,
      });
    }
    if (target.author && !seenIds.has(target.author.id)) {
      seenIds.add(target.author.id);
      candidates.unshift({
        id: target.author.id,
        name: target.author.name || target.author.email || "Author",
        label: `Review Author: ${target.author.name || target.author.email}`,
      });
    }
    if (target.targetUser && !seenIds.has(target.targetUser.id)) {
      seenIds.add(target.targetUser.id);
      candidates.push({
        id: target.targetUser.id,
        name: target.targetUser.name || target.targetUser.email || "Subject User",
        label: `Reviewed Subject: ${target.targetUser.name || target.targetUser.email}`,
      });
    }
  }

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/moderation/cases" className="text-sm font-medium text-indigo-700 hover:underline">
            ← Moderation cases
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{caseRecord.caseReference}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Content moderation investigation · authorized enforcement actions apply only when selected.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${badge(caseRecord.status)}`}>
          {title(caseRecord.status)}
        </span>
      </div>

      {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Case summary</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Content type", title(caseRecord.targetType)],
                ["Category", caseRecord.category],
                ["Reports", String(caseRecord._count.reports)],
                ["Created", formatDate(caseRecord.createdAt)],
                ["Last activity", formatDate(caseRecord.updatedAt)],
                ["Resolved", formatDate(caseRecord.resolvedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="mt-1 font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Reported content</h2>
            {!details.target?.available ? (
              <p className="mt-3 text-sm text-slate-500">
                This content is unavailable or has been deleted. The case history is preserved.
              </p>
            ) : (
              <TargetPreview targetType={caseRecord.targetType} data={target} />
            )}
          </section>

          {caseRecord.targetType === "MESSAGE" && (
            <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Message Investigation &amp; Thread Context
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Privacy-safe bounded window (up to 3 prior and 3 subsequent messages) to assess conversational context without exposing unauthorized threads.
                  </p>
                </div>
                {canEnforce && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMessageEnforcementModal({ messageId: caseRecord.targetId, action: "HIDE" })}
                      className="rounded bg-amber-50 border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Hide Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageEnforcementModal({ messageId: caseRecord.targetId, action: "REMOVE" })}
                      className="rounded bg-red-50 border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
                    >
                      Remove Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageEnforcementModal({ messageId: caseRecord.targetId, action: "RESTORE" })}
                      className="rounded bg-slate-50 border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Restore Message
                    </button>
                  </div>
                )}
              </div>

              {loadingMessageContext ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading conversation thread context...</div>
              ) : messageContext?.boundedMessages?.length ? (
                <div className="mt-4 space-y-2.5">
                  {messageContext.boundedMessages.map((msg: any) => {
                    const isTarget = msg.isTargetMessage;
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg border p-3 text-xs transition ${
                          isTarget
                            ? "border-red-300 bg-red-50/40 ring-1 ring-red-200"
                            : "border-slate-200 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-200/50 text-[11px]">
                          <span className="font-semibold text-slate-800">
                            {msg.senderName || "User"} {msg.senderRole ? `(${msg.senderRole})` : ""}
                            {isTarget && (
                              <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                REPORTED TARGET
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400">{formatDate(msg.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap font-sans text-slate-900 leading-relaxed">
                          {msg.content}
                        </p>
                        {msg.isModerated && (
                          <div className="mt-2 rounded bg-amber-100/70 px-2 py-1 text-[11px] font-medium text-amber-900">
                            Moderated Action: <strong>{msg.moderatedAction}</strong> — Reason: {msg.moderatedReason || "Policy violation"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No surrounding messages available in this thread.
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Individual reports <span className="text-slate-500">({caseRecord.reports.length})</span>
            </h2>
            <div className="mt-4 space-y-3">
              {caseRecord.reports.map((report: any) => (
                <article key={report.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium">{report.reasonCode.replaceAll("_", " ")}</p>
                    <time className="text-slate-500">{formatDate(report.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-slate-600">{report.description || "No additional report description."}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Reporter: {report.reporter?.name || report.reporter?.email || "Unavailable"}
                    {report.relatedBooking ? ` · Booking ${report.relatedBooking.id}` : ""}
                  </p>
                </article>
              ))}
              {!caseRecord.reports.length && <p className="text-sm text-slate-500">No reports are linked to this case.</p>}
            </div>
          </section>

          {/* SECURE EVIDENCE SECTION */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Evidence <span className="text-slate-500">({caseRecord.evidence.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Private, tamper-evident case files with magic-byte signature validation and role-based access.
                </p>
              </div>
              {canUpdate && !closed && (
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  + Attach Evidence
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {caseRecord.evidence.map((evidence: any) => {
                const mime = evidence.metadata?.mimeType || "application/octet-stream";
                const sizeBytes = evidence.metadata?.fileSizeBytes;
                const formattedSize = sizeBytes
                  ? sizeBytes > 1024 * 1024
                    ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(sizeBytes / 1024)} KB`
                  : null;
                const isPdf = mime === "application/pdf" || evidence.displayName?.toLowerCase().endsWith(".pdf");
                const isImage = mime.startsWith("image/");
                const canPreview = isPdf || isImage;

                return (
                  <div
                    key={evidence.id}
                    className="rounded-lg border border-slate-200 p-3.5 text-sm bg-white hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {evidence.displayName || evidence.metadata?.originalFileName || title(evidence.evidenceType)}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700">
                          {mime}
                        </span>
                        {formattedSize && <span className="text-xs text-slate-400">({formattedSize})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            evidence.accessScope === "ADMIN_ONLY" || evidence.accessScope === "MODERATORS_ONLY"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {evidence.accessScope === "ADMIN_ONLY" || evidence.accessScope === "MODERATORS_ONLY" ? "Moderators Only" : "Case Participants"}
                        </span>
                        {evidence.metadata?.retentionHold && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
                            🔒 Retention Hold
                          </span>
                        )}
                        {evidence.storageReference === "PURGED" && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                            Purged
                          </span>
                        )}
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Verified Clean
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div>
                        <span>Submitted by </span>
                        <span className="font-medium text-slate-700">
                          {evidence.submittedBy?.name || evidence.submittedBy?.email || "Participant"}
                        </span>
                        <span> · {formatDate(evidence.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {canPreview && (
                          <button
                            type="button"
                            onClick={() => setPreviewEvidence(evidence)}
                            className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            Preview
                          </button>
                        )}
                        <a
                          href={`/api/v1/moderation/cases/${caseRecord.id}/evidence/${evidence.id}?download=true`}
                          download
                          className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>

                    {evidence.metadata?.description && (
                      <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2 border border-slate-100">
                        {evidence.metadata.description}
                      </p>
                    )}
                  </div>
                );
              })}

              {!caseRecord.evidence.length && (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  No evidence has been attached yet. Click "+ Attach Evidence" to upload case files securely.
                </div>
              )}
            </div>
          </section>

          {/* REQUESTS FOR INFORMATION (RFI) SECTION */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Requests for Information (RFI) <span className="text-slate-500">({rfis.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Request additional statements or supporting evidence from reporters, guests, or hosts.
                </p>
              </div>
              {canUpdate && !closed && (
                <button
                  type="button"
                  onClick={() => setRfiModalOpen(true)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  + Request Information
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {rfis.map((rfi: any) => {
                const isAwaiting = rfi.status === "REQUESTED";
                const isResponded = rfi.status === "RESPONDED";
                const isOverdue = rfi.deadline && new Date() > new Date(rfi.deadline) && isAwaiting;

                const recipientCandidate = candidates.find((c) => c.id === rfi.recipientId);
                const recipientLabel = recipientCandidate?.label || `User ID: ${rfi.recipientId.slice(0, 8)}...`;

                return (
                  <article
                    key={rfi.id}
                    className={`rounded-xl border p-4 text-sm transition-all ${
                      isResponded
                        ? "border-blue-300 bg-blue-50/20"
                        : isOverdue
                        ? "border-red-300 bg-red-50/20"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{rfi.subject || "Information Request"}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-600">{recipientLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                            Overdue
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            rfi.status === "RESPONDED"
                              ? "bg-blue-100 text-blue-800 font-bold"
                              : rfi.status === "REVIEWED"
                              ? "bg-purple-100 text-purple-800"
                              : rfi.status === "CLOSED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {rfi.status === "REQUESTED"
                            ? "Awaiting Response"
                            : rfi.status === "RESPONDED"
                            ? "Response Received"
                            : rfi.status === "REVIEWED"
                            ? "Reviewed"
                            : "Closed"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-4">
                      <span>Sent: {formatDate(rfi.createdAt)}</span>
                      {rfi.deadline && (
                        <span>
                          Deadline: <strong className={isOverdue ? "text-red-700" : ""}>{formatDate(rfi.deadline)}</strong>
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-800 border border-slate-100">
                      <p className="font-semibold text-slate-600">Questions / Required Details:</p>
                      <p className="mt-1 whitespace-pre-wrap">{rfi.questions}</p>
                    </div>

                    {rfi.response && (
                      <div className="mt-3 rounded-lg bg-indigo-50/60 border border-indigo-200 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-indigo-900">Participant Response:</p>
                          <time className="text-indigo-600">{formatDate(rfi.response.respondedAt)}</time>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-slate-900">{rfi.response.explanation}</p>

                        {rfi.response.evidenceIds && rfi.response.evidenceIds.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-indigo-100">
                            <p className="font-semibold text-indigo-900 mb-1">
                              Attached Evidence ({rfi.response.evidenceIds.length}):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {rfi.response.evidenceIds.map((evId: string) => {
                                const evRecord = caseRecord.evidence.find((e: any) => e.id === evId);
                                return (
                                  <button
                                    key={evId}
                                    type="button"
                                    onClick={() => evRecord && setPreviewEvidence(evRecord)}
                                    className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-200 hover:bg-indigo-50 shadow-sm"
                                  >
                                    📎 {evRecord?.displayName || `Evidence #${evId.slice(0, 8)}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {canUpdate && !closed && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2 text-xs">
                        {rfi.status === "RESPONDED" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              setSaving(true);
                              try {
                                const res = await fetch(`/api/v1/moderation/cases/${caseRecord.id}/information-requests/${rfi.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "REVIEWED" }),
                                });
                                if (!res.ok) throw new Error("Failed to update status");
                                await refresh();
                              } catch (e: any) {
                                setError(e.message);
                              } finally {
                                setSaving(false);
                              }
                            }}
                            className="rounded bg-indigo-600 px-3 py-1 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Mark as Reviewed
                          </button>
                        )}
                        {rfi.status !== "CLOSED" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              setSaving(true);
                              try {
                                const res = await fetch(`/api/v1/moderation/cases/${caseRecord.id}/information-requests/${rfi.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: "CLOSED" }),
                                });
                                if (!res.ok) throw new Error("Failed to close request");
                                await refresh();
                              } catch (e: any) {
                                setError(e.message);
                              } finally {
                                setSaving(false);
                              }
                            }}
                            className="rounded border border-slate-300 px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Close Request
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {!rfis.length && (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  No information requests have been sent for this case.
                </div>
              )}
            </div>
          </section>

          {/* APPEALS SECTION */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Moderation Appeals <span className="text-slate-500">({appeals.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Formal appeals filed by content owners or participants challenging enforcement decisions.
                </p>
              </div>
              <Link
                href="/admin/moderation/appeals"
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
              >
                View Appeals Queue →
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {appeals.map((appeal: any) => {
                const isDecided = appeal.status === "DECIDED";

                return (
                  <article
                    key={appeal.id}
                    className={`rounded-xl border p-4 text-xs transition ${
                      isDecided
                        ? "border-purple-200 bg-purple-50/20"
                        : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700">{appeal.id}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800">
                          {appeal.appellantName || appeal.appellantEmail || "Appellant"} ({appeal.appellantRole})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          appeal.status === "SUBMITTED"
                            ? "bg-amber-100 text-amber-800"
                            : appeal.status === "UNDER_REVIEW"
                            ? "bg-blue-100 text-blue-800"
                            : appeal.status === "DECIDED"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {appeal.status.replaceAll("_", " ")}
                        </span>
                        {appeal.decision !== "PENDING" && (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            appeal.decision === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : appeal.decision === "PARTIALLY_APPROVED"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {appeal.decision.replaceAll("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="text-slate-500 font-medium">Appeal Reason:</span>
                          <p className="font-semibold text-slate-900">{appeal.reason.replaceAll("_", " ")}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Policy:</span>
                          <p className="font-semibold text-slate-900">{appeal.policyName || appeal.policyCode || "Standard policy"}</p>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-medium">Appellant Statement:</span>
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white p-3 border border-slate-200 text-slate-800 font-normal leading-relaxed">
                          {appeal.explanation}
                        </p>
                      </div>

                      {appeal.evidenceIds && appeal.evidenceIds.length > 0 && (
                        <div className="pt-1">
                          <span className="text-slate-500 font-medium">Attached Evidence ({appeal.evidenceIds.length}):</span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {appeal.evidenceIds.map((eid: string) => (
                              <a
                                key={eid}
                                href={`/api/v1/moderation/cases/${caseRecord.id}/evidence/${eid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-50"
                              >
                                📎 File ({eid})
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Reviewer:</span>
                          {canAssign ? (
                            <select
                              value={appeal.assignedReviewerId || ""}
                              onChange={async (e) => {
                                const reviewerId = e.target.value || null;
                                try {
                                  await fetch(`/api/v1/moderation/cases/${caseRecord.id}/appeals/${appeal.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ reviewerId }),
                                  });
                                  await fetchAppeals();
                                } catch (err) {
                                  setError("Failed to assign appeal reviewer.");
                                }
                              }}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              <option value="">Unassigned</option>
                              {moderators.map((mod: any) => (
                                <option key={mod.id} value={mod.id}>
                                  {mod.name || mod.email}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-semibold text-slate-800">
                              {appeal.assignedReviewerName || "Unassigned"}
                            </span>
                          )}
                        </div>

                        {canDecide && !isDecided && (
                          <button
                            type="button"
                            onClick={() => {
                              setAppealDecisionModal(appeal);
                              setAppealDecision("APPROVED");
                              setAppealDecisionReason("");
                              setAppealReviewNotes("");
                              setAppealReinstateContent(true);
                              setAppealReopenCase(true);
                              setAppealDecisionError(null);
                            }}
                            className="rounded-md bg-indigo-600 px-3 py-1.5 font-semibold text-white shadow-xs hover:bg-indigo-700"
                          >
                            Decide Appeal →
                          </button>
                        )}
                      </div>

                      {isDecided && (
                        <div className="mt-2 rounded-lg bg-purple-50/70 p-3 border border-purple-200 text-xs space-y-1">
                          <p className="font-bold text-purple-950">
                            Decision Recorded: {appeal.decision}
                          </p>
                          {appeal.decisionReason && (
                            <p className="text-purple-900">Rationale: {appeal.decisionReason}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-[11px] text-purple-700 pt-1">
                            {appeal.reinstatementExecuted && <span>✓ Content Reinstated</span>}
                            {appeal.reopenCaseExecuted && <span>✓ Case Reopened</span>}
                            {appeal.decidedAt && <span>Decided: {formatDate(appeal.decidedAt)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {!appeals.length && (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  No appeals have been submitted for this case.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Investigation timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-slate-200 pl-5">
              {caseRecord.activities.map((activity: any) => (
                <li
                  key={activity.id}
                  className="relative text-sm before:absolute before:-left-[22px] before:top-1 before:size-2 before:rounded-full before:bg-slate-400"
                >
                  <p className="font-medium text-slate-900">{title(activity.action)}</p>
                  <p className="text-slate-600">
                    {activity.actor?.name || activity.actor?.email || "System"} · {formatDate(activity.createdAt)}
                  </p>
                  {activity.metadata?.note && (
                    <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-700">
                      {activity.metadata.note}
                    </p>
                  )}
                </li>
              ))}
              {!caseRecord.activities.length && <li className="text-sm text-slate-500">No activity recorded.</li>}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Investigation controls</h2>
            <div className="mt-4 space-y-4 text-sm">
              <label className="block">
                Severity
                <select
                  disabled={!canUpdate || saving}
                  value={caseRecord.severity}
                  onChange={(event) => void update({ severity: event.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                Priority
                <input
                  disabled={!canUpdate || saving}
                  type="number"
                  min="-100"
                  max="100"
                  value={caseRecord.priority}
                  onChange={(event) => void update({ priority: Number(event.target.value) })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              {canAssign && (
                <label className="block">
                  Assigned moderator
                  <select
                    disabled={saving}
                    value={caseRecord.assignedModeratorId || ""}
                    onChange={(event) => void update({ assignedModeratorId: event.target.value || null })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  >
                    <option value="">Unassigned</option>
                    {moderators.map((moderator) => (
                      <option key={moderator.id} value={moderator.id}>
                        {moderator.name || moderator.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-xs text-slate-500">
                Assigned: {caseRecord.assignedModerator?.name || caseRecord.assignedModerator?.email || "No moderator"}
              </p>
            </div>
          </section>

          {canUpdate && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Workflow</h2>
              <div className="mt-3 flex flex-col gap-2">
                {caseRecord.status === "NEW" && (
                  <ActionButton label="Start review" disabled={saving} onClick={() => void update({ status: "IN_REVIEW" })} />
                )}
                {["NEW", "IN_REVIEW", "REOPENED"].includes(caseRecord.status) && (
                  <ActionButton
                    label="Needs information"
                    disabled={saving}
                    onClick={() => void update({ status: "NEEDS_INFORMATION" })}
                  />
                )}
                {caseRecord.status === "NEEDS_INFORMATION" && (
                  <ActionButton
                    label="Resume review"
                    disabled={saving}
                    onClick={() => void update({ status: "IN_REVIEW" })}
                  />
                )}
                {!closed && (
                  <>
                    <ActionButton
                      label="Resolve case"
                      disabled={saving || !canDecide}
                      onClick={() => setConfirm({ status: "RESOLVED" })}
                    />
                    <ActionButton
                      label="Dismiss case"
                      disabled={saving || !canDecide}
                      onClick={() => setConfirm({ status: "DISMISSED" })}
                    />
                  </>
                )}
                {closed && (
                  <ActionButton label="Reopen case" disabled={saving} onClick={() => void update({ status: "REOPENED" })} />
                )}
              </div>
            </section>
          )}

          {canDecide && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Internal note</h2>
              <form onSubmit={addNote} className="mt-3 space-y-2">
                <label className="sr-only" htmlFor="moderation-note">
                  Private moderator note
                </label>
                <textarea
                  id="moderation-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={5000}
                  placeholder="Visible only to permitted moderators"
                  className="min-h-28 w-full rounded-md border border-slate-300 p-2 text-sm"
                />
                <button
                  disabled={saving || !note.trim()}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add private note
                </button>
              </form>
            </section>
          )}

          {/* ADVANCED ENFORCEMENT ACTIONS PANEL (PHASE 6) */}
          {canEnforce && (
            <section className="rounded-xl border border-rose-200 bg-rose-50/30 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-rose-950">Trust &amp; Safety Enforcement</h2>
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">AUTHORIZED</span>
              </div>
              <p className="mt-1 text-xs text-rose-800/80">
                Execute account-level or content-level enforcement linked directly to this case.
              </p>

              {candidates.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-medium text-slate-700">
                    Subject: <span className="font-semibold text-slate-900">{candidates[0].name}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEnforcementModal({ action: "WARN", targetUser: candidates[0] })}
                      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    >
                      ⚠️ Issue Account Warning
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEnforcementModal({ action: "RESTRICT", targetUser: candidates[0] })}
                      className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-left text-xs font-semibold text-orange-900 hover:bg-orange-100 disabled:opacity-50"
                    >
                      ⏳ Apply Temporary Restriction
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setEnforcementModal({ action: "SUSPEND", targetUser: candidates[0] })}
                      className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-left text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
                    >
                      🛑 Suspend User Account
                    </button>
                  </div>

                  <div className="mt-2 flex flex-col gap-1.5 border-t border-rose-200/60 pt-2">
                    <button
                      type="button"
                      onClick={() => setBookingImpactModal(candidates[0])}
                      className="text-left text-xs font-medium text-rose-900 hover:underline"
                    >
                      📊 Assess Booking &amp; Reservation Impact →
                    </button>
                    <button
                      type="button"
                      onClick={() => setViolationHistoryModal(candidates[0])}
                      className="text-left text-xs font-medium text-rose-900 hover:underline"
                    >
                      📜 View Repeat Violation History →
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No subject user identified for direct account enforcement.</p>
              )}
            </section>
          )}
        </aside>
      </div>

      {confirm && (
        <DecisionDialog
          status={confirm.status}
          targetType={caseRecord.targetType}
          saving={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={(resolutionCategory, resolutionNotes, reviewAction, listingAction, mediaAction) =>
            void update({ status: confirm.status, resolutionCategory, resolutionNotes, reviewAction, listingAction, mediaAction })
          }
        />
      )}

      {uploadModalOpen && (
        <UploadEvidenceDialog
          caseId={caseRecord.id}
          saving={saving}
          onCancel={() => setUploadModalOpen(false)}
          onSuccess={async () => {
            setUploadModalOpen(false);
            await refresh();
          }}
        />
      )}

      {previewEvidence && (
        <PreviewEvidenceDialog
          evidence={previewEvidence}
          caseId={caseRecord.id}
          onClose={() => setPreviewEvidence(null)}
        />
      )}

      {rfiModalOpen && (
        <CreateRfiDialog
          caseId={caseRecord.id}
          candidates={candidates}
          saving={saving}
          onCancel={() => setRfiModalOpen(false)}
          onSuccess={async () => {
            setRfiModalOpen(false);
            await refresh();
          }}
        />
      )}

      {appealDecisionModal && (
        <AdminAppealDecisionDialog
          caseId={caseRecord.id}
          appeal={appealDecisionModal}
          decision={appealDecision}
          setDecision={setAppealDecision}
          decisionReason={appealDecisionReason}
          setDecisionReason={setAppealDecisionReason}
          reviewNotes={appealReviewNotes}
          setReviewNotes={setAppealReviewNotes}
          reinstateContent={appealReinstateContent}
          setReinstateContent={setAppealReinstateContent}
          reopenCase={appealReopenCase}
          setReopenCase={setAppealReopenCase}
          error={appealDecisionError}
          submitting={submittingAppealDecision}
          onCancel={() => setAppealDecisionModal(null)}
          onSuccess={async () => {
            setSubmittingAppealDecision(true);
            setAppealDecisionError(null);
            try {
              const res = await fetch(
                `/api/v1/moderation/cases/${caseRecord.id}/appeals/${appealDecisionModal.id}/decision`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    decision: appealDecision,
                    decisionReason: appealDecisionReason.trim(),
                    reviewNotes: appealReviewNotes.trim() || undefined,
                    reinstateContent: appealReinstateContent,
                    reopenCase: appealReopenCase,
                  }),
                }
              );
              const payload = await res.json();
              if (!res.ok) throw new Error(payload.error?.message || "Failed to record appeal decision.");
              setAppealDecisionModal(null);
              await refresh();
            } catch (err) {
              setAppealDecisionError(err instanceof Error ? err.message : "Failed to record appeal decision.");
            } finally {
              setSubmittingAppealDecision(false);
            }
          }}
        />
      )}

      {enforcementModal && (
        <EnforcementDialog
          caseId={caseRecord.id}
          action={enforcementModal.action}
          targetUser={enforcementModal.targetUser}
          onCancel={() => setEnforcementModal(null)}
          onSuccess={async () => {
            setEnforcementModal(null);
            await refresh();
          }}
        />
      )}

      {bookingImpactModal && (
        <BookingImpactDialog
          caseId={caseRecord.id}
          targetUser={bookingImpactModal}
          onClose={() => setBookingImpactModal(null)}
        />
      )}

      {violationHistoryModal && (
        <ViolationHistoryDialog
          targetUser={violationHistoryModal}
          onClose={() => setViolationHistoryModal(null)}
        />
      )}

      {messageEnforcementModal && (
        <MessageEnforcementDialog
          caseId={caseRecord.id}
          messageId={messageEnforcementModal.messageId}
          action={messageEnforcementModal.action}
          onCancel={() => setMessageEnforcementModal(null)}
          onSuccess={async () => {
            setMessageEnforcementModal(null);
            await refresh();
          }}
        />
      )}
    </main>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return <button disabled={disabled} onClick={onClick} className="rounded-md border border-slate-300 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{label}</button>;
}

function DecisionDialog({
  status,
  targetType,
  saving,
  onCancel,
  onConfirm,
}: {
  status: string;
  targetType: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (category: string, notes: string, reviewAction?: string, listingAction?: string, mediaAction?: string) => void;
}) {
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewAction, setReviewAction] = useState("NONE");
  const [listingAction, setListingAction] = useState("NONE");
  const [mediaAction, setMediaAction] = useState("NONE");

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-decision-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="moderation-decision-title" className="text-lg font-semibold text-slate-900">
            {status === "RESOLVED" ? "Resolve" : "Dismiss"} moderation case
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Record investigation outcome. When content moderation or property action is required, choose the appropriate authorized action below.
          </p>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Resolution category <span className="text-red-500">*</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800"
            required
          >
            <option value="">Select a category</option>
            {["NO_VIOLATION", "VIOLATION_CONFIRMED", "INSUFFICIENT_EVIDENCE", "DUPLICATE_OR_MERGED", "UNABLE_TO_DETERMINE"].map((value) => (
              <option key={value} value={value}>{title(value)}</option>
            ))}
          </select>
        </label>

        {targetType === "REVIEW" && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Review enforcement action
            <select
              value={reviewAction}
              onChange={(e) => setReviewAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">Keep review published (Decision recorded only)</option>
              <option value="HIDE">Hide review (Removes from listing &amp; recalculates rating)</option>
              <option value="DELETE">Delete / Flag review (Confirmed policy violation)</option>
              <option value="RESTORE">Restore review (Re-incorporates into rating caches)</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Applying Hide or Delete will recalculate property rating averages, refresh Guest Favorite eligibility, and notify the author.
            </span>
          </label>
        )}

        {targetType === "LISTING" && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Listing moderation action
            <select
              value={listingAction}
              onChange={(e) => setListingAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">No listing action (Decision recorded only)</option>
              <option value="WARN_HOST">Issue compliance warning to host</option>
              <option value="REQUEST_CORRECTION">Request correction / changes from host</option>
              <option value="TEMPORARY_RESTRICTION">Apply temporary restriction (Pause &amp; unlist property)</option>
              <option value="SUSPEND">Suspend listing (Reject &amp; remove from marketplace)</option>
              <option value="RESTORE">Restore listing (Reactivate &amp; publish property)</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Pausing or suspending a listing immediately removes it from search and prevents new reservations, while safely preserving existing confirmed bookings without automatic cancellations.
            </span>
          </label>
        )}

        {targetType === "LISTING_PHOTO" && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Photo moderation action
            <select
              value={mediaAction}
              onChange={(e) => setMediaAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">Keep photo active (Decision recorded only)</option>
              <option value="REMOVE_PHOTO">Remove photo from listing gallery</option>
              <option value="REQUEST_REPLACEMENT">Request replacement from host</option>
              <option value="RESTORE_PHOTO">Restore photo to listing gallery</option>
              <option value="DISMISS">Dismiss report without changes</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Removing a photo automatically updates gallery ordering. If photos fall below the required 5, change requests will be flagged for the host.
            </span>
          </label>
        )}

        {(targetType === "PROFILE" || targetType === "USER") && status === "RESOLVED" && (
          <label className="block text-xs font-semibold text-slate-700">
            Profile photo moderation action
            <select
              value={mediaAction}
              onChange={(e) => setMediaAction(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800 font-medium"
            >
              <option value="NONE">Keep avatar (Decision recorded only)</option>
              <option value="REMOVE_PHOTO">Remove avatar (Reset to safe default)</option>
              <option value="RESTORE_PHOTO">Restore prior avatar</option>
              <option value="DISMISS">Dismiss report without changes</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Removing an avatar clears the profile photo and notifies the user with instructions to upload a compliant avatar.
            </span>
          </label>
        )}

        <label className="block text-xs font-semibold text-slate-700">
          Internal decision rationale
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={5000}
            rows={3}
            placeholder="Record policy clauses verified and findings..."
            className="mt-1.5 w-full rounded-md border border-slate-300 p-2 text-sm text-slate-800"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !category}
            onClick={() => onConfirm(category, notes, reviewAction, listingAction, mediaAction)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Confirm {status === "RESOLVED" ? "Resolution" : "Dismissal"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function TargetPreview({ targetType, data }: { targetType: string; data: any }) {
  if (targetType === "REVIEW") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              {data.direction === "HOST_TO_GUEST" ? "Host to Guest Review" : "Guest to Property Review"}
            </span>
            <span className="text-xs text-slate-500">ID: {data.id}</span>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge(data.status)}`}>
            {data.status}
          </span>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <span className="font-semibold text-slate-600">Review Author: </span>
            <span className="text-slate-900">{data.author?.name || "Unknown"} ({data.author?.email || "No email"})</span>
          </div>
          {data.targetUser && (
            <div>
              <span className="font-semibold text-slate-600">Reviewed Subject: </span>
              <span className="text-slate-900">{data.targetUser.name || "Unknown"} ({data.targetUser.email || "No email"})</span>
            </div>
          )}
          {data.listing && (
            <div>
              <span className="font-semibold text-slate-600">Listing: </span>
              <span className="text-slate-900">{data.listing.title} ({data.listing.city || "N/A"})</span>
            </div>
          )}
          {data.booking && (
            <div>
              <span className="font-semibold text-slate-600">Booking: </span>
              <span className="font-mono text-slate-900">{data.bookingId} ({data.booking.status})</span>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-3 border border-slate-200">
          <div className="flex items-center gap-1 font-semibold text-amber-600 text-sm">
            <span>★ {data.rating} / 5</span>
            {data.cleanliness && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                (Cleanliness: {data.cleanliness}, Accuracy: {data.accuracy}, Comm: {data.communication}, Location: {data.location}, Value: {data.value})
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-slate-800 text-sm font-normal">
            {data.comment || "No comment provided (rating only)."}
          </p>
        </div>

        {data.response && (
          <div className="rounded-lg bg-indigo-50/70 p-3 border border-indigo-100 text-xs">
            <p className="font-semibold text-indigo-900">
              Public Response from {data.response.author?.name || "Counterpart"}:
            </p>
            <p className="mt-1 text-slate-800 whitespace-pre-wrap">{data.response.comment}</p>
          </div>
        )}

        <div className="pt-1 flex gap-3 text-xs font-medium text-indigo-700">
          <Link href={`/admin/moderation/reviews?search=${data.id}`} className="hover:underline">
            Manage in Review Moderation Queue →
          </Link>
          {data.listing?.id && (
            <Link href={`/admin/listings/${data.listing.id}`} className="hover:underline">
              View Property →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (targetType === "LISTING") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{data.title}</span>
            <span className="text-xs text-slate-500">ID: {data.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2.5 py-0.5 ${badge(data.status)}`}>
              {data.status}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 ${data.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
              {data.published ? "PUBLISHED" : "UNPUBLISHED"}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 ${data.isPaused ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
              {data.isPaused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
        </div>

        {/* Media & Key Specs */}
        <div className="flex flex-col gap-4 sm:flex-row">
          {data.photos?.[0] ? (
            <div className="flex gap-2 overflow-x-auto shrink-0">
              {data.photos.slice(0, 3).map((photo: string, index: number) => (
                <Image
                  key={index}
                  src={photo}
                  alt={`Listing photo ${index + 1}`}
                  width={140}
                  height={95}
                  className="h-24 w-32 rounded-lg object-cover border border-slate-200"
                  unoptimized
                />
              ))}
            </div>
          ) : (
            <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-slate-200 text-xs text-slate-500">
              No photos
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            <p className="text-sm font-semibold text-slate-900">
              ${(data.price / 100).toFixed(2)} <span className="text-xs font-normal text-slate-500">/ night</span>
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Type: </span>
              {data.propertyType || "Property"} · {data.listingType || "Entire place"}
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Location: </span>
              {data.address ? `${data.address}, ` : ""}{data.city || "Unknown city"}, {data.country || ""}
            </p>
            <p className="text-slate-700">
              <span className="font-medium text-slate-500">Host: </span>
              <span className="font-semibold text-slate-900">{data.host?.name || "Host"}</span> ({data.host?.email || "No email"}) · Status: {data.host?.status || "ACTIVE"}
            </p>
          </div>
        </div>

        {/* Description snippet */}
        {data.description && (
          <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-700">
            <span className="font-semibold text-slate-900 block mb-1">Listing Description:</span>
            <p className="line-clamp-3 whitespace-pre-wrap">{data.description}</p>
          </div>
        )}

        {/* Amenities preview */}
        {data.amenities?.length > 0 && (
          <div className="text-xs">
            <span className="font-semibold text-slate-600 mr-2">Amenities:</span>
            <span className="text-slate-700">{data.amenities.slice(0, 8).join(" · ")}{data.amenities.length > 8 ? ` +${data.amenities.length - 8} more` : ""}</span>
          </div>
        )}

        {/* Active & Upcoming Reservations */}
        <div className="rounded-lg bg-white p-3 border border-slate-200 text-xs">
          <p className="font-semibold text-slate-900">
            Active &amp; Upcoming Reservations ({data.bookings?.length || 0})
          </p>
          {data.bookings?.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {data.bookings.map((booking: any) => (
                <div key={booking.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-900">{booking.user?.name || "Guest"}</span>
                    <span className="text-slate-500 text-[11px] ml-1.5">
                      ({formatDate(booking.startDate)} – {formatDate(booking.endDate)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge(booking.status)}`}>
                      {booking.status}
                    </span>
                    <span className="text-slate-600 font-mono text-[11px]">
                      ${(booking.totalPrice / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-slate-500 text-xs">No active or upcoming reservations on record.</p>
          )}
        </div>

        {/* Prior Quality Incidents */}
        {data.qualityIncidents?.length > 0 && (
          <div className="rounded-lg bg-amber-50/70 p-3 border border-amber-200 text-xs">
            <p className="font-semibold text-amber-900">
              Prior Quality Incidents / Disputes ({data.qualityIncidents.length})
            </p>
            <div className="mt-1.5 space-y-1.5">
              {data.qualityIncidents.map((incident: any) => (
                <div key={incident.id} className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-slate-800">
                    <strong className="text-amber-800">{incident.category}</strong>: {incident.description?.slice(0, 100) || "No description"}
                  </span>
                  <span className="text-slate-500 text-[11px]">{formatDate(incident.createdAt)} · {incident.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prior Moderation Cases */}
        {data.relatedCases?.length > 1 && (
          <div className="rounded-lg bg-indigo-50/70 p-3 border border-indigo-200 text-xs">
            <p className="font-semibold text-indigo-900">
              Other Moderation Cases for this Property ({data.relatedCases.length - 1})
            </p>
            <div className="mt-1.5 space-y-1">
              {data.relatedCases.filter((c: any) => c.id !== data.id).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between">
                  <Link href={`/admin/moderation/cases/${c.id}`} className="text-indigo-700 hover:underline font-medium">
                    {c.caseReference} ({c.category})
                  </Link>
                  <span className="text-slate-500 text-[11px]">{c.status} · {formatDate(c.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1 flex flex-wrap gap-4 text-xs font-medium text-indigo-700">
          <Link href={`/admin/listings/${data.id}`} className="hover:underline">
            Manage Property in Admin Console →
          </Link>
          <Link href={`/listings/${data.id}`} target="_blank" className="hover:underline">
            View Public Marketplace Listing ↗
          </Link>
        </div>
      </div>
    );
  }

  if (targetType === "LISTING_PHOTO") {
    const isCover = data.photos?.[0] === data.photoUrl;
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
              Listing Photo
            </span>
            {isCover && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                Cover Photo
              </span>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.isCurrentlyInGallery ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
            {data.isCurrentlyInGallery ? "Active in Gallery" : "Removed / Not in Gallery"}
          </span>
        </div>

        {/* Large Image Preview & Property Meta */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {data.photoUrl ? (
            <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <Image
                src={data.photoUrl}
                alt="Reported listing media"
                width={320}
                height={220}
                className="max-h-60 w-auto rounded-lg object-contain bg-slate-900/5"
                unoptimized
              />
              <div className="p-2 bg-white/90 text-center text-xs font-medium text-slate-600 border-t border-slate-100">
                <a href={data.photoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  View Full Resolution ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="flex h-40 w-56 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
              No Photo Available
            </div>
          )}

          {data.id && (
            <div className="flex-1 space-y-2 text-xs">
              <h3 className="text-base font-medium text-slate-900">{data.title}</h3>
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Host:</span> {data.host?.name || "Host"} ({data.host?.email || "No email"})
              </p>
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Listing Status:</span> {data.status} · {data.published ? "Published" : "Unpublished"} {data.isPaused ? "(Paused)" : ""}
              </p>
              <p className="text-slate-600">
                <span className="font-medium text-slate-700">Gallery Total:</span> {data.photos?.length ?? 0} photos
              </p>

              <div className="pt-2 flex flex-wrap gap-3">
                <Link href={`/admin/listings/${data.id}`} className="font-medium text-indigo-700 hover:underline">
                  Manage Property in Admin Console →
                </Link>
                <Link href={`/listings/${data.id}`} target="_blank" className="font-medium text-indigo-700 hover:underline">
                  View Public Listing ↗
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Gallery Thumbnails Comparison */}
        {data.photos && data.photos.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Listing Gallery Context ({data.photos.length} photos)
            </p>
            <div className="flex flex-wrap gap-2">
              {data.photos.map((url: string, index: number) => {
                const isReported = url === data.photoUrl;
                return (
                  <div
                    key={index}
                    className={`relative rounded-lg overflow-hidden border-2 ${isReported ? "border-red-500 ring-2 ring-red-400" : "border-slate-200"}`}
                  >
                    <Image
                      src={url}
                      alt={`Photo ${index + 1}`}
                      width={64}
                      height={48}
                      className="h-12 w-16 object-cover"
                      unoptimized
                    />
                    {isReported && (
                      <span className="absolute bottom-0 inset-x-0 bg-red-600 text-white text-[9px] text-center font-bold">
                        Reported
                      </span>
                    )}
                    {index === 0 && !isReported && (
                      <span className="absolute top-0 left-0 bg-black/60 text-white text-[8px] px-1 rounded-br">
                        Cover
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (targetType === "USER" || targetType === "PROFILE") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            User Profile
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.photoUrl ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
            {data.photoUrl ? "Active Avatar" : "No Avatar / Removed"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {data.photoUrl ? (
            <div className="relative size-20 overflow-hidden rounded-full border-2 border-slate-300">
              <Image
                src={data.photoUrl}
                alt="Profile photo"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-500">
              {data.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div className="space-y-1 text-xs">
            <p className="text-base font-medium text-slate-900">{data.name || "Unnamed user"}</p>
            <p className="text-slate-600">{data.email}</p>
            <p className="text-slate-500">Role: <span className="font-medium text-slate-700">{data.role}</span> · Status: <span className="font-medium text-slate-700">{data.status}</span></p>
            <p className="text-slate-500">Joined: {formatDate(data.createdAt)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (targetType === "MESSAGE") {
    return (
      <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
        <p className="whitespace-pre-wrap">{data.content}</p>
        <p className="mt-2 text-xs text-slate-500">Sender: {data.sender?.name || data.sender?.email || "Unavailable"} · {formatDate(data.createdAt)}</p>
      </div>
    );
  }

  return <p className="mt-3 text-sm text-slate-500">A safe preview is unavailable for this content type.</p>;
}

function UploadEvidenceDialog({
  caseId,
  saving,
  onCancel,
  onSuccess,
}: {
  caseId: string;
  saving: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [accessScope, setAccessScope] = useState<"ADMIN_ONLY" | "CASE_PARTICIPANTS">("CASE_PARTICIPANTS");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (displayName.trim()) formData.append("displayName", displayName.trim());
      if (description.trim()) formData.append("description", description.trim());
      formData.append("accessScope", accessScope);

      const res = await fetch(`/api/v1/moderation/cases/${caseId}/evidence`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to upload evidence");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to upload evidence");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-evidence-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="upload-evidence-title" className="text-lg font-semibold text-slate-900">
            Attach Moderation Evidence
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Upload images or documents for this investigation. Files are signature-verified, malware-scanned, and stored securely in private storage.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Select File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              required
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                setFile(selected);
                if (selected && !displayName) {
                  setDisplayName(selected.name);
                }
              }}
              className="mt-1 w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Supported formats: JPEG, PNG, WebP, PDF (max 15MB). Magic bytes signature validated.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Host chat screenshot, Check-in receipt"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Access Visibility
            </label>
            <select
              value={accessScope}
              onChange={(e) => setAccessScope(e.target.value as any)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            >
              <option value="CASE_PARTICIPANTS">Case Participants &amp; Moderators (Shared)</option>
              <option value="ADMIN_ONLY">Moderators Only (Confidential / Internal)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Description / Investigative Context
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain how this file pertains to the case investigation..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={uploading || saving}
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || saving || !file}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? "Uploading & Scanning..." : "Upload Evidence"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function PreviewEvidenceDialog({
  evidence,
  caseId,
  onClose,
}: {
  evidence: any;
  caseId: string;
  onClose: () => void;
}) {
  const mime = evidence.metadata?.mimeType || "";
  const isPdf = mime === "application/pdf" || evidence.displayName?.toLowerCase().endsWith(".pdf");
  const streamUrl = `/api/v1/moderation/cases/${caseId}/evidence/${evidence.id}`;

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-evidence-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 id="preview-evidence-title" className="text-sm font-semibold text-slate-900">
              {evidence.displayName || "Evidence Preview"}
            </h2>
            <p className="text-xs text-slate-500">
              {mime || "file"} · {evidence.accessScope.replaceAll("_", " ")}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
              className="h-[70vh] w-full rounded border border-slate-200 bg-white"
            />
          ) : (
            <img
              src={streamUrl}
              alt={evidence.displayName}
              className="max-h-[70vh] max-w-full rounded-lg object-contain shadow"
            />
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function CreateRfiDialog({
  caseId,
  candidates,
  saving,
  onCancel,
  onSuccess,
}: {
  caseId: string;
  candidates: Array<{ id: string; name: string; label: string }>;
  saving: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [recipientId, setRecipientId] = useState(candidates[0]?.id || "");
  const [customRecipient, setCustomRecipient] = useState(false);
  const [subject, setSubject] = useState("");
  const [questions, setQuestions] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipientId.trim()) {
      setError("Please select or enter a recipient.");
      return;
    }
    if (!questions.trim()) {
      setError("Please enter the request questions or instructions.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + Number(deadlineDays));

      const res = await fetch(`/api/v1/moderation/cases/${caseId}/information-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: recipientId.trim(),
          requestText: `${subject.trim() ? subject.trim() + "\n\n" : ""}${questions.trim()}`,
          deadline: deadlineDate.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create information request");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create information request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-rfi-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="create-rfi-title" className="text-lg font-semibold text-slate-900">
            Request Additional Information (RFI)
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Send a formal inquiry to a case participant. The case status will transition to <strong>NEEDS_INFORMATION</strong> and the recipient will be notified.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Recipient Participant <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setCustomRecipient(!customRecipient)}
                className="text-[11px] text-indigo-600 hover:underline"
              >
                {customRecipient ? "Select known participant" : "Enter custom User ID"}
              </button>
            </div>

            {customRecipient || candidates.length === 0 ? (
              <input
                type="text"
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="User ID (e.g. usr_123...)"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            ) : (
              <select
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Subject / Topic
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Additional documentation required regarding check-in"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Inquiry / Required Evidence <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="State specifically what evidence, receipts, or explanations the recipient needs to provide..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Response Deadline
            </label>
            <select
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            >
              <option value={1}>24 Hours (Urgent safety / access)</option>
              <option value={3}>3 Days (Standard)</option>
              <option value={5}>5 Days (Review / property dispute)</option>
              <option value={7}>7 Days (Extended inquiry)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting || saving}
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Sending Request..." : "Send Request for Information"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function AdminAppealDecisionDialog({
  caseId,
  appeal,
  decision,
  setDecision,
  decisionReason,
  setDecisionReason,
  reviewNotes,
  setReviewNotes,
  reinstateContent,
  setReinstateContent,
  reopenCase,
  setReopenCase,
  error,
  submitting,
  onCancel,
  onSuccess,
}: {
  caseId: string;
  appeal: any;
  decision: "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED";
  setDecision: (val: "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED") => void;
  decisionReason: string;
  setDecisionReason: (val: string) => void;
  reviewNotes: string;
  setReviewNotes: (val: string) => void;
  reinstateContent: boolean;
  setReinstateContent: (val: boolean) => void;
  reopenCase: boolean;
  setReopenCase: (val: boolean) => void;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSuccess: () => Promise<void>;
}) {
  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="appeal-decision-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 id="appeal-decision-title" className="text-lg font-bold text-slate-900">
              Decide Moderation Appeal: {appeal.id}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Appellant: <span className="font-semibold text-slate-800">{appeal.appellantName || appeal.appellantEmail || "User"}</span> ({appeal.appellantRole})
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (decisionReason.trim().length < 5) return;
            void onSuccess();
          }}
          className="mt-4 space-y-4 text-xs"
        >
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-700">Appellant Statement:</span>
            <p className="text-slate-800 whitespace-pre-wrap">{appeal.explanation}</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Appeal Outcome *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision("APPROVED")}
                className={`rounded-lg border p-2 text-xs font-semibold transition ${
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
                className={`rounded-lg border p-2 text-xs font-semibold transition ${
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
                className={`rounded-lg border p-2 text-xs font-semibold transition ${
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
            <div className="space-y-2 rounded-lg bg-emerald-50/70 p-3 border border-emerald-200">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-emerald-950">
                <input
                  type="checkbox"
                  checked={reinstateContent}
                  onChange={(e) => setReinstateContent(e.target.checked)}
                  className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Reinstate affected content (restore review/listing/photo)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-emerald-950">
                <input
                  type="checkbox"
                  checked={reopenCase}
                  onChange={(e) => setReopenCase(e.target.checked)}
                  className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Reopen case (status → REOPENED)</span>
              </label>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700">
              Decision Explanation (Shared with appellant) *
            </label>
            <textarea
              required
              rows={3}
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder="State the justification for this decision clearly..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700">
              Internal Review Notes (Admin only, optional)
            </label>
            <textarea
              rows={2}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Internal moderator notes regarding the appeal..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || decisionReason.trim().length < 5}
              className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Recording Decision..." : "Record Appeal Decision"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

/* ========================================================================= */
/* PHASE 6 ENFORCEMENT DIALOGS                                               */
/* ========================================================================= */

function EnforcementDialog({
  caseId,
  action,
  targetUser,
  onCancel,
  onSuccess,
}: {
  caseId: string;
  action: "WARN" | "RESTRICT" | "SUSPEND";
  targetUser: { id: string; name: string; label?: string };
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [restrictionType, setRestrictionType] = useState<string>("RESTRICT_MESSAGING");
  const [durationHours, setDurationHours] = useState<number | null>(48);
  const [reason, setReason] = useState("");
  const [policyCode, setPolicyCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-flight booking impact check for suspension
  const [impactLoading, setImpactLoading] = useState(action === "SUSPEND");
  const [impactData, setImpactData] = useState<any | null>(null);
  const [impactAcknowledged, setImpactAcknowledged] = useState(false);

  useEffect(() => {
    if (action === "SUSPEND") {
      setImpactLoading(true);
      fetch(`/api/v1/moderation/cases/${caseId}/booking-impact?userId=${targetUser.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (payload?.data) setImpactData(payload.data);
        })
        .catch(() => undefined)
        .finally(() => setImpactLoading(false));
    }
  }, [action, caseId, targetUser.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("Please provide a reason of at least 5 characters.");
      return;
    }
    if (action === "SUSPEND" && impactData?.activeCount > 0 && !impactAcknowledged) {
      setError("You must acknowledge the reservation impact before suspending this user.");
      return;
    }

    setSubmitting(true);
    setError(null);

    let body: any;
    if (action === "WARN") {
      body = {
        action: "WARN",
        targetUserId: targetUser.id,
        reason: reason.trim(),
        policyCode: policyCode.trim() || undefined,
      };
    } else if (action === "RESTRICT") {
      body = {
        action: "RESTRICT",
        targetUserId: targetUser.id,
        type: restrictionType,
        durationHours: durationHours ?? null,
        reason: reason.trim(),
        policyCode: policyCode.trim() || undefined,
      };
    } else if (action === "SUSPEND") {
      body = {
        action: "SUSPEND",
        targetUserId: targetUser.id,
        reason: reason.trim(),
        policyCode: policyCode.trim() || undefined,
        bookingImpactAcknowledged: impactAcknowledged,
      };
    }

    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/enforcement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to execute enforcement.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute enforcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const titleText =
    action === "WARN"
      ? "Issue Account Warning"
      : action === "RESTRICT"
      ? "Apply Account Restriction"
      : "Suspend User Account";

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="enforcement-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="enforcement-modal-title" className="text-lg font-semibold text-slate-900">
            {titleText}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Subject: <strong className="text-slate-900">{targetUser.name}</strong> ({targetUser.id})
          </p>
        </div>

        {error && <div className="rounded-md bg-red-50 p-3 text-xs text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {action === "RESTRICT" && (
            <div className="space-y-3 rounded-lg bg-amber-50/50 p-3.5 border border-amber-200">
              <div>
                <label className="block font-semibold text-slate-700">Restriction Scope *</label>
                <select
                  value={restrictionType}
                  onChange={(e) => setRestrictionType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
                >
                  <option value="RESTRICT_MESSAGING">Block Messaging (Cannot send messages)</option>
                  <option value="RESTRICT_BOOKING">Block Booking (Cannot make new reservations)</option>
                  <option value="RESTRICT_LISTING_CREATION">Block Listing Creation (Cannot create listings)</option>
                  <option value="RESTRICT_REVIEWS">Block Reviews (Cannot write new reviews)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Duration *</label>
                <select
                  value={durationHours === null ? "indefinite" : String(durationHours)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDurationHours(val === "indefinite" ? null : parseInt(val, 10));
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
                >
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="168">7 days (168 hours)</option>
                  <option value="720">30 days (720 hours)</option>
                  <option value="indefinite">Indefinite (Until manually lifted)</option>
                </select>
              </div>
            </div>
          )}

          {action === "SUSPEND" && (
            <div className="space-y-3 rounded-lg bg-rose-50/70 p-3.5 border border-rose-200">
              <p className="font-semibold text-rose-950">Pre-Flight Reservation Safeguard</p>
              {impactLoading ? (
                <p className="text-slate-500">Checking active reservations...</p>
              ) : impactData ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded bg-white p-2 border border-rose-200/60">
                      <span className="text-slate-500">Active Reservations:</span>
                      <p className="font-bold text-slate-900">{impactData.activeCount}</p>
                    </div>
                    <div className="rounded bg-white p-2 border border-rose-200/60">
                      <span className="text-slate-500">Active Value:</span>
                      <p className="font-bold text-slate-900">${impactData.totalActiveRevenueOrSpend || 0}</p>
                    </div>
                  </div>

                  {impactData.activeCount > 0 ? (
                    <div className="space-y-2">
                      <div className="rounded-md bg-amber-100/70 p-2.5 text-[11px] text-amber-900 border border-amber-300">
                        ⚠️ <strong>Safeguard Warning:</strong> This user has {impactData.activeCount} active reservation(s). Account suspension disables future platform interactions but does <strong>NOT</strong> cancel existing bookings or alter financial payouts.
                      </div>
                      <label className="flex items-start gap-2 pt-1 font-medium text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={impactAcknowledged}
                          onChange={(e) => setImpactAcknowledged(e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          required
                        />
                        <span>I acknowledge the reservation impact and authorize account suspension without automatic booking cancellation.</span>
                      </label>
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-800 font-medium">✓ No active reservations exist for this user.</p>
                  )}
                </>
              ) : null}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700">Enforcement Reason *</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the justification for this enforcement action..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Policy Code (Optional)</label>
            <input
              type="text"
              value={policyCode}
              onChange={(e) => setPolicyCode(e.target.value)}
              placeholder="e.g. POL-COM-HARASSMENT"
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5 || (action === "SUSPEND" && impactData?.activeCount > 0 && !impactAcknowledged)}
              className="rounded-md bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {submitting ? "Executing..." : "Execute Enforcement"}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function BookingImpactDialog({
  caseId,
  targetUser,
  onClose,
}: {
  caseId: string;
  targetUser: { id: string; name: string };
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<any | null>(null);

  useEffect(() => {
    fetch(`/api/v1/moderation/cases/${caseId}/booking-impact?userId=${targetUser.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data) setImpact(payload.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [caseId, targetUser.id]);

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-impact-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 id="booking-impact-title" className="text-lg font-semibold text-slate-900">
              Booking &amp; Reservation Impact Assessment
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Evaluates affected stays and counterparty obligations prior to enforcement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Evaluating reservation impact...</div>
        ) : impact ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500">Active Bookings</span>
                <p className="text-lg font-bold text-slate-900">{impact.activeCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500">Active Volume</span>
                <p className="text-lg font-bold text-slate-900">${impact.totalActiveRevenueOrSpend || 0}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500">Past Bookings</span>
                <p className="text-lg font-bold text-slate-900">{impact.pastCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500">Cancelled</span>
                <p className="text-lg font-bold text-slate-900">{impact.cancelledCount}</p>
              </div>
            </div>

            {impact.activeBookings?.length > 0 ? (
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">Active &amp; Upcoming Reservations ({impact.activeBookings.length})</h3>
                <div className="space-y-2">
                  {impact.activeBookings.map((b: any) => (
                    <div key={b.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-100">
                        <span className="font-semibold text-slate-900">{b.listingTitle}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {b.status} · ${b.totalPrice} {b.currency}
                        </span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600">
                        <div>User Role: <strong className="text-slate-800">{b.userRole}</strong></div>
                        <div>Counterparty: <strong className="text-slate-800">{b.counterpartyName || "User"}</strong> ({b.counterpartyEmail || "—"})</div>
                        <div>Check-in: {formatDate(b.startDate)}</div>
                        <div>Check-out: {formatDate(b.endDate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-slate-500">
                No active or upcoming reservations found for this user.
              </div>
            )}

            <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-200 text-blue-950 text-[11px] leading-relaxed">
              ℹ️ <strong>System Policy:</strong> {impact.disclaimer}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ModalOverlay>
  );
}

function ViolationHistoryDialog({
  targetUser,
  onClose,
}: {
  targetUser: { id: string; name: string };
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any | null>(null);

  useEffect(() => {
    fetch(`/api/v1/moderation/users/${targetUser.id}/violation-history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data) setHistory(payload.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [targetUser.id]);

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="violation-history-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 id="violation-history-title" className="text-lg font-semibold text-slate-900">
              Repeat-Violation &amp; Enforcement History
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Subject: {targetUser.name} ({targetUser.id})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Compiling violation history...</div>
        ) : history ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-rose-50 p-3 border border-rose-200">
                <span className="text-rose-700 font-medium">Total Violations</span>
                <p className="text-xl font-bold text-rose-900">{history.totalViolationsCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500 font-medium">Moderation Cases</span>
                <p className="text-xl font-bold text-slate-900">{history.casesCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500 font-medium">Active Warnings</span>
                <p className="text-xl font-bold text-slate-900">
                  {history.warnings?.filter((w: any) => w.status === "ACTIVE").length || 0}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-slate-500 font-medium">Restrictions</span>
                <p className="text-xl font-bold text-slate-900">{history.restrictions?.length || 0}</p>
              </div>
            </div>

            {/* Warnings list */}
            {history.warnings?.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-1.5">Account Warnings ({history.warnings.length})</h3>
                <div className="space-y-1.5">
                  {history.warnings.map((w: any) => (
                    <div key={w.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-2.5">
                      <div className="flex justify-between font-medium">
                        <span className="text-amber-900">Warning: {w.reason}</span>
                        <span className="text-slate-500 text-[11px]">{formatDate(w.issuedAt)} · {w.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Restrictions list */}
            {history.restrictions?.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-1.5">Account Restrictions ({history.restrictions.length})</h3>
                <div className="space-y-1.5">
                  {history.restrictions.map((r: any) => (
                    <div key={r.id} className="rounded-lg border border-orange-200 bg-orange-50/40 p-2.5">
                      <div className="flex justify-between font-medium">
                        <span className="text-orange-900">{r.type}: {r.reason}</span>
                        <span className="text-slate-500 text-[11px]">{r.status} {r.expiresAt ? `(exp: ${formatDate(r.expiresAt)})` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cases list */}
            {history.cases?.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-1.5">Past Cases Linked to Subject ({history.cases.length})</h3>
                <div className="space-y-1.5">
                  {history.cases.map((c: any) => (
                    <div key={c.id} className="rounded-lg border border-slate-200 p-2.5 bg-white flex items-center justify-between">
                      <div>
                        <Link href={`/admin/moderation/cases/${c.id}`} className="font-semibold text-indigo-700 hover:underline">
                          {c.caseReference}
                        </Link>
                        <span className="text-slate-500 ml-2">({c.targetType} · {c.category})</span>
                      </div>
                      <span className="text-slate-500 text-[11px]">{c.status} · {formatDate(c.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ModalOverlay>
  );
}

function MessageEnforcementDialog({
  caseId,
  messageId,
  action,
  onCancel,
  onSuccess,
}: {
  caseId: string;
  messageId: string;
  action: "HIDE" | "REMOVE" | "RESTORE";
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [policyCode, setPolicyCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("Please provide a reason of at least 5 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/moderation/cases/${caseId}/enforcement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MESSAGE_ENFORCEMENT",
          messageId,
          messageAction: action,
          reason: reason.trim(),
          policyCode: policyCode.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error?.message || "Failed to execute message enforcement.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute message enforcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const actionTitle =
    action === "HIDE"
      ? "Hide Message"
      : action === "REMOVE"
      ? "Remove Message"
      : "Restore Message";

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-enforcement-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h2 id="message-enforcement-title" className="text-lg font-semibold text-slate-900">
            {actionTitle}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Message ID: <code className="font-mono text-slate-800">{messageId}</code>
          </p>
        </div>

        {error && <div className="rounded-md bg-red-50 p-3 text-xs text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">Enforcement Reason *</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State the justification for this message action..."
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700">Policy Code (Optional)</label>
            <input
              type="text"
              value={policyCode}
              onChange={(e) => setPolicyCode(e.target.value)}
              placeholder="e.g. POL-MSG-OFFPLATFORM"
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5}
              className={`rounded-md px-4 py-2 font-semibold text-white disabled:opacity-50 ${
                action === "REMOVE" ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {submitting ? "Applying..." : actionTitle}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
