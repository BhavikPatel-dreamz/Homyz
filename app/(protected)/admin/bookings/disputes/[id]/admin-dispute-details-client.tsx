"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";

interface DisputeDetailsProps {
  initialData: {
    dispute: {
      id: string;
      caseReference: string;
      category: string;
      status: string;
      disputeWorkflowStatus: string;
      severity: string;
      description: string;
      resolutionNotes: string | null;
      reportedBy: {
        id: string;
        name: string | null;
        email: string | null;
      } | null;
      reporterRole: string;
      incidentDate: string;
      assignedAdmin: {
        id: string;
        email: string;
        assignedAt: string;
      } | null;
      internalNotes: {
        id: string;
        authorEmail: string;
        content: string;
        createdAt: string;
      }[];
      evidence: {
        id: string;
        url?: string;
        uploadedBy?: string;
        fileName?: string;
        createdAt: string;
      }[];
      infoRequests: {
        id: string;
        target: string;
        message: string;
        status: string;
        createdAt: string;
      }[];
      partyResponses: {
        id: string;
        requestId: string;
        content: string | null;
        evidenceIds: string[];
        createdAt: string;
      }[];
      timeline: {
        id: string;
        event: string;
        title: string;
        description: string;
        actorEmail: string;
        timestamp: string;
      }[];
      resolution: {
        decisionCategory: string;
        explanation: string;
        refundRequestId: string | null;
        financialAdjustmentNote: string | null;
        resolvedByEmail: string;
        resolvedAt: string;
      } | null;
      createdAt: string;
      updatedAt: string;
      resolvedAt: string | null;
    };
    booking: {
      id: string;
      status: string;
      startDate: string;
      endDate: string;
      totalPrice: number | null;
      currency: string;
      user: {
        id: string;
        name: string | null;
        email: string | null;
        image: string | null;
        phone: string | null;
      };
      listing: {
        id: string;
        title: string;
        city: string | null;
        country: string | null;
        photos: string[];
        host: {
          id: string;
          name: string | null;
          email: string | null;
          image: string | null;
        };
      };
      payments: any[];
      refunds: any[];
    } | null;
    listing: any;
  };
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

function formatDateTime(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return dateTimeFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

export function AdminDisputeDetailsClient({ initialData }: DisputeDetailsProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [data, setData] = useState(initialData);
  const dispute = data.dispute;
  const booking = data.booking;

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");

  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoTarget, setInfoTarget] = useState<"GUEST" | "HOST">("GUEST");
  const [infoMessage, setInfoMessage] = useState("");

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveCategory, setResolveCategory] = useState("RESOLVED_NO_FINANCIAL_ADJUSTMENT");
  const [resolveExplanation, setResolveExplanation] = useState("");
  const [resolveRefundId, setResolveRefundId] = useState("");
  const [resolveConfirmCheck, setResolveConfirmCheck] = useState(false);

  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Handle Assign
  const handleAssign = async () => {
    if (!assignEmail.trim()) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/disputes/${dispute.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToEmail: assignEmail.trim() }),
      });
      if (!res.ok) throw new Error("Failed to assign dispute.");
      setActionSuccess(`Case successfully assigned to ${assignEmail.trim()}`);
      setAssignModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to assign case");
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Add Note
  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/disputes/${dispute.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add internal note.");
      setActionSuccess("Internal investigation note recorded.");
      setNoteModalOpen(false);
      setNoteContent("");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to add note");
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Request Info
  const handleRequestInfo = async () => {
    if (!infoMessage.trim()) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/disputes/${dispute.id}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: infoTarget, message: infoMessage.trim() }),
      });
      if (!res.ok) throw new Error("Failed to request information.");
      setActionSuccess(`Information request dispatched to ${infoTarget}.`);
      setInfoModalOpen(false);
      setInfoMessage("");
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to request info");
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle Resolve
  const handleResolve = async () => {
    if (!resolveExplanation.trim()) {
      setActionError("A resolution explanation is required.");
      return;
    }
    if (!resolveConfirmCheck) {
      setActionError("Please confirm the resolution decision.");
      return;
    }
    setLoadingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/bookings/disputes/${dispute.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionCategory: resolveCategory,
          explanation: resolveExplanation.trim(),
          refundRequestId: resolveRefundId.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to resolve dispute.");
      setActionSuccess("Dispute case has been officially resolved.");
      setResolveModalOpen(false);
      router.refresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to resolve dispute");
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/bookings/disputes"
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              ← All Disputes
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              {dispute.caseReference}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <h1>
              Case {dispute.caseReference}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                dispute.status === "RESOLVED"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : dispute.status === "PENDING"
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
              }`}
            >
              {dispute.disputeWorkflowStatus}
            </span>
            <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {dispute.severity}
            </span>
            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-[var(--surface-secondary)] text-[var(--muted-foreground)]">
              {dispute.category.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {dispute.status !== "RESOLVED" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setInfoTarget("HOST");
                  setInfoModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
              >
                <span>Request Host Response</span>
              </button>

              <button
                type="button"
                onClick={() => setResolveModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
              >
                <span>Resolve Dispute</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setNoteModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>+ Add Note</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold">✕</button>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section A: Complaint Details */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Complaint & Issue Description
            </h2>

            <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] mb-4">
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                {dispute.description}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block">Reporter Role</span>
                <span className="font-semibold uppercase text-foreground">{dispute.reporterRole}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Reported By</span>
                <span className="font-semibold text-foreground">{dispute.reportedBy?.name || "User"}</span>
                <span className="text-3xs text-[var(--muted-foreground)] block">{dispute.reportedBy?.email}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Incident Date</span>
                <span className="text-foreground">{formatDate(dispute.incidentDate)}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Date Filed</span>
                <span className="text-foreground">{formatDateTime(dispute.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Section B: Booking Information */}
          {booking && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
              <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H7" />
                </svg>
                Reservation Details
              </h2>

              <div className="flex flex-col sm:flex-row gap-4 items-start mb-4">
                <div className="relative w-full sm:w-32 h-24 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-[var(--border)]">
                  {booking.listing.photos?.[0] ? (
                    <Image src={booking.listing.photos[0]} alt={booking.listing.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Photo</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-sm">{booking.listing.title}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">{booking.listing.city || "Saudi Arabia"}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-[var(--muted-foreground)] block">Booking ID</span>
                      <span className="font-mono text-2xs text-foreground">{booking.id.slice(0, 10)}...</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block">Check-in</span>
                      <span className="font-semibold text-foreground">{formatDate(booking.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block">Check-out</span>
                      <span className="font-semibold text-foreground">{formatDate(booking.endDate)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block">Status</span>
                      <span className="font-semibold uppercase text-foreground">{booking.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Context */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border)] text-xs">
                <div>
                  <span className="text-[var(--muted-foreground)] block">Total Booking Value</span>
                  <span className="font-bold text-foreground">
                    {formatPrice((booking.totalPrice || 0) / 100, booking.currency || "SAR")}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">Captured Payments</span>
                  <span className="font-semibold text-emerald-600">
                    {booking.payments?.length || 0} transaction(s)
                  </span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block">Refund Requests</span>
                  <span className="font-semibold text-foreground">
                    {booking.refunds?.length || 0} request(s)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section D: Investigation Timeline */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Investigation Activity Timeline
            </h2>

            {dispute.timeline.length > 0 ? (
              <div className="space-y-4">
                {dispute.timeline.map((ev: any) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border)] text-xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground uppercase tracking-wider text-2xs">
                          {ev.title}
                        </span>
                        <span className="text-[var(--muted-foreground)] text-2xs">
                          {formatDateTime(ev.timestamp)}
                        </span>
                      </div>
                      <p className="text-[var(--muted-foreground)] mt-0.5">{ev.description}</p>
                      {ev.actorEmail && (
                        <span className="text-3xs text-[var(--muted-foreground)] font-mono block mt-1">
                          Actor: {ev.actorEmail}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)] italic">
                No activity events recorded yet.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Notes & Resolution */}
        <div className="flex flex-col gap-6">
          {/* Resolution Outcome if resolved */}
          {dispute.resolution && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 shadow-2xs text-xs space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                Official Resolution Decision
              </h2>
              <div>
                <span className="text-[var(--muted-foreground)] block">Decision Category</span>
                <span className="font-bold text-foreground text-sm">
                  {dispute.resolution.decisionCategory.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block">Explanation</span>
                <p className="text-foreground mt-0.5 bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                  {dispute.resolution.explanation}
                </p>
              </div>
              <div className="pt-2 border-t border-emerald-500/20 text-2xs text-[var(--muted-foreground)]">
                <p>Resolved by: {dispute.resolution.resolvedByEmail}</p>
                <p>Date: {formatDateTime(dispute.resolution.resolvedAt)}</p>
                {dispute.resolution.refundRequestId && (
                  <p className="mt-1 font-semibold text-emerald-700">
                    Linked Refund Request: {dispute.resolution.refundRequestId}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Assigned Reviewer */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs text-xs space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
              Case Reviewer
            </h2>
            {dispute.assignedAdmin ? (
              <div>
                <span className="font-semibold text-foreground block">{dispute.assignedAdmin.email}</span>
                <span className="text-3xs text-[var(--muted-foreground)]">
                  Assigned on {formatDateTime(dispute.assignedAdmin.assignedAt)}
                </span>
              </div>
            ) : (
              <p className="text-[var(--muted-foreground)] italic">Unassigned (In triage queue)</p>
            )}
          </div>

          {/* Internal Investigation Notes */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs text-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Participant responses</h2>
            {dispute.partyResponses.length > 0 ? (
              <div className="space-y-3">
                {dispute.partyResponses.map((response) => (
                  <div key={response.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-3">
                    <p className="whitespace-pre-wrap text-foreground">{response.content || "Evidence submitted without a written response."}</p>
                    <p className="mt-2 text-3xs text-[var(--muted-foreground)]">Submitted {formatDateTime(response.createdAt)} · {response.evidenceIds.length} evidence file(s)</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-[var(--muted-foreground)] italic">No participant responses have been submitted.</p>}
            {dispute.evidence.length > 0 && (
              <div className="border-t border-[var(--border)] pt-3">
                <p className="mb-2 font-semibold text-foreground">Evidence</p>
                <ul className="space-y-1.5">{dispute.evidence.map((evidence) => evidence.url ? <li key={evidence.id}><a href={evidence.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">{evidence.fileName || evidence.url}</a></li> : null)}</ul>
              </div>
            )}
          </div>

          {/* Internal Investigation Notes */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Internal Admin Notes ({dispute.internalNotes.length})
              </h2>
              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                className="text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                + Add Note
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {dispute.internalNotes.length > 0 ? (
                dispute.internalNotes.map((n: any) => (
                  <div key={n.id} className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
                    <p className="text-foreground whitespace-pre-wrap">{n.content}</p>
                    <div className="mt-2 text-3xs text-[var(--muted-foreground)] flex justify-between">
                      <span>{n.authorEmail}</span>
                      <span>{formatDateTime(n.createdAt)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--muted-foreground)] italic">
                  No internal notes recorded. These notes are strictly private to administrators.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: ASSIGN CASE */}
      {assignModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Assign Dispute Case</h3>
              <button onClick={() => setAssignModalOpen(false)} className="font-bold">✕</button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Administrator Email *
              </label>
              <input
                type="email"
                required
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                placeholder="admin@homyz.com"
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground text-xs"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={loadingAction || !assignEmail.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {loadingAction ? "Assigning..." : "Assign Reviewer"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 2: ADD INTERNAL NOTE */}
      {noteModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Add Internal Investigation Note</h3>
              <button onClick={() => setNoteModalOpen(false)} className="font-bold">✕</button>
            </div>

            <p className="text-2xs text-[var(--muted-foreground)]">
              Internal notes are only visible to platform administrators. They are never shared with
              the guest or host.
            </p>

            <div>
              <textarea
                rows={4}
                required
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Record investigation findings, telephone summaries, or review context..."
                className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground text-xs focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNote}
                disabled={loadingAction || !noteContent.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {loadingAction ? "Saving..." : "Save Internal Note"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 3: REQUEST INFORMATION */}
      {infoModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">
                {infoTarget === "HOST" ? "Request Host Response" : "Request Guest Information"}
              </h3>
              <button onClick={() => setInfoModalOpen(false)} className="font-bold">✕</button>
            </div>

              <div className="space-y-3 text-xs">
                {infoTarget === "HOST" && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    This shares the case with the booking&apos;s eligible Host, marks a response as required, and sends the Host a case notification.
                  </p>
                )}
                <div>
                <label className="block font-semibold text-foreground mb-1">Target Party</label>
                <select
                  value={infoTarget}
                  onChange={(e) => setInfoTarget(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                >
                  <option value="GUEST">Guest ({booking?.user.name})</option>
                  <option value="HOST">Host ({booking?.listing.host.name})</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Message / Request Details</label>
                <textarea
                  rows={4}
                  required
                  value={infoMessage}
                  onChange={(e) => setInfoMessage(e.target.value)}
                  placeholder="Specify what details, photos, or clarification are requested..."
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestInfo}
                disabled={loadingAction || !infoMessage.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {loadingAction ? "Sending..." : infoTarget === "HOST" ? "Confirm & Request Host Response" : "Send Request"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* MODAL 4: RESOLVE DISPUTE */}
      {resolveModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">Resolve Dispute Case</h3>
              <button onClick={() => setResolveModalOpen(false)} className="font-bold">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Decision Category</label>
                <select
                  value={resolveCategory}
                  onChange={(e) => setResolveCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                >
                  <option value="RESOLVED_NO_FINANCIAL_ADJUSTMENT">Resolved without financial adjustment</option>
                  <option value="REFERRED_TO_REFUND">Referred to existing refund workflow</option>
                  <option value="REFERRED_TO_OPERATIONS">Referred to property operations</option>
                  <option value="CLOSED_AFTER_REVIEW">Closed after comprehensive review</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Resolution Explanation *
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolveExplanation}
                  onChange={(e) => setResolveExplanation(e.target.value)}
                  placeholder="Explain the findings and basis for this resolution decision..."
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Linked Refund Request ID (Optional)
                </label>
                <input
                  type="text"
                  value={resolveRefundId}
                  onChange={(e) => setResolveRefundId(e.target.value)}
                  placeholder="Optional refund request reference (e.g. cm...)"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground text-xs font-mono"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={resolveConfirmCheck}
                  onChange={(e) => setResolveConfirmCheck(e.target.checked)}
                  className="rounded border-[var(--border)] mt-0.5"
                />
                <span className="text-2xs text-[var(--muted-foreground)]">
                  I confirm this resolution decision. (Financial refunds must still be processed through the
                  Phase 10 Refund Management workflow).
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={loadingAction || !resolveConfirmCheck || !resolveExplanation.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {loadingAction ? "Resolving..." : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
