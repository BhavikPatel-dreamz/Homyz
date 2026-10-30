"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";

type Status =
  | "OPEN"
  | "IN_REVIEW"
  | "WAITING_FOR_GUEST"
  | "WAITING_FOR_HOST"
  | "WAITING_FOR_ADMIN"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "ESCALATED";

type GuestCaseTab = "all" | "action_needed" | "under_review" | "resolved";

function guestTab(value: string | null): GuestCaseTab {
  return value === "action_needed" || value === "under_review" || value === "resolved" ? value : "all";
}

function tabStatus(tab: GuestCaseTab): string {
  if (tab === "action_needed") return "WAITING_FOR_GUEST";
  if (tab === "under_review") return "IN_REVIEW";
  if (tab === "resolved") return "RESOLVED";
  return "";
}

type Taxonomy = {
  value: string;
  label: string;
  issueTypes: { value: string; label: string }[];
};

type CaseMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id?: string;
    name: string | null;
    image?: string | null;
    role?: string;
  };
};

type CaseEvidence = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  scanStatus?: string;
  uploader?: {
    id?: string;
    name?: string | null;
  } | null;
};

type CaseEvent = {
  id: string;
  eventType: string;
  description: string | null;
  createdAt: string;
  actor?: {
    id?: string;
    name?: string | null;
  } | null;
};

type Case = {
  id: string;
  caseNumber: string;
  category: string;
  issueType: string | null;
  subject: string;
  description?: string | null;
  status: Status;
  priority: string;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
  booking?: {
    id: string;
    submissionId?: string | null;
    startDate?: string;
    endDate?: string;
    status?: string;
  } | null;
  listing?: {
    id: string;
    title?: string | null;
    city?: string | null;
    photos?: string[];
  } | null;
  messages?: CaseMessage[];
  evidence?: CaseEvidence[];
  events?: CaseEvent[];
};

type Booking = {
  id: string;
  submissionId?: string | null;
  startDate: string;
  endDate: string;
  listing?: {
    title?: string | null;
    photos?: string[];
  } | null;
};

type SupportMetrics = {
  all: number;
  actionNeeded: number;
  underReview: number;
  resolved: number;
};

const labels: Record<Status, string> = {
  OPEN: "Open",
  IN_REVIEW: "Under review",
  WAITING_FOR_GUEST: "Action needed",
  WAITING_FOR_HOST: "In negotiation",
  WAITING_FOR_ADMIN: "Under review",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  ESCALATED: "Escalated",
};

const mutableStatuses = new Set<Status>([
  "OPEN",
  "IN_REVIEW",
  "WAITING_FOR_GUEST",
  "WAITING_FOR_ADMIN",
  "REOPENED",
  "ESCALATED",
]);

function formatCaseDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBytes(value: number) {
  if (value < 1048576) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  return `${(value / 1048576).toFixed(1)} MB`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || "Support service is temporarily unavailable.");
  }
  return payload.data as T;
}

function getStatusBadge(status: Status) {
  if (status === "WAITING_FOR_GUEST") {
    return "bg-rose-50 text-rose-700 border border-rose-200";
  }
  if (status === "RESOLVED") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (status === "CLOSED") {
    return "bg-zinc-100 text-zinc-600 border border-zinc-200";
  }
  if (status === "WAITING_FOR_HOST") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (status === "ESCALATED") {
    return "bg-amber-50 text-amber-800 border border-amber-200";
  }
  return "bg-blue-50 text-blue-700 border border-blue-200";
}

function getInitials(name?: string | null, fallback = "U") {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function humanEventDescription(eventType: string, description: string | null) {
  if (description && description.trim()) return description;
  switch (eventType) {
    case "CASE_CREATED":
    case "SUPPORT_CASE_CREATED":
      return "Case created";
    case "GUEST_REPLIED":
    case "GUEST_MESSAGE_SENT":
      return "Guest reply added";
    case "SUPPORT_REPLIED":
    case "ADMIN_REPLIED":
      return "Support reply added";
    case "STATUS_CHANGED":
    case "SUPPORT_CASE_STATUS_UPDATED":
      return "Status updated";
    case "EVIDENCE_SUBMITTED":
    case "SUPPORT_EVIDENCE_UPLOADED":
      return "Evidence submitted";
    case "CASE_ESCALATED":
      return "Case escalated for review";
    case "CASE_RESOLVED":
      return "Case resolved";
    case "CASE_CLOSED":
      return "Case closed";
    case "CASE_REOPENED":
      return "Case reopened";
    default:
      return eventType.toLowerCase().replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
  }
}

/**
 * GuestCaseDetailPanel
 * Full-width detail view for the selected support case, housing dedicated tab panels
 * for Conversation, Evidence, and Activity history.
 */
export function GuestCaseDetailPanel({
  caseData,
  onBack,
  onRefresh,
  onMessageSent,
}: {
  caseData: Case;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onMessageSent?: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"conversation" | "evidence" | "activity">("conversation");
  const [replyText, setReplyText] = useState("");
  const [stagedAttachment, setStagedAttachment] = useState<File | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [visibleEventsCount, setVisibleEventsCount] = useState(10);
  const replyKey = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCaseMutable = mutableStatuses.has(caseData.status);

  const getNextActionMessage = () => {
    switch (caseData.status) {
      case "WAITING_FOR_GUEST":
        return "Support needs additional information or evidence from you to proceed with this request.";
      case "IN_REVIEW":
        return "StayElite Support is reviewing your request and will follow up shortly.";
      case "WAITING_FOR_ADMIN":
        return "Your update has been received. StayElite Support is reviewing your details.";
      case "WAITING_FOR_HOST":
        return "Support is coordinating with the property host regarding your inquiry.";
      case "ESCALATED":
        return "Your request has been escalated to senior support for detailed review.";
      case "RESOLVED":
        return "This support request has been marked as resolved. If you need further assistance, please contact support.";
      case "CLOSED":
        return "This support request has been closed. You may create a new request if needed.";
      default:
        return "StayElite Support is handling your request.";
    }
  };

  async function handleSendReply(e: FormEvent) {
    e.preventDefault();
    if ((!replyText.trim() && !stagedAttachment) || sendingReply) return;
    setActionError(null);
    setSendingReply(true);

    replyKey.current ??= globalThis.crypto?.randomUUID?.() || `reply-${Date.now()}-${Math.random()}`;

    try {
      // If a file is staged with the message, upload it as case evidence first
      if (stagedAttachment) {
        const formData = new FormData();
        formData.set("file", stagedAttachment);
        await api(`/api/v1/support/cases/${caseData.id}/evidence/upload`, {
          method: "POST",
          body: formData,
        });
      }

      const content = stagedAttachment
        ? replyText.trim()
          ? `${replyText.trim()}\n\n[Attached: ${stagedAttachment.name}]`
          : `[Attached: ${stagedAttachment.name}]`
        : replyText.trim();

      await api(`/api/v1/support/cases/${caseData.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          idempotencyKey: replyKey.current,
        }),
      });

      replyKey.current = null;
      setReplyText("");
      setStagedAttachment(null);
      await onRefresh();
      onMessageSent?.();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleEvidenceUpload(file?: File) {
    if (!file || uploadingEvidence) return;
    setActionError(null);
    setUploadingEvidence(true);

    try {
      const formData = new FormData();
      formData.set("file", file);

      await api(`/api/v1/support/cases/${caseData.id}/evidence/upload`, {
        method: "POST",
        body: formData,
      });

      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to upload evidence document.");
    } finally {
      setUploadingEvidence(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const events = caseData.events || [];
  const visibleEvents = events.slice(0, visibleEventsCount);

  return (
    <article className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to requests
        </button>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(caseData.status)}`}>
            {labels[caseData.status] || caseData.status}
          </span>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-normal text-red-800">
          {actionError}
        </div>
      )}

      {/* Case Header & Overview */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-medium text-zinc-500">Case #{caseData.caseNumber}</p>
          <h2 className="text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">{caseData.subject}</h2>
        </div>

        {/* What's Happening Next contextual box */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs sm:text-sm text-blue-900 flex items-start gap-3">
          <svg className="size-5 shrink-0 text-blue-600 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="space-y-0.5">
            <p className="font-medium">What&apos;s happening next</p>
            <p className="font-normal text-blue-800/90 leading-relaxed">{getNextActionMessage()}</p>
          </div>
        </div>

        {/* Case Description */}
        {caseData.description && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-zinc-500">Original issue description</h3>
            <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-xs sm:text-sm font-normal text-zinc-800 leading-relaxed border border-zinc-100">
              {caseData.description}
            </p>
          </div>
        )}

        {/* 4 Metadata Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-1">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span>Category</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">
              {caseData.category.replaceAll("_", " ")}
              {caseData.issueType ? ` · ${caseData.issueType.replaceAll("_", " ")}` : ""}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Related booking</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">
              {caseData.booking?.id ? (
                <span className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                  #{caseData.booking.submissionId || caseData.booking.id.slice(0, 10)}
                  <svg className="size-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
              ) : (
                <span className="text-zinc-500 font-normal">Not linked</span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Created</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">{formatCaseDate(caseData.createdAt)}</p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 10" />
              </svg>
              <span>Last activity</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">{formatCaseDate(caseData.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Tabs and Tab Content Container */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden">
        {/* Tabs Row */}
        <div className="border-b border-zinc-200 px-5 sm:px-7 bg-zinc-50/50">
          <nav
            role="tablist"
            aria-label="Support Case Detail Tabs"
            className="-mb-px flex gap-8 text-sm font-medium"
          >
            <button
              id="tab-conversation"
              type="button"
              role="tab"
              aria-selected={detailTab === "conversation"}
              aria-controls="tabpanel-conversation"
              onClick={() => setDetailTab("conversation")}
              className={`flex items-center gap-2 border-b-2 py-3.5 text-xs sm:text-sm font-medium transition-colors ${
                detailTab === "conversation"
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
              }`}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Conversation ({caseData.messages?.length || 0})
            </button>

            <button
              id="tab-evidence"
              type="button"
              role="tab"
              aria-selected={detailTab === "evidence"}
              aria-controls="tabpanel-evidence"
              onClick={() => setDetailTab("evidence")}
              className={`flex items-center gap-2 border-b-2 py-3.5 text-xs sm:text-sm font-medium transition-colors ${
                detailTab === "evidence"
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
              }`}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              Evidence ({caseData.evidence?.length || 0})
            </button>

            <button
              id="tab-activity"
              type="button"
              role="tab"
              aria-selected={detailTab === "activity"}
              aria-controls="tabpanel-activity"
              onClick={() => setDetailTab("activity")}
              className={`flex items-center gap-2 border-b-2 py-3.5 text-xs sm:text-sm font-medium transition-colors ${
                detailTab === "activity"
                  ? "border-zinc-950 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
              }`}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Activity
            </button>
          </nav>
        </div>

        {/* Dedicated Tab Panels (Mutually exclusive: Only one tab panel active at a time) */}
        <div className="p-5 sm:p-7">
          {/* TAB 1: CONVERSATION */}
          {detailTab === "conversation" && (
            <div
              id="tabpanel-conversation"
              role="tabpanel"
              aria-labelledby="tab-conversation"
              className="space-y-5 max-w-4xl"
            >
              <div className="flex flex-col space-y-4 max-h-[560px] overflow-y-auto pr-1">
                {(!caseData.messages || caseData.messages.length === 0) ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-12 text-center space-y-2">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                      <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-900">No messages yet</p>
                    <p className="text-xs text-zinc-500 font-normal max-w-sm mx-auto">
                      Support replies and follow-ups will appear here. Type a reply below if you have questions or updates.
                    </p>
                  </div>
                ) : (
                  caseData.messages.map((msg) => {
                    const isSupport = msg.sender.role === "ADMIN" || msg.sender.name === "StayElite Support";
                    const senderName = isSupport ? "StayElite Support" : msg.sender.name || "Guest";

                    return (
                      <div key={msg.id} className="flex items-start gap-3.5">
                        <div
                          className={`size-9 shrink-0 rounded-full flex items-center justify-center text-xs font-medium ${
                            isSupport
                              ? "bg-zinc-900 text-white"
                              : "bg-zinc-200 text-zinc-800"
                          }`}
                        >
                          {isSupport ? "S" : getInitials(senderName, "G")}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-900">
                              {senderName}
                              {!isSupport && " (Guest)"}
                            </span>
                            <span className="text-[11px] font-normal text-zinc-500">
                              {formatCaseDate(msg.createdAt)}
                            </span>
                          </div>
                          <div
                            className={`rounded-2xl p-4 text-xs sm:text-sm font-normal leading-relaxed ${
                              isSupport
                                ? "bg-blue-50/80 text-zinc-900 rounded-tl-none border border-blue-100"
                                : "bg-zinc-100 text-zinc-900 rounded-tl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              {isCaseMutable ? (
                <form onSubmit={handleSendReply} className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-2xs space-y-3">
                  {stagedAttachment && (
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700">
                      <div className="flex items-center gap-2 truncate">
                        <svg className="size-4 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span className="truncate font-medium">{stagedAttachment.name}</span>
                        <span className="text-zinc-500 font-normal">({formatBytes(stagedAttachment.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStagedAttachment(null)}
                        className="rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
                        title="Remove attachment"
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your message or reply..."
                    rows={3}
                    maxLength={10000}
                    className="w-full resize-none border-0 bg-transparent p-1 text-xs sm:text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                  />
                  <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5">
                    <div>
                      <input
                        ref={composerFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setStagedAttachment(file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={sendingReply}
                        onClick={() => composerFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50"
                        title="Attach file (JPEG, PNG, WebP, PDF up to 15MB)"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span>Attach file</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={sendingReply || (!replyText.trim() && !stagedAttachment)}
                      className="inline-flex min-h-9 items-center justify-center rounded-full bg-zinc-900 px-5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-40"
                    >
                      {sendingReply ? "Sending..." : "Send message"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center text-xs font-normal text-zinc-600">
                  This case is {labels[caseData.status].toLowerCase()}. Replies and evidence can no longer be added.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EVIDENCE */}
          {detailTab === "evidence" && (
            <div
              id="tabpanel-evidence"
              role="tabpanel"
              aria-labelledby="tab-evidence"
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-sm sm:text-base font-medium text-zinc-950">Evidence &amp; Documents</h3>
                  <p className="mt-0.5 text-xs font-normal text-zinc-500">
                    Files, screenshots, and receipts attached to this case. Formats: JPEG, PNG, WebP, PDF (up to 15 MB).
                  </p>
                </div>

                {isCaseMutable && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => void handleEvidenceUpload(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={uploadingEvidence}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-black transition-colors disabled:opacity-50 shadow-2xs"
                    >
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {uploadingEvidence ? "Uploading securely..." : "Upload evidence"}
                    </button>
                  </div>
                )}
              </div>

              {uploadingEvidence && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs font-normal text-blue-800 flex items-center gap-2">
                  <div className="size-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span>Uploading evidence and verifying scan status...</span>
                </div>
              )}

              {(!caseData.evidence || caseData.evidence.length === 0) ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-14 text-center space-y-3">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-medium text-zinc-950">No evidence or documents have been uploaded.</h4>
                  <p className="text-xs font-normal text-zinc-500 max-w-sm mx-auto">
                    You can upload photos, receipts, or documentation to help support review your request.
                  </p>
                  {isCaseMutable && (
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={uploadingEvidence}
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-black transition-colors"
                      >
                        Upload evidence
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {caseData.evidence.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-2xs hover:border-zinc-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 shrink-0 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-500">
                          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm font-medium text-zinc-900" title={entry.originalName}>
                            {entry.originalName}
                          </p>
                          <p className="text-[11px] font-normal text-zinc-500 mt-0.5">
                            {formatBytes(entry.sizeBytes)} · {formatCaseDate(entry.createdAt)}
                          </p>
                          {entry.uploader?.name && (
                            <p className="text-[10px] font-normal text-zinc-400 mt-0.5">
                              Uploaded by {entry.uploader.name}
                            </p>
                          )}
                        </div>
                      </div>

                      <a
                        href={`/api/v1/support/cases/${caseData.id}/evidence/${entry.id}?download=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition-colors shadow-2xs"
                        title="Download evidence"
                      >
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVITY */}
          {detailTab === "activity" && (
            <div
              id="tabpanel-activity"
              role="tabpanel"
              aria-labelledby="tab-activity"
              className="space-y-6 max-w-4xl"
            >
              <div className="border-b border-zinc-100 pb-4">
                <h3 className="text-sm sm:text-base font-medium text-zinc-950">Case Activity Timeline</h3>
                <p className="mt-0.5 text-xs font-normal text-zinc-500">
                  Chronological audit history of support case creation, participant messages, and review updates.
                </p>
              </div>

              {events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center text-xs font-normal text-zinc-500">
                  No activity recorded yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <ol className="relative ml-3 space-y-5 border-l-2 border-zinc-200 pl-6 text-xs">
                    {visibleEvents.map((event) => (
                      <li key={event.id} className="space-y-1 relative">
                        <span className="absolute -left-[31px] top-1 size-3.5 rounded-full bg-blue-600 ring-4 ring-white" />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs sm:text-sm font-medium text-zinc-900">
                            {humanEventDescription(event.eventType, event.description)}
                          </p>
                          <time className="text-[11px] font-normal text-zinc-500">
                            {formatCaseDate(event.createdAt)}
                          </time>
                        </div>
                        {event.actor?.name && (
                          <p className="text-[11px] font-normal text-zinc-500">
                            By {event.actor.name}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>

                  {events.length > visibleEventsCount && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleEventsCount((c) => c + 10)}
                        className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors"
                      >
                        Load older activity ({events.length - visibleEventsCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Main SupportResolutionCenter
 * Single-View Guest Help & Support Dashboard with two mutually exclusive screens:
 * Screen 1: Full-Width Support Request Listing
 * Screen 2: Full-Width Support Case Details
 * // Layout contract: full-width mutually exclusive views (legacy reference: xl:grid-cols-[minmax(280px,40%)_minmax(0,1fr)])
 */
export function SupportResolutionCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySelectId = useId();
  const statusSelectId = useId();
  const searchInputId = useId();

  const caseIdFromUrl = searchParams.get("caseId");
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<GuestCaseTab>(() => guestTab(tabFromUrl));
  const [items, setItems] = useState<Case[]>([]);
  const [active, setActive] = useState<Case | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filters, setFilters] = useState(() => ({
    status: tabStatus(guestTab(tabFromUrl)),
    category: "",
    search: "",
  }));
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Summary Metrics
  const [metrics, setMetrics] = useState<SupportMetrics>({
    all: 0,
    actionNeeded: 0,
    underReview: 0,
    resolved: 0,
  });

  // Create form state
  const [form, setForm] = useState({
    category: "",
    issueType: "",
    bookingId: "",
    subject: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const createKey = useRef<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  // Load summary metrics from real database endpoints
  const loadMetrics = useCallback(async () => {
    try {
      const [allRes, actionRes, reviewRes, resolvedRes] = await Promise.all([
        api<{ pagination: { total: number } }>("/api/v1/support/cases?page=1&limit=1"),
        api<{ pagination: { total: number } }>("/api/v1/support/cases?page=1&limit=1&status=WAITING_FOR_GUEST"),
        api<{ pagination: { total: number } }>("/api/v1/support/cases?page=1&limit=1&status=IN_REVIEW"),
        api<{ pagination: { total: number } }>("/api/v1/support/cases?page=1&limit=1&status=RESOLVED"),
      ]);

      setMetrics({
        all: allRes.pagination?.total || 0,
        actionNeeded: actionRes.pagination?.total || 0,
        underReview: reviewRes.pagination?.total || 0,
        resolved: resolvedRes.pagination?.total || 0,
      });
    } catch {
      // Non-critical background metric fetch error
    }
  }, []);

  // Load support cases listing
  const loadCases = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      setMessage(null);
      try {
        const query = new URLSearchParams({
          page: String(targetPage),
          limit: "10",
        });
        if (filters.status) query.set("status", filters.status);
        if (filters.category) query.set("category", filters.category);
        if (filters.search.trim()) query.set("search", filters.search.trim());

        const result = await api<{ cases: Case[]; pagination: { page: number; total: number; totalPages: number } }>(
          `/api/v1/support/cases?${query.toString()}`
        );

        setItems(result.cases);
        setPages(result.pagination);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load support requests.");
      } finally {
        setLoading(false);
      }
    },
    [filters, page]
  );

  // Open a specific support case details
  const openCase = useCallback(async (id: string) => {
    activeRequestIdRef.current = id;
    setDetailLoading(true);
    setMessage(null);

    try {
      const caseDetails = await api<Case>(`/api/v1/support/cases/${encodeURIComponent(id)}`);
      // Discard stale response if another case was clicked rapidly
      if (activeRequestIdRef.current === id) {
        setActive(caseDetails);
      }
    } catch (error) {
      if (activeRequestIdRef.current === id) {
        setMessage(error instanceof Error ? error.message : "Unable to open this support request or you do not have permission.");
        setActive(null);
      }
    } finally {
      if (activeRequestIdRef.current === id) {
        setDetailLoading(false);
      }
    }
  }, []);

  // Initial mount: load taxonomy, bookings, metrics, and handle URL caseId
  useEffect(() => {
    void Promise.all([
      api<{ categories: Taxonomy[] }>("/api/v1/support/case-taxonomy"),
      api<Booking[]>("/api/v1/bookings?page=1&limit=100"),
    ])
      .then(([taxRes, bookingsRes]) => {
        setTaxonomy(taxRes.categories || []);
        setBookings(bookingsRes || []);
      })
      .catch(() => undefined);

    const timer = window.setTimeout(() => {
      void loadMetrics();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMetrics]);

  // Handle caseId in URL or changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (caseIdFromUrl) {
        void openCase(caseIdFromUrl);
      } else {
        setActive(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [caseIdFromUrl, openCase]);

  // Trigger load when filters or page changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCases(page);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCases, page]);

  // Handle selecting a case card -> Switches to Screen 2 (Case Details)
  function handleSelectCase(id: string) {
    const query = new URLSearchParams(window.location.search);
    query.set("caseId", id);
    router.push(`/profile/tab/support?${query.toString()}`, { scroll: false });
    void openCase(id);
  }

  // Handle deselecting case / Back to requests -> Returns to Screen 1 (Case List)
  function handleDeselectCase() {
    const query = new URLSearchParams(window.location.search);
    query.delete("caseId");
    const searchStr = query.toString();
    router.push(searchStr ? `/profile/tab/support?${searchStr}` : "/profile/tab/support", { scroll: false });
    setActive(null);
    setMessage(null);
  }

  // Handle Tab Switch on Screen 1
  function handleTabChange(tab: GuestCaseTab) {
    setActiveTab(tab);
    setFilters((prev) => ({
      ...prev,
      status: tabStatus(tab),
    }));
    setPage(1);

    const query = new URLSearchParams(window.location.search);
    if (tab === "all") {
      query.delete("tab");
    } else {
      query.set("tab", tab);
    }
    const searchStr = query.toString();
    router.push(searchStr ? `/profile/tab/support?${searchStr}` : "/profile/tab/support", { scroll: false });
  }

  // Handle creating a support case
  async function handleCreateCase(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!form.category || !form.issueType || !form.subject.trim() || !form.description.trim()) {
      setMessage("Please fill out category, issue type, subject, and description.");
      return;
    }

    setSubmitting(true);
    createKey.current ??= globalThis.crypto?.randomUUID?.() || `case-${Date.now()}-${Math.random()}`;

    try {
      const created = await api<Case>("/api/v1/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          issueType: form.issueType,
          bookingId: form.bookingId || undefined,
          subject: form.subject.trim(),
          description: form.description.trim(),
          idempotencyKey: createKey.current,
        }),
      });

      createKey.current = null;
      setForm({ category: "", issueType: "", bookingId: "", subject: "", description: "" });
      setShowCreateModal(false);

      // Refresh metrics and cases list, then select newly created case
      void loadMetrics();
      void loadCases(1);
      handleSelectCase(created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create support request.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCategoryObj = taxonomy.find((c) => c.value === form.category);

  // Determine which screen to render:
  // SCREEN 2: A case is selected (caseId is in URL or active case is loaded)
  // SCREEN 1: No case is selected
  const isTicketDetailsScreen = Boolean(caseIdFromUrl || active);

  return (
    <section className="animate-in fade-in duration-300 font-sans text-zinc-900 space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          SCREEN 2: MUTUALLY EXCLUSIVE SUPPORT TICKET DETAILS
          When a case is selected, HIDE listing, cards, filters, and pagination.
          SHOW ONLY THE FULL-WIDTH SELECTED CASE DETAILS.
         ───────────────────────────────────────────────────────────── */}
      {isTicketDetailsScreen ? (
        <div className="w-full">
          {message && !active && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-normal text-red-800 flex items-center justify-between gap-4">
              <p>{message}</p>
              <button
                type="button"
                onClick={handleDeselectCase}
                className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-900 transition-colors"
              >
                Return to requests
              </button>
            </div>
          )}

          {detailLoading && !active ? (
            <div className="w-full space-y-6 animate-pulse">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div className="h-9 w-36 rounded-full bg-zinc-200 skeleton-shimmer" />
                <div className="h-7 w-24 rounded-full bg-zinc-100 skeleton-shimmer" />
              </div>
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 space-y-4">
                <div className="h-4 w-32 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-8 w-2/3 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-16 w-full rounded-xl bg-zinc-100 skeleton-shimmer" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-zinc-50 border border-zinc-100 p-3 skeleton-shimmer" />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 h-96 skeleton-shimmer" />
            </div>
          ) : active ? (
            <GuestCaseDetailPanel
              caseData={active}
              onBack={handleDeselectCase}
              onRefresh={() => openCase(active.id)}
              onMessageSent={() => {
                void loadMetrics();
                void loadCases(page);
              }}
            />
          ) : null}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           SCREEN 1: MUTUALLY EXCLUSIVE SUPPORT REQUEST LIST
           When no case is selected, display header, metrics, filters,
           and full-width request cards.
           ───────────────────────────────────────────────────────────── */
        <div className="w-full space-y-6">
          {/* Header */}
          <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">Help &amp; Support</h1>
              <p className="mt-1 max-w-2xl text-xs sm:text-sm font-normal text-zinc-500">
                Manage your support requests, track updates, and communicate with StayElite Support.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/profile/resolution-center"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-xs sm:text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors"
              >
                Resolution Center
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(true);
                  setMessage(null);
                }}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-5 text-xs sm:text-sm font-medium text-white shadow-2xs hover:bg-black transition-colors"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create support request
              </button>
            </div>
          </header>

          {message && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-normal text-red-800"
            >
              {message}
            </div>
          )}

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {/* Total requests */}
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors shadow-2xs ${
                activeTab === "all" ? "border-zinc-900 bg-zinc-50/70" : "border-zinc-200/80 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950">{metrics.all}</p>
                <p className="text-xs font-normal text-zinc-500">Total requests</p>
              </div>
            </button>

            {/* Action needed */}
            <button
              type="button"
              onClick={() => handleTabChange("action_needed")}
              className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors shadow-2xs ${
                activeTab === "action_needed" ? "border-zinc-900 bg-rose-50/40" : "border-zinc-200/80 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950">{metrics.actionNeeded}</p>
                <p className="text-xs font-normal text-zinc-500">Action needed</p>
              </div>
            </button>

            {/* Under review */}
            <button
              type="button"
              onClick={() => handleTabChange("under_review")}
              className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors shadow-2xs ${
                activeTab === "under_review" ? "border-zinc-900 bg-blue-50/40" : "border-zinc-200/80 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950">{metrics.underReview}</p>
                <p className="text-xs font-normal text-zinc-500">Under review</p>
              </div>
            </button>

            {/* Resolved */}
            <button
              type="button"
              onClick={() => handleTabChange("resolved")}
              className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors shadow-2xs ${
                activeTab === "resolved" ? "border-zinc-900 bg-emerald-50/40" : "border-zinc-200/80 bg-white hover:border-zinc-300"
              }`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950">{metrics.resolved}</p>
                <p className="text-xs font-normal text-zinc-500">Resolved</p>
              </div>
            </button>
          </div>

          {/* Filter Tabs (Pill style) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              All requests ({metrics.all})
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("action_needed")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "action_needed"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Action needed ({metrics.actionNeeded})
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("under_review")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "under_review"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Under review ({metrics.underReview})
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("resolved")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "resolved"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              Resolved ({metrics.resolved})
            </button>
          </div>

          {/* Search and Dropdown Filters Bar */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Search */}
            <div className="relative">
              <label htmlFor={searchInputId} className="sr-only">
                Search case #, subject, or booking...
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                id={searchInputId}
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    void loadCases(1);
                  }
                }}
                placeholder="Search case #, subject, or booking..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-xs sm:text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <label htmlFor={categorySelectId} className="sr-only">
                Filter by category
              </label>
              <select
                id={categorySelectId}
                value={filters.category}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, category: e.target.value }));
                  setPage(1);
                }}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
              >
                <option value="">All categories</option>
                {taxonomy.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <div>
              <label htmlFor={statusSelectId} className="sr-only">
                Filter by status
              </label>
              <select
                id={statusSelectId}
                value={filters.status}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, status: e.target.value }));
                  setPage(1);
                }}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
              >
                <option value="">All statuses</option>
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Full-Width Case Listing */}
          <div className="w-full space-y-3">
            {loading ? (
              <div role="status" aria-label="Loading cases" className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs animate-pulse">
                    <div className="size-16 sm:size-20 shrink-0 rounded-xl bg-zinc-100 skeleton-shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="h-3.5 w-24 rounded bg-zinc-200 skeleton-shimmer" />
                        <div className="h-5 w-20 rounded-full bg-zinc-100 skeleton-shimmer" />
                      </div>
                      <div className="h-4 w-3/4 rounded bg-zinc-200 skeleton-shimmer" />
                      <div className="h-3 w-1/2 rounded bg-zinc-100 skeleton-shimmer" />
                      <div className="h-2.5 w-36 rounded bg-zinc-100 skeleton-shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-10 text-center space-y-3">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                  <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-zinc-950">No support requests found</h3>
                <p className="text-xs font-normal text-zinc-500 max-w-sm mx-auto">
                  {filters.status || filters.category || filters.search
                    ? "Try adjusting your filters or search query to find your support case."
                    : "You do not have any open support requests at this time."}
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  {(filters.status || filters.category || filters.search) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ status: "", category: "", search: "" });
                        setActiveTab("all");
                        setPage(1);
                      }}
                      className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-black transition-colors"
                  >
                    Create request
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const photoUrl = item.listing?.photos?.[0];

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleSelectCase(item.id)}
                      className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 text-left transition-all shadow-2xs flex items-center justify-between gap-4 hover:border-zinc-300 hover:shadow-xs"
                    >
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        {/* Property or Category Thumbnail */}
                        <div className="size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200/60 relative flex items-center justify-center">
                          {photoUrl ? (
                            <Image
                              src={photoUrl}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <svg className="size-7 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                          )}
                        </div>

                        {/* Card Content */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-medium text-zinc-500">
                              #{item.caseNumber}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadge(item.status)}`}>
                                {labels[item.status] || item.status}
                              </span>
                              {item.unreadCount !== undefined && item.unreadCount > 0 && (
                                <span className="flex size-4.5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-medium text-white">
                                  {item.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>

                          <h3 className="truncate text-sm sm:text-base font-medium text-zinc-950">
                            {item.subject}
                          </h3>

                          <p className="truncate text-xs font-normal text-zinc-500">
                            {item.category.replaceAll("_", " ")}
                            {item.listing?.title ? ` · ${item.listing.title}` : ""}
                            {item.booking?.submissionId ? ` · #${item.booking.submissionId}` : item.booking?.id ? ` · #${item.booking.id.slice(0, 10)}` : ""}
                          </p>

                          <p className="text-[11px] font-normal text-zinc-400 pt-0.5">
                            Created {formatCaseDate(item.createdAt)} · Last activity {formatCaseDate(item.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="text-zinc-400 shrink-0">
                        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>
                  );
                })}

                {/* Server-Side Pagination */}
                {pages.totalPages > 1 && (
                  <nav aria-label="Support cases pagination" className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs font-normal text-zinc-600">
                    <span>
                      Showing {Math.min(1 + (page - 1) * 10, pages.total)}-{Math.min(page * 10, pages.total)} of {pages.total}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= pages.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-40 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </nav>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Support Request Modal */}
      {showCreateModal && (
        <ModalOverlay
          className="fixed inset-0 z-9999 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClose={() => setShowCreateModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-support-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 shadow-xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 id="create-support-modal-title" className="text-lg font-medium text-zinc-950">Create support request</h2>
                <p className="text-xs font-normal text-zinc-500">
                  Connect with StayElite Support regarding a booking, payment, account, or general question.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                aria-label="Close modal"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-800">
                  Category
                  <select
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value, issueType: "" })}
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  >
                    <option value="">Choose a category</option>
                    {taxonomy.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-medium text-zinc-800">
                  Issue type
                  <select
                    required
                    disabled={!selectedCategoryObj}
                    value={form.issueType}
                    onChange={(e) => setForm({ ...form, issueType: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                  >
                    <option value="">Choose an issue type</option>
                    {selectedCategoryObj?.issueTypes.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs font-medium text-zinc-800">
                Related booking <span className="font-normal text-zinc-500">(optional)</span>
                <select
                  value={form.bookingId}
                  onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                >
                  <option value="">No related booking</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.listing?.title || "Reservation"} · {new Date(b.startDate).toLocaleDateString()}–{new Date(b.endDate).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-zinc-800">
                Subject
                <input
                  required
                  maxLength={160}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Brief summary of the issue..."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-medium text-zinc-800">
                Description
                <textarea
                  required
                  maxLength={10000}
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Share relevant details. Do not include passwords or payment-card details."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
