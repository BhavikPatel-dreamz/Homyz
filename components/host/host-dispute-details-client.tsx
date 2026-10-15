"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCurrency } from "@/lib/currency-context";

interface HostDisputeDetailsProps {
  initialData: {
    dispute: {
      id: string;
      caseReference: string;
      category: string;
      status: string;
      disputeWorkflowStatus: string;
      severity: string;
      description: string | null;
      resolutionNotes: string | null;
      createdAt: string;
      updatedAt: string;
      resolvedAt: string | null;
      responseRequired: boolean;
      reporterRole: string;
      isReporter: boolean;
      hasAssignedReviewer: boolean;
      resolution: {
        decisionCategory: string;
        explanation: string;
        resolvedAt: string;
        resolvedByEmail?: string;
        refundRequestId?: string | null;
      } | null;
      resolutionProposals: Array<{
        id: string;
        proposalType: string;
        explanation: string;
        status: string;
        createdAt: string;
        evidenceIds: string[];
      }>;
      infoRequests: Array<{
        id: string;
        message: string;
        status: string;
        createdAt: string;
        respondedAt: string | null;
      }>;
      timeline: Array<{
        id: string;
        event: string;
        title: string;
        description: string;
        timestamp: string;
      }>;
      evidence: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        createdAt: string;
        url: string;
      }>;
      replies: Array<{
        id: string;
        content: string | null;
        audience: string;
        createdAt: string;
        evidenceIds: string[];
      }>;
      privateNotes: Array<{
        id: string;
        content: string;
        createdAt: string;
        updatedAt: string;
      }>;
      closed: boolean;
    };
    booking: {
      id: string;
      status: string;
      startDate: string;
      endDate: string;
      guests: number;
      totalPrice?: number | null;
      currency?: string;
      user?: {
        id: string;
        name: string | null;
        image: string | null;
      } | null;
    } | null;
    listing: {
      id: string;
      title: string;
      city?: string | null;
      country?: string | null;
      photos?: string[];
    } | null;
  };
}

type TabType = "overview" | "conversation" | "notes" | "evidence" | "activity" | "resolution";

function formatDate(val: string | null | undefined, includeTime = false) {
  if (!val) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      ...(includeTime ? { timeStyle: "short" } : {}),
    }).format(new Date(val));
  } catch {
    return String(val);
  }
}

export function HostDisputeDetailsClient({ initialData }: HostDisputeDetailsProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const { dispute, booking, listing } = initialData;

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const isOpen = !dispute.closed && dispute.status !== "RESOLVED";

  // Reply state
  const [replyContent, setReplyContent] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Private Note state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Resolution Proposal Modal state
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposalType, setProposalType] = useState("ISSUE_FIXED");
  const [proposalExplanation, setProposalExplanation] = useState("");
  const [proposalFiles, setProposalFiles] = useState<File[]>([]);
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Resolve Own Complaint Modal state
  const [resolveOwnModalOpen, setResolveOwnModalOpen] = useState(false);
  const [resolveOwnAction, setResolveOwnAction] = useState<"RESOLVE" | "WITHDRAW">("RESOLVE");
  const [resolveOwnNotes, setResolveOwnNotes] = useState("");
  const [isSubmittingResolveOwn, setIsSubmittingResolveOwn] = useState(false);

  // Feedback notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Reply
  async function handleSendReply(e: FormEvent) {
    e.preventDefault();
    if (!replyContent.trim() && replyFiles.length === 0) return;

    setIsSubmittingReply(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const body = new FormData();
      body.set("content", replyContent);
      replyFiles.forEach((file) => body.append("evidence", file));

      const endpoint = dispute.responseRequired
        ? `/api/v1/host/disputes/${dispute.id}/response`
        : `/api/v1/host/disputes/${dispute.id}/replies`;

      const res = await fetch(endpoint, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to send reply");

      setReplyContent("");
      setReplyFiles([]);
      setSuccessMessage(
        dispute.responseRequired
          ? "Your requested response was submitted to Homyz Support."
          : "Your reply was sent to Homyz Support.",
      );
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit response.");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  // Handle Save Private Note
  async function handleSaveNote(e: FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setIsSavingNote(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const endpoint = editingNoteId
        ? `/api/v1/host/disputes/${dispute.id}/notes/${editingNoteId}`
        : `/api/v1/host/disputes/${dispute.id}/notes`;

      const res = await fetch(endpoint, {
        method: editingNoteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to save private note.");

      const wasEditing = Boolean(editingNoteId);
      setNoteModalOpen(false);
      setEditingNoteId(null);
      setNoteContent("");
      setSuccessMessage(wasEditing ? "Private note updated." : "Private note saved. Only you can view it.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save note.");
    } finally {
      setIsSavingNote(false);
    }
  }

  // Handle Delete Note
  async function handleDeleteNote(noteId: string) {
    if (!window.confirm("Are you sure you want to delete this private note?")) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/host/disputes/${dispute.id}/notes/${noteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to delete note.");

      setSuccessMessage("Private note deleted.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete note.");
    }
  }

  // Handle Propose Resolution
  async function handleProposeResolution(e: FormEvent) {
    e.preventDefault();
    if (!proposalExplanation.trim()) return;

    setIsSubmittingProposal(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const body = new FormData();
      body.set("proposalType", proposalType);
      body.set("explanation", proposalExplanation.trim());
      proposalFiles.forEach((file) => body.append("evidence", file));

      const res = await fetch(`/api/v1/host/disputes/${dispute.id}/propose-resolution`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to submit resolution proposal.");

      setProposeModalOpen(false);
      setProposalExplanation("");
      setProposalFiles([]);
      setSuccessMessage("Resolution proposal submitted for review by Homyz Support.");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit proposal.");
    } finally {
      setIsSubmittingProposal(false);
    }
  }

  // Handle Resolve Own Complaint
  async function handleResolveOwnComplaint(e: FormEvent) {
    e.preventDefault();
    setIsSubmittingResolveOwn(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/host/disputes/${dispute.id}/resolve-own`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: resolveOwnAction,
          notes: resolveOwnNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update complaint status.");

      setResolveOwnModalOpen(false);
      setResolveOwnNotes("");
      setSuccessMessage(
        resolveOwnAction === "RESOLVE"
          ? "Your dispute complaint has been marked as resolved."
          : "Your dispute complaint has been successfully withdrawn.",
      );
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update case.");
    } finally {
      setIsSubmittingResolveOwn(false);
    }
  }

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: "overview", label: "Case Overview" },
    { id: "conversation", label: "Conversation", count: dispute.infoRequests.length + dispute.replies.length },
    { id: "notes", label: "My Notes", count: dispute.privateNotes.length },
    { id: "evidence", label: "Evidence", count: dispute.evidence.length },
    { id: "activity", label: "Activity Timeline", count: dispute.timeline.length },
    { id: "resolution", label: "Resolution", count: dispute.resolutionProposals.length },
  ];

  return (
    <div className="w-full space-y-8 font-sans text-[#1F1F1F]">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-[#727272]">
        <Link
          href="/host/resolution-center"
          className="font-medium text-[#1F1F1F] underline underline-offset-4 hover:text-[#555] transition-colors"
        >
          ← Resolution Center
        </Link>
        <span className="text-zinc-300">/</span>
        <span>Case Details</span>
        <span className="text-zinc-300">/</span>
        <span className="font-mono text-zinc-700 font-semibold">#{dispute.caseReference}</span>
      </nav>

      {/* Main Header with Actions */}
      <header className="flex flex-col gap-5 border-b border-zinc-200 pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Status & Category Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm sm:text-base font-bold text-[#1F1F1F]">
              Case #{dispute.caseReference}
            </span>
            {dispute.responseRequired && (
              <span className="rounded-full bg-amber-100 border border-amber-300 px-3.5 py-1 text-xs font-semibold text-amber-900 shadow-2xs">
                Response Required
              </span>
            )}
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-semibold ${
                dispute.status === "RESOLVED"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-blue-100 text-blue-800 border border-blue-200"
              }`}
            >
              {dispute.disputeWorkflowStatus.replaceAll("_", " ")}
            </span>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase text-zinc-700">
              {dispute.severity} Priority
            </span>
            <span className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
              Reported by {dispute.reporterRole}
            </span>
          </div>

          {/* Title */}
          <h1 className="pt-1">
            {dispute.category.replaceAll("_", " ")}
          </h1>

          {/* Subtitle / Metadata */}
          <p className="text-xs sm:text-sm text-[#727272] leading-relaxed">
            {listing?.title ? <span className="font-medium text-[#1F1F1F]">{listing.title}</span> : null}
            {booking?.id ? ` · Booking #${booking.id.slice(0, 12)}` : ""}
            {` · Opened on ${formatDate(dispute.createdAt)}`}
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
          {isOpen && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("conversation");
                  const elem = document.getElementById("reply-composer");
                  if (elem) elem.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1F1F1F] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-black shadow-xs cursor-pointer"
              >
                <span>{dispute.responseRequired ? "Submit Response" : "Reply to Support"}</span>
              </button>

              <button
                type="button"
                onClick={() => setProposeModalOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] transition-all hover:border-[#1F1F1F] shadow-xs cursor-pointer"
              >
                <span>Propose Resolution</span>
              </button>

              {dispute.isReporter && (
                <button
                  type="button"
                  onClick={() => setResolveOwnModalOpen(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 transition-all hover:bg-emerald-100 shadow-xs cursor-pointer"
                >
                  <span>Resolve Complaint</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingNoteId(null);
              setNoteContent("");
              setNoteModalOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] transition-all hover:border-[#1F1F1F] shadow-xs cursor-pointer"
          >
            <span>+ Add Note</span>
          </button>
        </div>
      </header>

      {/* Action Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 text-sm font-medium text-emerald-900 shadow-xs">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="font-bold text-emerald-700 hover:text-emerald-950 p-1">
            ✕
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 text-sm font-medium text-red-900 shadow-xs">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold text-red-700 hover:text-red-950 p-1">
            ✕
          </button>
        </div>
      )}

      {/* Main 2-Column Responsive Layout (65-70% Content / 30-35% Sidebar) */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* LEFT COLUMN: Tabs & Main Content */}
        <div className="space-y-6 min-w-0">
          {/* Navigation Tabs Bar */}
          <div className="flex gap-2.5 overflow-x-auto border-b border-zinc-200 pb-3 scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#1F1F1F] text-white shadow-xs"
                    : "border border-zinc-200 bg-white text-[#555] hover:border-zinc-400 hover:text-[#1F1F1F]"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      activeTab === tab.id ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Response Required Alert Card if applicable */}
              {dispute.responseRequired && isOpen && (
                <div className="rounded-[20px] border border-amber-300 bg-amber-50/90 p-6 sm:p-7 shadow-xs">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold text-sm">
                      !
                    </span>
                    <div className="flex-1 space-y-1">
                      <h3 className="text-base font-bold text-amber-950">Action Required: Support Inquiry</h3>
                      <p className="text-sm text-amber-900 leading-relaxed">
                        Homyz Support has requested information from you regarding this case. Please review the inquiry in the Conversation tab and submit your response.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab("conversation")}
                          className="rounded-full bg-amber-900 px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-black transition-colors cursor-pointer"
                        >
                          Go to Response Inquiry →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Complaint Description Card */}
              <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                    Complaint &amp; Issue Details
                  </h2>
                  <span className="text-xs sm:text-sm font-medium text-[#727272]">
                    Reported by {dispute.reporterRole}
                  </span>
                </div>
                <div className="mt-5">
                  <p className="text-sm sm:text-base leading-relaxed text-[#1F1F1F] whitespace-pre-wrap">
                    {dispute.description || "No additional written statement was provided."}
                  </p>
                </div>
              </section>

              {/* Official Case Decision (if resolved) */}
              {dispute.resolution && (
                <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/40 p-6 sm:p-7 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Official Case Decision
                      </span>
                      <h2 className="text-lg sm:text-xl font-bold text-emerald-950 mt-0.5">
                        {dispute.resolution.decisionCategory.replaceAll("_", " ")}
                      </h2>
                    </div>
                    <span className="self-start sm:self-center rounded-full bg-emerald-100 border border-emerald-200 px-3.5 py-1 text-xs font-semibold text-emerald-800">
                      Resolved on {formatDate(dispute.resolution.resolvedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-1.5">
                      Decision Explanation &amp; Terms
                    </span>
                    <p className="text-sm sm:text-base leading-relaxed text-emerald-950 whitespace-pre-wrap">
                      {dispute.resolution.explanation}
                    </p>
                  </div>
                </section>
              )}

              {/* Quick Actions Panel */}
              {isOpen && (
                <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                  <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F] mb-4">
                    Available Host Case Actions
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div
                      onClick={() => setActiveTab("conversation")}
                      className="cursor-pointer rounded-2xl border border-zinc-200 p-5 hover:border-[#1F1F1F] transition-all bg-zinc-50/50 hover:bg-zinc-50"
                    >
                      <h4 className="text-sm sm:text-base font-bold text-[#1F1F1F]">Send Reply</h4>
                      <p className="text-xs text-[#727272] mt-1.5 leading-relaxed">
                        Submit official statements or responses directly to Homyz Support.
                      </p>
                    </div>
                    <div
                      onClick={() => setProposeModalOpen(true)}
                      className="cursor-pointer rounded-2xl border border-zinc-200 p-5 hover:border-[#1F1F1F] transition-all bg-zinc-50/50 hover:bg-zinc-50"
                    >
                      <h4 className="text-sm sm:text-base font-bold text-[#1F1F1F]">Propose Settlement</h4>
                      <p className="text-xs text-[#727272] mt-1.5 leading-relaxed">
                        Offer a mutual resolution, replacement, or on-site remedy for review.
                      </p>
                    </div>
                    <div
                      onClick={() => {
                        setEditingNoteId(null);
                        setNoteContent("");
                        setNoteModalOpen(true);
                      }}
                      className="cursor-pointer rounded-2xl border border-zinc-200 p-5 hover:border-[#1F1F1F] transition-all bg-zinc-50/50 hover:bg-zinc-50"
                    >
                      <h4 className="text-sm sm:text-base font-bold text-[#1F1F1F]">Private Note</h4>
                      <p className="text-xs text-[#727272] mt-1.5 leading-relaxed">
                        Record private notes and reminders visible only to you.
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* TAB 2: CONVERSATION */}
          {activeTab === "conversation" && (
            <div className="space-y-6">
              <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                    Support Communications
                  </h2>
                  <span className="text-xs sm:text-sm text-[#727272]">Visible to Homyz Support</span>
                </div>

                {dispute.infoRequests.length === 0 && dispute.replies.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#727272] italic">
                    No communication messages exchanged yet.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {/* Information requests from Admin/Support */}
                    {dispute.infoRequests.map((request) => (
                      <article
                        key={request.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold text-amber-950 flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                            Homyz Support Request
                          </span>
                          <span
                            className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                              request.status === "PENDING_RESPONSE"
                                ? "bg-amber-200 text-amber-900"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {request.status === "PENDING_RESPONSE" ? "Response Required" : "Responded"}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-[#1F1F1F] whitespace-pre-wrap leading-relaxed">
                          {request.message}
                        </p>
                        <p className="text-xs text-[#727272]">{formatDate(request.createdAt, true)}</p>
                      </article>
                    ))}

                    {/* Host Replies */}
                    {dispute.replies.map((reply) => (
                      <article
                        key={reply.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold text-[#1F1F1F] flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#1F1F1F]" />
                            Your Host Reply
                          </span>
                          <span className="text-xs text-[#727272]">Sent to Homyz Support</span>
                        </div>
                        <p className="text-sm sm:text-base text-[#1F1F1F] whitespace-pre-wrap leading-relaxed">
                          {reply.content || "Evidence files submitted."}
                        </p>
                        <div className="flex items-center justify-between text-xs text-[#727272]">
                          <span>{formatDate(reply.createdAt, true)}</span>
                          {reply.evidenceIds.length > 0 && (
                            <span className="font-medium">{reply.evidenceIds.length} file(s) attached</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Message Composer (if case is open) */}
              {isOpen && (
                <section
                  id="reply-composer"
                  className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs space-y-4"
                >
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                      {dispute.responseRequired ? "Submit Requested Information" : "Send Official Reply to Support"}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-[#727272]">
                      This response is recorded in the official investigation record and shared with Homyz Support.
                    </p>
                  </div>

                  <form onSubmit={handleSendReply} className="space-y-4">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={5}
                      maxLength={4000}
                      placeholder="Type your official message or response details..."
                      className="w-full rounded-2xl border border-zinc-300 p-4 text-sm sm:text-base outline-none focus:border-[#1F1F1F] min-h-[140px]"
                    />

                    {/* Evidence Attachment */}
                    <div>
                      <label className="block rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-[#555] hover:border-zinc-400 cursor-pointer">
                        <span className="font-semibold block text-[#1F1F1F]">Attach Evidence (Optional)</span>
                        <span className="text-xs text-[#727272]">Up to 5 files (JPG, PNG, WEBP, or PDF, max 15MB each)</span>
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => setReplyFiles(Array.from(e.target.files || []).slice(0, 5))}
                          className="mt-2 block w-full text-xs"
                        />
                      </label>
                      {replyFiles.length > 0 && (
                        <p className="mt-2 text-xs text-zinc-700 font-medium">
                          Selected files: {replyFiles.map((f) => f.name).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingReply || (!replyContent.trim() && replyFiles.length === 0)}
                        className="min-h-11 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingReply
                          ? "Sending..."
                          : dispute.responseRequired
                          ? "Submit Response"
                          : "Send Reply"}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </div>
          )}

          {/* TAB 3: MY NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-6">
              <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                      My Private Case Notes ({dispute.privateNotes.length})
                    </h2>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mt-1.5">
                      🔒 Private Note — Not shared with Guest or Admin
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setNoteContent("");
                      setNoteModalOpen(true);
                    }}
                    className="self-start sm:self-auto rounded-full bg-[#1F1F1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black transition-all cursor-pointer"
                  >
                    + Add Note
                  </button>
                </div>

                {dispute.privateNotes.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#727272] space-y-1">
                    <p className="italic">You haven't saved any private notes for this case.</p>
                    <p className="text-xs text-zinc-400">Keep personal reminders, inspection findings, or timeline notes for your records.</p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {dispute.privateNotes.map((note) => (
                      <article
                        key={note.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 sm:p-6 space-y-3 transition-all hover:border-zinc-300"
                      >
                        <p className="text-sm sm:text-base text-[#1F1F1F] whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-zinc-200/60 text-xs text-[#727272]">
                          <span>
                            {note.updatedAt !== note.createdAt
                              ? `Updated on ${formatDate(note.updatedAt, true)}`
                              : `Created on ${formatDate(note.createdAt, true)}`}
                          </span>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setNoteContent(note.content);
                                setNoteModalOpen(true);
                              }}
                              className="font-semibold text-[#1F1F1F] underline underline-offset-2 hover:text-[#555] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              className="font-semibold text-red-600 underline underline-offset-2 hover:text-red-800 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 4: EVIDENCE */}
          {activeTab === "evidence" && (
            <div className="space-y-6">
              <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                    Uploaded Case Evidence ({dispute.evidence.length})
                  </h2>
                  <span className="text-xs sm:text-sm text-[#727272]">Secure platform storage</span>
                </div>

                {dispute.evidence.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#727272] italic">
                    No evidence files uploaded by you yet. Attach photos or documents when replying or proposing resolutions.
                  </div>
                ) : (
                  <div className="mt-6 grid sm:grid-cols-2 gap-4">
                    {dispute.evidence.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-zinc-200 p-5 flex items-center justify-between gap-3 bg-zinc-50/50 hover:border-zinc-400 transition-all"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-semibold text-[#1F1F1F] truncate">{item.fileName}</p>
                          <p className="text-xs text-[#727272]">Uploaded {formatDate(item.createdAt)}</p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-white border border-zinc-300 px-4 py-2 text-xs sm:text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-100 shrink-0 transition-colors"
                        >
                          View / Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 5: ACTIVITY TIMELINE */}
          {activeTab === "activity" && (
            <div className="space-y-6">
              <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                    Activity Timeline
                  </h2>
                  <span className="text-xs sm:text-sm text-[#727272]">Official audit history</span>
                </div>

                {dispute.timeline.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#727272] italic">
                    No milestone events recorded yet.
                  </div>
                ) : (
                  <ol className="mt-6 space-y-6 border-l-2 border-zinc-200 pl-5 ml-3">
                    {dispute.timeline.map((event) => (
                      <li key={event.id} className="relative pl-3">
                        <span className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#1F1F1F]" />
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm sm:text-base font-bold text-[#1F1F1F]">{event.title}</h4>
                            <span className="text-xs text-[#727272]">{formatDate(event.timestamp, true)}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#555] leading-relaxed">{event.description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}

          {/* TAB 6: RESOLUTION */}
          {activeTab === "resolution" && (
            <div className="space-y-6">
              {/* Official Final Decision */}
              {dispute.resolution ? (
                <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/50 p-6 sm:p-7 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Final Resolution Decision
                      </span>
                      <h2 className="text-lg sm:text-xl font-bold text-emerald-950 mt-0.5">
                        {dispute.resolution.decisionCategory.replaceAll("_", " ")}
                      </h2>
                    </div>
                    <span className="self-start sm:self-center rounded-full bg-emerald-100 border border-emerald-200 px-3.5 py-1 text-xs font-semibold text-emerald-800">
                      Resolved {formatDate(dispute.resolution.resolvedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-1.5">
                      Official Decision Explanation
                    </span>
                    <p className="text-sm sm:text-base leading-relaxed text-emerald-950 whitespace-pre-wrap">
                      {dispute.resolution.explanation}
                    </p>
                  </div>
                </section>
              ) : (
                <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">Dispute Investigation Active</h3>
                  <p className="text-sm text-[#727272] leading-relaxed">
                    This case is currently under review by Homyz Support. As a host, you can propose a mutual resolution or mark your own complaint as resolved.
                  </p>
                  {isOpen && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setProposeModalOpen(true)}
                        className="rounded-full bg-[#1F1F1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black transition-all cursor-pointer"
                      >
                        Propose Resolution Outcome
                      </button>
                      {dispute.isReporter && (
                        <button
                          type="button"
                          onClick={() => setResolveOwnModalOpen(true)}
                          className="rounded-full border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
                        >
                          Resolve / Withdraw My Complaint
                        </button>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Resolution Proposals Tracking */}
              <section className="rounded-[20px] border border-zinc-200 bg-white p-6 sm:p-7 shadow-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <h2 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                    Your Submitted Proposals ({dispute.resolutionProposals.length})
                  </h2>
                </div>

                {dispute.resolutionProposals.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#727272] italic">
                    No resolution proposals submitted yet.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {dispute.resolutionProposals.map((proposal) => (
                      <article
                        key={proposal.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:p-6 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold text-[#1F1F1F]">
                            Proposal: {proposal.proposalType.replaceAll("_", " ")}
                          </span>
                          <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-xs font-semibold">
                            {proposal.status}
                          </span>
                        </div>
                        <p className="text-sm sm:text-base text-[#1F1F1F] whitespace-pre-wrap leading-relaxed">
                          {proposal.explanation}
                        </p>
                        <p className="text-xs text-[#727272]">{formatDate(proposal.createdAt, true)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky Case Information Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          {/* Section 1: Case Summary */}
          <section className="rounded-[20px] border border-zinc-200 bg-white p-6 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-zinc-100 pb-3">
              Case Summary
            </h3>
            <dl className="mt-4 divide-y divide-zinc-100 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#727272]">Case Status</dt>
                <dd className="font-semibold text-[#1F1F1F]">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      dispute.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {dispute.disputeWorkflowStatus.replaceAll("_", " ")}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#727272]">Priority</dt>
                <dd className="font-semibold uppercase text-[#1F1F1F]">{dispute.severity}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#727272]">Issue Category</dt>
                <dd className="font-semibold text-[#1F1F1F]">
                  {dispute.category.replaceAll("_", " ")}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#727272]">Case Reviewer</dt>
                <dd className="font-medium text-[#1F1F1F]">
                  {dispute.hasAssignedReviewer ? "Assigned (Support)" : "Triage Queue"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#727272]">Date Filed</dt>
                <dd className="text-[#555]">{formatDate(dispute.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[#727272]">Last Updated</dt>
                <dd className="text-[#555]">{formatDate(dispute.updatedAt, true)}</dd>
              </div>
            </dl>
          </section>

          {/* Section 2: Reservation & Property Details */}
          <section className="rounded-[20px] border border-zinc-200 bg-white p-6 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-zinc-100 pb-3">
              Reservation Details
            </h3>

            {listing && (
              <div className="mt-4 flex items-start gap-3.5">
                {listing.photos?.[0] ? (
                  <div className="relative h-14 w-18 shrink-0 overflow-hidden rounded-xl border border-zinc-200">
                    <Image
                      src={listing.photos[0]}
                      alt={listing.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-[#1F1F1F] leading-snug line-clamp-2">
                    {listing.title}
                  </p>
                  <p className="text-xs text-[#727272] mt-0.5">{listing.city || "Saudi Arabia"}</p>
                </div>
              </div>
            )}

            {booking && (
              <div className="mt-4 space-y-3 text-sm pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <span className="text-[#727272]">Booking Code:</span>
                  <span className="font-mono font-medium text-[#1F1F1F]">
                    #{booking.id.slice(0, 10).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#727272]">Check-in:</span>
                  <span className="font-medium text-[#1F1F1F]">{formatDate(booking.startDate)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#727272]">Check-out:</span>
                  <span className="font-medium text-[#1F1F1F]">{formatDate(booking.endDate)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#727272]">Guests:</span>
                  <span className="font-medium text-[#1F1F1F]">{booking.guests} guest(s)</span>
                </div>

                {typeof booking.totalPrice === "number" && (
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <span className="text-[#727272]">Total Booking:</span>
                    <span className="font-bold text-base text-[#1F1F1F]">
                      {formatPrice(booking.totalPrice / 100, booking.currency || "SAR")}
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <Link
                    href={`/host/bookings/${booking.id}`}
                    className="flex min-h-11 w-full items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white transition-colors"
                  >
                    View Booking Details →
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Guest Information */}
          {booking?.user && (
            <section className="rounded-[20px] border border-zinc-200 bg-white p-6 shadow-xs">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-zinc-100 pb-3">
                Guest Information
              </h3>
              <div className="mt-4 flex items-center gap-3.5">
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200">
                  {booking.user.image ? (
                    <Image src={booking.user.image} alt={booking.user.name || "Guest"} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-zinc-500">
                      {booking.user.name?.charAt(0) || "G"}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-medium text-[#1F1F1F] truncate">
                    {booking.user.name || "Guest"}
                  </p>
                  <p className="text-xs text-[#727272]">Booking Guest</p>
                </div>
              </div>
            </section>
          )}

          {/* Section 4: Privacy & Security Policy Badge */}
          <section className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 text-xs text-[#727272] space-y-1.5 leading-relaxed">
            <p className="font-semibold text-zinc-900 flex items-center gap-1.5">
              <span>🛡️</span> Security &amp; Privacy Notice
            </p>
            <p>
              Your private notes are never shared with Guests or Homyz Support. Official replies and evidence files are reviewed only by authorized resolution administrators.
            </p>
          </section>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT PRIVATE NOTE                        */}
      {/* ======================================================== */}
      {noteModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[20px] bg-white border border-zinc-200 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
                  {editingNoteId ? "Edit Private Note" : "Add Private Note"}
                </h3>
                <span className="text-xs text-emerald-800 font-medium">
                  🔒 Visible only to you (Host)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalOpen(false)}
                className="font-bold text-zinc-500 hover:text-black p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="Write your private note or reminder here..."
                className="w-full rounded-2xl border border-zinc-300 p-4 text-sm sm:text-base outline-none focus:border-[#1F1F1F]"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="min-h-11 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNote || !noteContent.trim()}
                  className="min-h-11 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSavingNote ? "Saving..." : editingNoteId ? "Update Note" : "Save Note"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: PROPOSE RESOLUTION OUTCOME                      */}
      {/* ======================================================== */}
      {proposeModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-[20px] bg-white border border-zinc-200 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">Propose Resolution Outcome</h3>
                <p className="text-xs text-[#727272]">Submit a formal settlement proposal for Support review.</p>
              </div>
              <button
                type="button"
                onClick={() => setProposeModalOpen(false)}
                className="font-bold text-zinc-500 hover:text-black p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProposeResolution} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1.5">
                  Proposal Type
                </label>
                <select
                  value={proposalType}
                  onChange={(e) => setProposalType(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-3 text-sm bg-white outline-none focus:border-[#1F1F1F]"
                >
                  <option value="ISSUE_FIXED">Issue Fixed On-Site / Remedied</option>
                  <option value="REPLACEMENT_OFFERED">Alternative Accommodation / Item Offered</option>
                  <option value="EXPLANATION_PROVIDED">Explanation &amp; Apology Provided</option>
                  <option value="REFUND_REQUESTED">Refund Requested for Guest Review</option>
                  <option value="MUTUAL_SETTLEMENT">Mutual Settlement / Agreement</option>
                  <option value="OTHER">Other Resolution</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1.5">
                  Explanation &amp; Terms
                </label>
                <textarea
                  value={proposalExplanation}
                  onChange={(e) => setProposalExplanation(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Explain what was offered, completed, or agreed upon..."
                  className="w-full rounded-2xl border border-zinc-300 p-4 text-sm sm:text-base outline-none focus:border-[#1F1F1F]"
                />
              </div>

              <div>
                <label className="block rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-[#555] hover:border-zinc-400 cursor-pointer">
                  <span className="font-semibold block text-[#1F1F1F]">Attach Supporting Evidence (Optional)</span>
                  <span className="text-xs text-[#727272]">Photos, maintenance receipts, messages (up to 5 files)</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setProposalFiles(Array.from(e.target.files || []).slice(0, 5))}
                    className="mt-2 block w-full text-xs"
                  />
                </label>
                {proposalFiles.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-700 font-medium">
                    Selected files: {proposalFiles.map((f) => f.name).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProposeModalOpen(false)}
                  className="min-h-11 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProposal || !proposalExplanation.trim()}
                  className="min-h-11 rounded-full bg-[#1F1F1F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingProposal ? "Submitting..." : "Submit Proposal"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RESOLVE OR WITHDRAW OWN COMPLAINT              */}
      {/* ======================================================== */}
      {resolveOwnModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[20px] bg-white border border-zinc-200 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">Resolve Your Dispute Complaint</h3>
                <p className="text-xs text-[#727272]">As the reporting host, you can resolve or withdraw your case.</p>
              </div>
              <button
                type="button"
                onClick={() => setResolveOwnModalOpen(false)}
                className="font-bold text-zinc-500 hover:text-black p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResolveOwnComplaint} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-2">
                  Action
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResolveOwnAction("RESOLVE")}
                    className={`rounded-xl border p-3.5 text-sm font-semibold text-center transition-all cursor-pointer ${
                      resolveOwnAction === "RESOLVE"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs"
                        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Mark Resolved
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveOwnAction("WITHDRAW")}
                    className={`rounded-xl border p-3.5 text-sm font-semibold text-center transition-all cursor-pointer ${
                      resolveOwnAction === "WITHDRAW"
                        ? "border-zinc-800 bg-zinc-100 text-zinc-900 shadow-xs"
                        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Withdraw Case
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1F1F1F] mb-1.5">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  value={resolveOwnNotes}
                  onChange={(e) => setResolveOwnNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Reason for resolving or withdrawing..."
                  className="w-full rounded-2xl border border-zinc-300 p-4 text-sm outline-none focus:border-[#1F1F1F]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolveOwnModalOpen(false)}
                  className="min-h-11 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolveOwn}
                  className="min-h-11 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingResolveOwn ? "Updating..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
