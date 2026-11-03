"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  return value === "action_needed" ||
    value === "under_review" ||
    value === "resolved"
    ? value
    : "all";
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
  metadata?: { messageId?: string } | null;
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

type OfferType =
  | "MONETARY_COMPENSATION"
  | "PROPERTY_DAMAGE"
  | "NON_FINANCIAL"
  | "AMENITY_ISSUE"
  | "OTHER";

type Offer = {
  id: string;
  offerType: OfferType;
  amount: number | null;
  currency: string;
  description: string;
  status: string;
  version: number;
  expiresAt: string | null;
  createdAt?: string;
  proposer: { id: string; name: string | null };
  recipient: { id: string; name: string | null };
};

const offerTypeLabels: Record<OfferType, string> = {
  MONETARY_COMPENSATION: "Monetary compensation",
  PROPERTY_DAMAGE: "Property damage",
  NON_FINANCIAL: "Non-financial resolution",
  AMENITY_ISSUE: "Amenity issue",
  OTHER: "Other resolution",
};

function formatCurrency(amount: number | null, currency = "SAR") {
  if (amount === null || amount === undefined) return "Non-financial";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount / 100);
}

type Case = {
  id: string;
  caseNumber: string;
  category: string;
  issueType: string | null;
  subject: string;
  description?: string | null;
  status: Status;
  priority: string;
  version?: number;
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
  resolutionOffers?: Offer[];
  viewer?: { id: string; isAdmin: boolean; role?: string | null };
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
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  if (!headers.has("Pragma")) {
    headers.set("Pragma", "no-cache");
  }

  const response = await fetch(url, { cache: "no-store", ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.error?.message || "Support service is temporarily unavailable.",
    );
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
    case "RESOLUTION_REQUESTED":
      return "Direct resolution requested";
    case "RESOLUTION_OFFER_CREATED":
      return "Resolution offer proposed";
    case "RESOLUTION_COUNTEROFFERED":
      return "Counteroffer proposed";
    case "RESOLUTION_OFFER_ACCEPTED":
      return "Resolution offer accepted";
    case "RESOLUTION_OFFER_REJECTED":
      return "Resolution offer rejected";
    case "RESOLUTION_OFFER_WITHDRAWN":
      return "Resolution offer withdrawn";
    case "MEDIATION_REQUESTED":
      return "Support mediation requested";
    default:
      return eventType
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^\w/, (c) => c.toUpperCase());
  }
}

/**
 * GuestCaseDetailPanel
 * Full-width detail view for the selected support case or direct resolution, housing dedicated tab panels
 * for Conversation, Offers & Negotiation, Evidence, Activity, and Mediation.
 */
export function GuestCaseDetailPanel({
  caseData,
  onBack,
  onRefresh,
  onMessageSent,
  onCaseMutated,
  isDirectView = false,
}: {
  caseData: Case;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onMessageSent?: () => void;
  onCaseMutated?: (updatedFields?: Partial<Case>) => void;
  isDirectView?: boolean;
}) {
  const isDirectResolution =
    isDirectView ||
    Boolean(
      caseData.resolutionOffers && caseData.resolutionOffers.length > 0,
    ) ||
    caseData.category === "DIRECT_RESOLUTION" ||
    caseData.category === "BOOKING_DISPUTE";

  type DetailTab =
    | "conversation"
    | "offers"
    | "evidence"
    | "activity"
    | "mediation";
  const [detailTab, setDetailTab] = useState<DetailTab>("conversation");
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

  // Negotiation & Offer states
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [counteringOffer, setCounteringOffer] = useState<Offer | null>(null);
  const [offerForm, setOfferForm] = useState({
    offerType: "MONETARY_COMPENSATION" as OfferType,
    amount: "",
    description: "",
    expiresAt: "",
  });
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // Mediation state
  const [mediationReason, setMediationReason] = useState("");
  const [requestingMediation, setRequestingMediation] = useState(false);

  const isCaseMutable = mutableStatuses.has(caseData.status);

  const getNextActionMessage = () => {
    if (isDirectResolution) {
      if (caseData.status === "RESOLVED") {
        return "An agreement has been recorded. This resolution case is completed.";
      }
      if (caseData.status === "CLOSED") {
        return "This resolution case has been closed.";
      }
      if (caseData.status === "ESCALATED") {
        return "Mediation has been requested. StayElite Support is reviewing the negotiation and evidence.";
      }
      const activePendingOffer = caseData.resolutionOffers?.find(
        (o) => o.status === "PENDING",
      );
      if (activePendingOffer) {
        const isRecipient = caseData.viewer
          ? activePendingOffer.recipient.id === caseData.viewer.id
          : false;
        if (isRecipient) {
          return `Action needed: ${activePendingOffer.proposer.name || "The host"} proposed a resolution offer for you to review.`;
        }
        return `Your resolution offer is awaiting review by ${activePendingOffer.recipient.name || "the host"}.`;
      }
      return "Direct negotiation is open. You may discuss terms and propose a settlement offer.";
    }

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

    replyKey.current ??=
      globalThis.crypto?.randomUUID?.() ||
      `reply-${Date.now()}-${Math.random()}`;

    try {
      const content = stagedAttachment
        ? replyText.trim()
          ? `${replyText.trim()}\n\n[Attached: ${stagedAttachment.name}]`
          : `[Attached: ${stagedAttachment.name}]`
        : replyText.trim();

      const savedMessage = await api<{ id: string }>(
        `/api/v1/support/cases/${caseData.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            idempotencyKey: replyKey.current,
          }),
        },
      );

      if (stagedAttachment) {
        const formData = new FormData();
        formData.set("file", stagedAttachment);
        formData.set("messageId", savedMessage.id);
        await api(`/api/v1/support/cases/${caseData.id}/evidence/upload`, {
          method: "POST",
          body: formData,
        });
      }

      replyKey.current = null;
      setReplyText("");
      setStagedAttachment(null);
      await onRefresh();
      onCaseMutated?.({ updatedAt: new Date().toISOString() });
      onMessageSent?.();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to send message.",
      );
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
      onCaseMutated?.({ updatedAt: new Date().toISOString() });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to upload evidence document.",
      );
    } finally {
      setUploadingEvidence(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleOfferAction(
    offer: Offer,
    action: "ACCEPT" | "REJECT" | "WITHDRAW",
  ) {
    const actionVerb =
      action === "ACCEPT"
        ? "accept"
        : action === "REJECT"
          ? "reject"
          : "withdraw";
    if (
      !window.confirm(
        `Are you sure you want to ${actionVerb} this resolution offer?`,
      )
    )
      return;
    setOfferActionLoading(true);
    setActionError(null);
    try {
      await api(`/api/v1/support/resolution-offers/${offer.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedVersion: offer.version }),
      });
      await onRefresh();
      onCaseMutated?.({
        status: action === "ACCEPT" ? "RESOLVED" : caseData.status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Unable to ${actionVerb} resolution offer.`,
      );
    } finally {
      setOfferActionLoading(false);
    }
  }

  async function handleSubmitOffer(e: FormEvent) {
    e.preventDefault();
    if (!offerForm.description.trim() || submittingOffer) return;
    setSubmittingOffer(true);
    setActionError(null);
    try {
      const isMonetary =
        offerForm.offerType === "MONETARY_COMPENSATION" ||
        offerForm.offerType === "PROPERTY_DAMAGE";
      const amountMinor =
        isMonetary && offerForm.amount
          ? Math.round(Number(offerForm.amount) * 100)
          : undefined;
      await api(`/api/v1/support/cases/${caseData.id}/resolution-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerType: offerForm.offerType,
          amount: amountMinor,
          description: offerForm.description.trim(),
          expiresAt: offerForm.expiresAt || undefined,
          parentOfferId: counteringOffer?.id,
          idempotencyKey:
            globalThis.crypto?.randomUUID?.() || `offer-${Date.now()}`,
        }),
      });
      setOfferForm({
        offerType: "MONETARY_COMPENSATION",
        amount: "",
        description: "",
        expiresAt: "",
      });
      setCounteringOffer(null);
      await onRefresh();
      onCaseMutated?.({ updatedAt: new Date().toISOString() });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Unable to submit resolution offer.",
      );
    } finally {
      setSubmittingOffer(false);
    }
  }

  async function handleRequestMediation(e: FormEvent) {
    e.preventDefault();
    if (!mediationReason.trim() || requestingMediation) return;
    setRequestingMediation(true);
    setActionError(null);
    try {
      await api(`/api/v1/support/cases/${caseData.id}/mediation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: caseData.version || 1,
          reason: mediationReason.trim(),
        }),
      });
      setMediationReason("");
      await onRefresh();
      onCaseMutated?.({
        status: "ESCALATED",
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to request mediation.",
      );
    } finally {
      setRequestingMediation(false);
    }
  }

  const events = caseData.events || [];
  const visibleEvents = events.slice(0, visibleEventsCount);
  const activeOffers = caseData.resolutionOffers || [];
  const activePendingOffer =
    activeOffers.find((o) => o.status === "PENDING") || activeOffers.at(-1);
  const isRecipient =
    caseData.viewer && activePendingOffer
      ? activePendingOffer.recipient.id === caseData.viewer.id
      : false;
  const isProposer =
    caseData.viewer && activePendingOffer
      ? activePendingOffer.proposer.id === caseData.viewer.id
      : false;
  const isMediationActive =
    caseData.status === "ESCALATED" ||
    events.some((e) => e.eventType === "MEDIATION_REQUESTED");

  return (
    <article className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {isDirectResolution
            ? "Back to direct resolutions"
            : "Back to requests"}
        </button>

        <div className="flex items-center gap-2">
          {isDirectResolution && (
            <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
              Direct resolution
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(caseData.status)}`}
          >
            {labels[caseData.status] || caseData.status}
          </span>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-normal text-red-800"
        >
          {actionError}
        </div>
      )}

      {/* Case Header & Overview */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-2xs space-y-5">
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-medium text-zinc-500">
            Case #{caseData.caseNumber}
          </p>
          <h2 className="profile-page-title text-zinc-950">
            {caseData.subject}
          </h2>
        </div>

        {/* What's Happening Next contextual box */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs sm:text-sm text-blue-900 flex items-start gap-3">
          <svg
            className="size-5 shrink-0 text-blue-600 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="space-y-0.5">
            <p className="font-medium">What&apos;s happening next</p>
            <p className="font-normal text-blue-800/90 leading-relaxed">
              {getNextActionMessage()}
            </p>
          </div>
        </div>

        {/* Case Description */}
        {caseData.description && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-zinc-500">
              {isDirectResolution
                ? "Original dispute explanation"
                : "Original issue description"}
            </h3>
            <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-xs sm:text-sm font-normal text-zinc-800 leading-relaxed border border-zinc-100">
              {caseData.description}
            </p>
          </div>
        )}

        {/* 4 Metadata Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-1">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span>Category</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">
              {caseData.category.replaceAll("_", " ")}
              {caseData.issueType
                ? ` · ${caseData.issueType.replaceAll("_", " ")}`
                : ""}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Related booking</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">
              {caseData.booking?.id ? (
                <span className="text-blue-600 inline-flex items-center gap-0.5">
                  #
                  {caseData.booking.submissionId ||
                    caseData.booking.id.slice(0, 10)}
                </span>
              ) : (
                "Not linked to booking"
              )}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Created</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">
              {formatCaseDate(caseData.createdAt)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-normal text-zinc-500">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 10" />
              </svg>
              <span>Last activity</span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-medium text-zinc-900 truncate">
              {formatCaseDate(caseData.updatedAt)}
            </p>
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
            className="-mb-px flex flex-wrap gap-4 sm:gap-8 text-sm font-medium"
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
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Conversation ({caseData.messages?.length || 0})
            </button>

            {isDirectResolution && (
              <button
                id="tab-offers"
                type="button"
                role="tab"
                aria-selected={detailTab === "offers"}
                aria-controls="tabpanel-offers"
                onClick={() => setDetailTab("offers")}
                className={`flex items-center gap-2 border-b-2 py-3.5 text-xs sm:text-sm font-medium transition-colors ${
                  detailTab === "offers"
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                }`}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 15h0M2 9.5h20" />
                </svg>
                Offers &amp; Negotiation ({activeOffers.length})
              </button>
            )}

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
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
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
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 10" />
              </svg>
              Activity
            </button>

            {isDirectResolution && (
              <button
                id="tab-mediation"
                type="button"
                role="tab"
                aria-selected={detailTab === "mediation"}
                aria-controls="tabpanel-mediation"
                onClick={() => setDetailTab("mediation")}
                className={`flex items-center gap-2 border-b-2 py-3.5 text-xs sm:text-sm font-medium transition-colors ${
                  detailTab === "mediation"
                    ? "border-zinc-950 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
                }`}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Mediation
              </button>
            )}
          </nav>
        </div>

        {/* TAB 1: CONVERSATION */}
        {detailTab === "conversation" && (
          <div
            id="tabpanel-conversation"
            role="tabpanel"
            aria-labelledby="tab-conversation"
            className="flex flex-col"
          >
            <div className="p-5 sm:p-7 space-y-4 min-h-[280px] max-h-[500px] overflow-y-auto">
              {caseData.messages && caseData.messages.length > 0 ? (
                caseData.messages.map((msg) => {
                  const isViewer = Boolean(
                    caseData.viewer && msg.sender.id === caseData.viewer.id,
                  );
                  const attachments =
                    caseData.evidence?.filter(
                      (entry) => entry.metadata?.messageId === msg.id,
                    ) || [];
                  const roleLabel = msg.sender.role
                    ? msg.sender.role === "ADMIN"
                      ? "Support Specialist"
                      : msg.sender.role
                          .toLowerCase()
                          .replace(/^\w/, (c) => c.toUpperCase())
                    : isViewer
                      ? "You"
                      : "Host / Participant";

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${isViewer ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div className="size-9 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs font-medium shrink-0">
                        {getInitials(msg.sender?.name, isViewer ? "ME" : "U")}
                      </div>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] space-y-1.5 ${isViewer ? "items-end text-right" : "items-start text-left"}`}
                      >
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="font-medium text-zinc-900">
                            {isViewer
                              ? "You"
                              : msg.sender?.name || "Participant"}
                          </span>
                          <span>·</span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 font-normal">
                            {roleLabel}
                          </span>
                          <span>·</span>
                          <span className="font-normal">
                            {formatCaseDate(msg.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`rounded-2xl p-4 text-xs sm:text-sm font-normal leading-relaxed whitespace-pre-wrap shadow-2xs ${
                            isViewer
                              ? "bg-zinc-900 text-white rounded-tr-xs"
                              : "bg-zinc-100 text-zinc-900 rounded-tl-xs"
                          }`}
                        >
                          {msg.content}
                        </div>
                        {attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={`/api/v1/support/cases/${caseData.id}/evidence/${attachment.id}?download=true`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`block rounded-lg border px-3 py-2 text-xs font-medium underline ${isViewer ? "border-zinc-700 text-zinc-100" : "border-zinc-200 text-zinc-700"}`}
                          >
                            Attachment: {attachment.originalName}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-medium text-zinc-700">
                    No messages in this case yet.
                  </p>
                  <p className="text-xs text-zinc-500">
                    Send a message below to communicate directly.
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Composer */}
            {isCaseMutable ? (
              <form
                onSubmit={handleSendReply}
                className="border-t border-zinc-200 p-4 sm:p-5 bg-zinc-50/70 space-y-3"
              >
                {stagedAttachment && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800">
                    <span className="truncate">
                      Attached: {stagedAttachment.name} (
                      {formatBytes(stagedAttachment.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => setStagedAttachment(null)}
                      className="text-zinc-400 hover:text-zinc-700 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="relative">
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your message here..."
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3.5 pr-24 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  />
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <input
                      ref={composerFileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setStagedAttachment(file);
                        e.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      title="Attach file"
                      onClick={() => composerFileInputRef.current?.click()}
                      className="size-8 rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 flex items-center justify-center transition-colors"
                    >
                      <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                    <button
                      type="submit"
                      disabled={
                        sendingReply || (!replyText.trim() && !stagedAttachment)
                      }
                      className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-black transition-colors disabled:opacity-50"
                    >
                      {sendingReply ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="border-t border-zinc-200 p-4 text-center text-xs text-zinc-500 bg-zinc-50">
                This case has been resolved or closed. Replies can no longer be
                added.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OFFERS & NEGOTIATION (DIRECT RESOLUTION ONLY) */}
        {detailTab === "offers" && isDirectResolution && (
          <div
            id="tabpanel-offers"
            role="tabpanel"
            aria-labelledby="tab-offers"
            className="p-5 sm:p-7 space-y-6"
          >
            {/* Active / Current Offer Card */}
            {activePendingOffer ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-3">
                  <div>
                    <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-800">
                      {offerTypeLabels[activePendingOffer.offerType] ||
                        activePendingOffer.offerType}
                    </span>
                    <h3 className="text-xl font-medium text-zinc-950 mt-1">
                      {formatCurrency(
                        activePendingOffer.amount,
                        activePendingOffer.currency,
                      )}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      activePendingOffer.status === "PENDING"
                        ? "bg-blue-50 text-blue-800 border border-blue-200"
                        : activePendingOffer.status === "ACCEPTED"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                    }`}
                  >
                    {activePendingOffer.status}
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-zinc-600 space-y-1">
                  <p>
                    <span className="font-medium text-zinc-900">From: </span>
                    {activePendingOffer.proposer.name || "Participant"} →{" "}
                    <span className="font-medium text-zinc-900">To: </span>
                    {activePendingOffer.recipient.name || "Participant"}
                  </p>
                  {activePendingOffer.expiresAt && (
                    <p className="text-xs text-zinc-500">
                      Expires: {formatCaseDate(activePendingOffer.expiresAt)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-white p-4 text-xs sm:text-sm font-normal text-zinc-800 border border-zinc-200/80">
                  {activePendingOffer.description}
                </div>

                {/* Offer Action Buttons */}
                {activePendingOffer.status === "PENDING" && isCaseMutable && (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {isRecipient && (
                      <>
                        <button
                          type="button"
                          disabled={offerActionLoading}
                          onClick={() =>
                            handleOfferAction(activePendingOffer, "ACCEPT")
                          }
                          className="rounded-full bg-emerald-600 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          Accept offer
                        </button>
                        <button
                          type="button"
                          disabled={offerActionLoading}
                          onClick={() =>
                            handleOfferAction(activePendingOffer, "REJECT")
                          }
                          className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-xs sm:text-sm font-medium text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                        >
                          Reject offer
                        </button>
                        <button
                          type="button"
                          disabled={offerActionLoading}
                          onClick={() => {
                            setCounteringOffer(activePendingOffer);
                            setOfferForm({
                              offerType: activePendingOffer.offerType,
                              amount: activePendingOffer.amount
                                ? String(activePendingOffer.amount / 100)
                                : "",
                              description: "",
                              expiresAt: "",
                            });
                          }}
                          className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                        >
                          Counteroffer
                        </button>
                      </>
                    )}
                    {isProposer && (
                      <button
                        type="button"
                        disabled={offerActionLoading}
                        onClick={() =>
                          handleOfferAction(activePendingOffer, "WITHDRAW")
                        }
                        className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                      >
                        Withdraw offer
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-xs sm:text-sm text-zinc-500">
                No active offer is pending. You can propose a new offer below.
              </div>
            )}

            {/* Negotiation History */}
            {activeOffers.length > 1 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-medium text-zinc-950">
                  Negotiation history ({activeOffers.length})
                </h4>
                <div className="space-y-3">
                  {activeOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2 text-xs sm:text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-900">
                          {offerTypeLabels[offer.offerType] || offer.offerType}{" "}
                          · {formatCurrency(offer.amount, offer.currency)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 font-medium">
                          {offer.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-normal">
                        {offer.proposer.name || "Participant"} →{" "}
                        {offer.recipient.name || "Participant"}
                      </p>
                      <p className="text-zinc-700 font-normal">
                        {offer.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Propose a New Offer Form */}
            {isCaseMutable &&
              (!activePendingOffer ||
                activePendingOffer.status !== "PENDING" ||
                counteringOffer) && (
                <form
                  onSubmit={handleSubmitOffer}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <h4 className="text-base font-medium text-zinc-950">
                      {counteringOffer
                        ? "Submit a counteroffer"
                        : "Propose a new resolution offer"}
                    </h4>
                    {counteringOffer && (
                      <button
                        type="button"
                        onClick={() => setCounteringOffer(null)}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-800 underline"
                      >
                        Cancel counteroffer
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-zinc-800">
                      Offer type
                      <select
                        value={offerForm.offerType}
                        onChange={(e) =>
                          setOfferForm({
                            ...offerForm,
                            offerType: e.target.value as OfferType,
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                      >
                        <option value="MONETARY_COMPENSATION">
                          Monetary compensation
                        </option>
                        <option value="PROPERTY_DAMAGE">
                          Property damage compensation
                        </option>
                        <option value="NON_FINANCIAL">
                          Non-financial agreement
                        </option>
                        <option value="AMENITY_ISSUE">
                          Amenity issue resolution
                        </option>
                        <option value="OTHER">Other resolution</option>
                      </select>
                    </label>

                    {(offerForm.offerType === "MONETARY_COMPENSATION" ||
                      offerForm.offerType === "PROPERTY_DAMAGE") && (
                      <label className="block text-xs font-medium text-zinc-800">
                        Amount (SAR)
                        <input
                          type="number"
                          min="1"
                          step="any"
                          required
                          value={offerForm.amount}
                          onChange={(e) =>
                            setOfferForm({
                              ...offerForm,
                              amount: e.target.value,
                            })
                          }
                          placeholder="e.g. 250"
                          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                        />
                      </label>
                    )}
                  </div>

                  <label className="block text-xs font-medium text-zinc-800">
                    Explanation / Settlement terms
                    <textarea
                      required
                      rows={3}
                      maxLength={4000}
                      value={offerForm.description}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe the terms you propose to resolve this dispute..."
                      className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                    />
                  </label>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      disabled={
                        submittingOffer || !offerForm.description.trim()
                      }
                      className="rounded-full bg-zinc-900 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-50"
                    >
                      {submittingOffer
                        ? "Submitting..."
                        : counteringOffer
                          ? "Send counteroffer"
                          : "Send resolution offer"}
                    </button>
                  </div>
                </form>
              )}
          </div>
        )}

        {/* TAB 3: EVIDENCE & DOCUMENTS */}
        {detailTab === "evidence" && (
          <div
            id="tabpanel-evidence"
            role="tabpanel"
            aria-labelledby="tab-evidence"
            className="p-5 sm:p-7 space-y-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-medium text-zinc-950">
                  Supporting evidence &amp; documents
                </h3>
                <p className="text-xs text-zinc-500 font-normal">
                  JPG, PNG, WEBP, or PDF files. Maximum size: 15 MB per file.
                </p>
              </div>

              {isCaseMutable && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleEvidenceUpload(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingEvidence}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-50"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {uploadingEvidence ? "Uploading..." : "Upload evidence"}
                  </button>
                </div>
              )}
            </div>

            {/* Evidence List */}
            {caseData.evidence && caseData.evidence.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {caseData.evidence.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-200/90 bg-white p-3.5 shadow-2xs hover:border-zinc-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">
                        <svg
                          className="size-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs sm:text-sm font-medium text-zinc-900">
                          {entry.originalName}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-normal">
                          {formatBytes(entry.sizeBytes)} ·{" "}
                          {formatCaseDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/v1/support/cases/${caseData.id}/evidence/${entry.id}?download=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors shrink-0 ml-2"
                      title="Download file"
                    >
                      <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-xs sm:text-sm text-zinc-500">
                No evidence or documents have been uploaded for this case yet.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CASE ACTIVITY */}
        {detailTab === "activity" && (
          <div
            id="tabpanel-activity"
            role="tabpanel"
            aria-labelledby="tab-activity"
            className="p-5 sm:p-7 space-y-6"
          >
            <h3 className="text-base font-medium text-zinc-950">
              Activity timeline
            </h3>
            {events.length > 0 ? (
              <div className="relative pl-6 space-y-6 border-l-2 border-zinc-200 ml-2">
                {visibleEvents.map((evt) => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-[31px] top-1 size-3 rounded-full bg-zinc-900 ring-4 ring-white" />
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-medium text-zinc-900">
                        {humanEventDescription(evt.eventType, evt.description)}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-normal">
                        <span>{formatCaseDate(evt.createdAt)}</span>
                        {evt.actor?.name && <span>· by {evt.actor.name}</span>}
                      </div>
                    </div>
                  </div>
                ))}

                {events.length > visibleEventsCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleEventsCount((prev) => prev + 10)}
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
                  >
                    Show more events ({events.length - visibleEventsCount}{" "}
                    remaining)
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-xs sm:text-sm text-zinc-500">
                No activity history recorded for this case yet.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MEDIATION (DIRECT RESOLUTION ONLY) */}
        {detailTab === "mediation" && isDirectResolution && (
          <div
            id="tabpanel-mediation"
            role="tabpanel"
            aria-labelledby="tab-mediation"
            className="p-5 sm:p-7 space-y-6"
          >
            {isMediationActive ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <h4 className="text-base font-medium text-amber-950">
                    Mediation is active
                  </h4>
                </div>
                <p className="text-xs sm:text-sm font-normal text-amber-900/90 leading-relaxed">
                  StayElite Support has been notified and is currently reviewing
                  this dispute. A neutral support specialist will review
                  messages, offers, and evidence, and communicate with both
                  parties here.
                </p>
                <p className="text-xs text-amber-800 font-normal">
                  No duplicate mediation request is necessary. You will be
                  notified as soon as an administrator responds.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-2">
                  <h4 className="text-sm font-medium text-zinc-950">
                    Need neutral assistance?
                  </h4>
                  <p className="text-xs sm:text-sm font-normal text-zinc-600 leading-relaxed">
                    If you and the host are unable to reach an agreement
                    directly, you can request an authorized StayElite
                    administrator to review the dispute. Both parties will be
                    assisted through official support mediation.
                  </p>
                </div>

                {isCaseMutable ? (
                  <form
                    onSubmit={handleRequestMediation}
                    className="space-y-4 max-w-xl"
                  >
                    <label className="block text-xs font-medium text-zinc-800">
                      Reason for requesting administrator mediation
                      <textarea
                        required
                        rows={4}
                        maxLength={2000}
                        value={mediationReason}
                        onChange={(e) => setMediationReason(e.target.value)}
                        placeholder="Explain what terms could not be resolved directly with the host..."
                        className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={requestingMediation || !mediationReason.trim()}
                      className="rounded-full bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-50"
                    >
                      {requestingMediation
                        ? "Submitting request..."
                        : "Request mediation"}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-zinc-500">
                    This case is resolved or closed; mediation is no longer
                    available.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Main SupportResolutionCenter
 * Screen 1: Mutually Exclusive Support Request List / Direct Resolutions List
 * Screen 2: Full-Width Support Case Details
 * // Layout contract: full-width mutually exclusive views (legacy reference: xl:grid-cols-[minmax(280px,40%)_minmax(0,1fr)])
 */
export function SupportResolutionCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySelectId = useId();
  const statusSelectId = useId();
  const searchInputId = useId();

  const currentView =
    searchParams.get("view") === "direct" ? "direct" : "support";
  const caseIdFromUrl = searchParams.get("caseId");
  const tabFromUrl = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<GuestCaseTab>(() =>
    guestTab(tabFromUrl),
  );
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

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDirectCreateModal, setShowDirectCreateModal] = useState(false);

  // Summary Metrics
  const [metrics, setMetrics] = useState<SupportMetrics>({
    all: 0,
    actionNeeded: 0,
    underReview: 0,
    resolved: 0,
  });

  // Create support request form state
  const [form, setForm] = useState({
    category: "",
    issueType: "",
    bookingId: "",
    subject: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Create direct resolution request form state
  const [directForm, setDirectForm] = useState({
    bookingId: "",
    subject: "",
    offerType: "MONETARY_COMPENSATION" as OfferType,
    amount: "",
    description: "",
    expiresAt: "",
  });
  const [submittingDirect, setSubmittingDirect] = useState(false);

  const createKey = useRef<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const casesReqSeqRef = useRef(0);
  const caseDetailReqSeqRef = useRef(0);

  // Load summary metrics from real database endpoints
  const loadMetrics = useCallback(async () => {
    try {
      const resOnly = currentView === "direct" ? "&resolutionOnly=true" : "";
      const t = `&_t=${Date.now()}`;
      const [allRes, actionRes, reviewRes, resolvedRes] = await Promise.all([
        api<{ pagination: { total: number } }>(
          `/api/v1/support/cases?page=1&limit=1${resOnly}${t}`,
        ),
        api<{ pagination: { total: number } }>(
          `/api/v1/support/cases?page=1&limit=1&status=WAITING_FOR_GUEST${resOnly}${t}`,
        ),
        api<{ pagination: { total: number } }>(
          `/api/v1/support/cases?page=1&limit=1&status=IN_REVIEW${resOnly}${t}`,
        ),
        api<{ pagination: { total: number } }>(
          `/api/v1/support/cases?page=1&limit=1&status=RESOLVED${resOnly}${t}`,
        ),
      ]);

      setMetrics({
        all: allRes.pagination.total,
        actionNeeded: actionRes.pagination.total,
        underReview: reviewRes.pagination.total,
        resolved: resolvedRes.pagination.total,
      });
    } catch {
      // Keep existing metric counters on soft failure
    }
  }, [currentView]);

  // Load support requests with real search, filtering, and race condition prevention
  const loadCases = useCallback(
    async (targetPage = 1, forceFresh = false) => {
      const reqSeq = ++casesReqSeqRef.current;
      setLoading(true);
      setMessage(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", "20");
        if (currentView === "direct") {
          params.set("resolutionOnly", "true");
        }
        if (filters.status) params.set("status", filters.status);
        if (filters.category) params.set("category", filters.category);
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (forceFresh) {
          params.set("_t", String(Date.now()));
        }

        const data = await api<{
          cases: Case[];
          pagination: { page: number; total: number; totalPages: number };
        }>(`/api/v1/support/cases?${params.toString()}`);

        if (reqSeq !== casesReqSeqRef.current) {
          return;
        }

        setItems(data.cases || []);
        setPages(
          data.pagination || { page: targetPage, total: 0, totalPages: 1 },
        );
      } catch (err) {
        if (reqSeq !== casesReqSeqRef.current) return;
        setMessage(
          err instanceof Error
            ? err.message
            : "Unable to load support requests.",
        );
        setItems([]);
      } finally {
        if (reqSeq === casesReqSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [currentView, filters],
  );

  // Open a specific support case details
  const openCase = useCallback(async (id: string, initialCaseData?: Case) => {
    activeRequestIdRef.current = id;
    const reqSeq = ++caseDetailReqSeqRef.current;

    if (initialCaseData) {
      setActive(initialCaseData);
    } else {
      setDetailLoading(true);
    }
    setMessage(null);

    try {
      const caseDetails = await api<Case>(
        `/api/v1/support/cases/${encodeURIComponent(id)}?_t=${Date.now()}`,
      );
      if (
        activeRequestIdRef.current === id &&
        reqSeq === caseDetailReqSeqRef.current
      ) {
        setActive(caseDetails);
      }
    } catch (error) {
      if (
        activeRequestIdRef.current === id &&
        reqSeq === caseDetailReqSeqRef.current
      ) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to open this support request or you do not have permission.",
        );
        setActive(null);
      }
    } finally {
      if (
        activeRequestIdRef.current === id &&
        reqSeq === caseDetailReqSeqRef.current
      ) {
        setDetailLoading(false);
      }
    }
  }, []);

  // Initial mount: load taxonomy, bookings, metrics
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
        if (active?.id !== caseIdFromUrl) {
          const cached = items.find((item) => item.id === caseIdFromUrl);
          void openCase(caseIdFromUrl, cached);
        }
      } else {
        setActive(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [caseIdFromUrl, openCase, active?.id, items]);

  // Trigger load when view, filters, or page changes
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCases(page);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCases, page]);

  // Handle selecting a case card -> Switches to Screen 2 (Case Details)
  function handleSelectCase(id: string, initialData?: Case) {
    const query = new URLSearchParams(window.location.search);
    query.set("caseId", id);
    router.push(`/profile/tab/support?${query.toString()}`, { scroll: false });
    void openCase(id, initialData);
  }

  // Handle deselecting case / Back to requests -> Returns to Screen 1 (Case List)
  function handleDeselectCase() {
    activeRequestIdRef.current = null;
    const query = new URLSearchParams(window.location.search);
    query.delete("caseId");
    const searchStr = query.toString();
    router.push(
      searchStr ? `/profile/tab/support?${searchStr}` : "/profile/tab/support",
      { scroll: false },
    );
    setActive(null);
    setMessage(null);
    void loadCases(page, true);
    void loadMetrics();
  }

  // Handle Case Mutated: updates active case and listing item immediately
  function handleCaseMutated(updatedFields?: Partial<Case>) {
    if (updatedFields && active) {
      setActive((prev) => (prev ? { ...prev, ...updatedFields } : null));
      setItems((prev) =>
        prev.map((item) =>
          item.id === active.id ? { ...item, ...updatedFields } : item,
        ),
      );
    }
    void loadMetrics();
    router.refresh();
  }

  // Handle switching primary view between Support Requests and Direct Resolutions
  function switchPrimaryView(view: "support" | "direct") {
    const query = new URLSearchParams();
    if (view === "direct") {
      query.set("view", "direct");
    }
    router.push(
      query.toString()
        ? `/profile/tab/support?${query.toString()}`
        : "/profile/tab/support",
      { scroll: false },
    );
    activeRequestIdRef.current = null;
    setActive(null);
    setMessage(null);
    setPage(1);
    setActiveTab("all");
    setFilters({ status: "", category: "", search: "" });
    setItems([]);
    setLoading(true);
  }

  // Handle Tab Switch on Screen 1
  function handleTabChange(tab: GuestCaseTab) {
    setActiveTab(tab);
    setFilters((prev) => ({
      ...prev,
      status: tabStatus(tab),
    }));
    setPage(1);
  }

  // Handle Form Submission for Regular Support Request
  async function handleCreateCase(e: FormEvent) {
    e.preventDefault();
    if (!form.category || !form.subject.trim() || !form.description.trim()) {
      setMessage("Please fill out category, subject, and description.");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    createKey.current ??=
      globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random()}`;

    try {
      const createdCase = await api<Case>("/api/v1/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          issueType: form.issueType || undefined,
          bookingId: form.bookingId || undefined,
          subject: form.subject.trim(),
          description: form.description.trim(),
          priority: "MEDIUM",
          idempotencyKey: createKey.current,
        }),
      });

      createKey.current = null;
      setShowCreateModal(false);
      setForm({
        category: "",
        issueType: "",
        bookingId: "",
        subject: "",
        description: "",
      });

      // Reset filters so the new case is visible immediately
      setActiveTab("all");
      setFilters({ status: "", category: "", search: "" });
      setPage(1);

      // Optimistically prepend to listing
      setItems((prev) => [
        createdCase,
        ...prev.filter((c) => c.id !== createdCase.id),
      ]);
      setPages((p) => ({ ...p, page: 1, total: p.total + 1 }));

      // Refresh metrics immediately
      await loadMetrics();

      // Invalidate server cache
      router.refresh();

      // Trigger fresh fetch in background
      void loadCases(1, true);

      // Open new case
      handleSelectCase(createdCase.id, createdCase);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Unable to create support request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Form Submission for Direct Resolution Request
  async function handleCreateDirectResolution(e: FormEvent) {
    e.preventDefault();
    if (
      !directForm.bookingId ||
      !directForm.subject.trim() ||
      !directForm.description.trim()
    ) {
      setMessage(
        "Please choose a booking and provide a subject and explanation.",
      );
      return;
    }

    setSubmittingDirect(true);
    setMessage(null);

    const directKey =
      globalThis.crypto?.randomUUID?.() || `direct-res-${Date.now()}`;

    try {
      const isMonetary =
        directForm.offerType === "MONETARY_COMPENSATION" ||
        directForm.offerType === "PROPERTY_DAMAGE";
      const amountMinor =
        isMonetary && directForm.amount
          ? Math.round(Number(directForm.amount) * 100)
          : undefined;

      const result = await api<{ supportCaseId: string }>(
        "/api/v1/support/resolutions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: directForm.bookingId,
            subject: directForm.subject.trim(),
            offerType: directForm.offerType,
            amount: amountMinor,
            description: directForm.description.trim(),
            expiresAt: directForm.expiresAt || undefined,
            idempotencyKey: directKey,
          }),
        },
      );

      setShowDirectCreateModal(false);
      setDirectForm({
        bookingId: "",
        subject: "",
        offerType: "MONETARY_COMPENSATION",
        amount: "",
        description: "",
        expiresAt: "",
      });

      // Ensure view is direct
      if (currentView !== "direct") {
        const query = new URLSearchParams();
        query.set("view", "direct");
        query.set("caseId", result.supportCaseId);
        router.push(`/profile/tab/support?${query.toString()}`, {
          scroll: false,
        });
      }

      // Reset filters so newly created direct resolution is visible
      setActiveTab("all");
      setFilters({ status: "", category: "", search: "" });
      setPage(1);

      // Fetch the newly created case immediately to get full data and prepend to listing
      const createdCase = await api<Case>(
        `/api/v1/support/cases/${encodeURIComponent(result.supportCaseId)}?_t=${Date.now()}`,
      );
      setItems((prev) => [
        createdCase,
        ...prev.filter((c) => c.id !== createdCase.id),
      ]);
      setPages((p) => ({ ...p, page: 1, total: p.total + 1 }));

      // Refresh metrics from DB and server cache
      await loadMetrics();
      router.refresh();

      // Background fresh fetch of listing
      void loadCases(1, true);

      // Select case
      handleSelectCase(result.supportCaseId, createdCase);
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Unable to create direct resolution request.",
      );
    } finally {
      setSubmittingDirect(false);
    }
  }

  const selectedCategoryObj = taxonomy.find((c) => c.value === form.category);

  return (
    <section aria-label="Guest Help & Support Center" className="w-full">
      {detailLoading && !active ? (
        <div
          aria-label="Loading selected support request"
          role="status"
          className="w-full space-y-6 animate-pulse"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
            <div className="h-9 w-40 rounded-full bg-zinc-200" />
            <div className="h-7 w-24 rounded-full bg-zinc-200" />
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-7 space-y-4">
            <div className="h-4 w-28 rounded bg-zinc-200" />
            <div className="h-8 w-2/3 rounded-lg bg-zinc-200" />
            <div className="h-16 w-full rounded-xl bg-zinc-100" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 pt-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-20 rounded-xl bg-zinc-100" />
              ))}
            </div>
          </div>
          <div className="h-96 rounded-2xl border border-zinc-200/80 bg-white" />
        </div>
      ) : active ? (
        /* ─────────────────────────────────────────────────────────────
           SCREEN 2: MUTUALLY EXCLUSIVE SUPPORT CASE DETAILS
           When a case is selected, listing is completely hidden.
           ───────────────────────────────────────────────────────────── */
        <GuestCaseDetailPanel
          caseData={active}
          onBack={handleDeselectCase}
          onRefresh={() => openCase(active.id)}
          onCaseMutated={handleCaseMutated}
          isDirectView={currentView === "direct"}
        />
      ) : (
        /* ─────────────────────────────────────────────────────────────
           SCREEN 1: MUTUALLY EXCLUSIVE CASE LISTING
           Support Requests / Direct Resolutions
           ───────────────────────────────────────────────────────────── */
        <div className="w-full space-y-6">
          {/* Header */}
          <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="profile-page-title text-zinc-950">
                  Help &amp; Support
                </h1>
                {currentView === "direct" && (
                  <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
                    Direct Resolutions
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-xs sm:text-sm font-normal text-zinc-500">
                {currentView === "direct"
                  ? "Work directly with the host to resolve booking issues, agree on settlements, and track negotiations."
                  : "Manage your support requests, track updates, and communicate with StayElite Support."}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-nowrap">
              {currentView === "direct" ? (
                <>
                  <button
                    type="button"
                    onClick={() => switchPrimaryView("support")}
                    className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 sm:px-5 text-xs sm:text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors shrink-0"
                  >
                    ← Support Requests
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectCreateModal(true);
                      setMessage(null);
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-900 px-4 sm:px-5 text-xs sm:text-sm font-medium text-white shadow-2xs hover:bg-black transition-colors shrink-0"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New resolution request
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => switchPrimaryView("direct")}
                    className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 sm:px-5 text-xs sm:text-sm font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 transition-colors shrink-0"
                  >
                    Direct Resolutions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(true);
                      setMessage(null);
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-900 px-4 sm:px-5 text-xs sm:text-sm font-medium text-white shadow-2xs hover:bg-black transition-colors shrink-0"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create support request
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Primary View Switcher Tabs: Support Requests | Direct Resolutions */}
          <nav
            aria-label="Support workspace views"
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => switchPrimaryView("support")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm font-medium transition-colors ${
                currentView === "support"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Support Requests
            </button>
            <button
              type="button"
              onClick={() => switchPrimaryView("direct")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm font-medium transition-colors ${
                currentView === "direct"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Direct Resolutions
            </button>
          </nav>

          {message && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-normal text-red-800"
            >
              {message}
            </div>
          )}

          {/* 4 Summary Statistic Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <span>
                  {currentView === "direct"
                    ? "Total resolutions"
                    : "Total requests"}
                </span>
              </div>
              <p className="profile-value mt-3 text-zinc-950">
                {metrics.all}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                <span className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                <span>Action needed</span>
              </div>
              <p className="profile-value mt-3 text-zinc-950">
                {metrics.actionNeeded}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 10" />
                  </svg>
                </span>
                <span>
                  {currentView === "direct" ? "In negotiation" : "Under review"}
                </span>
              </div>
              <p className="profile-value mt-3 text-zinc-950">
                {metrics.underReview}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <span>Resolved</span>
              </div>
              <p className="profile-value mt-3 text-zinc-950">
                {metrics.resolved}
              </p>
            </div>
          </div>

          {/* Filter Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {currentView === "direct" ? "All resolutions" : "All requests"} (
              {metrics.all})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("action_needed")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "action_needed"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Action needed ({metrics.actionNeeded})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("under_review")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "under_review"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {currentView === "direct" ? "In negotiation" : "Under review"} (
              {metrics.underReview})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("resolved")}
              className={`rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "resolved"
                  ? "bg-zinc-900 text-white shadow-2xs"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Resolved ({metrics.resolved})
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3.5 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative flex-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <label htmlFor={searchInputId} className="sr-only">
                Search
              </label>
              <input
                id={searchInputId}
                type="search"
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPage(1);
                }}
                placeholder={
                  currentView === "direct"
                    ? "Search case #, subject, or property..."
                    : "Search case #, subject, or booking..."
                }
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-4 text-xs sm:text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none"
              />
            </div>

            {currentView !== "direct" && (
              <div className="w-full sm:w-48">
                <label htmlFor={categorySelectId} className="sr-only">
                  Filter by category
                </label>
                <select
                  id={categorySelectId}
                  value={filters.category}
                  onChange={(e) => {
                    setFilters({ ...filters, category: e.target.value });
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs sm:text-sm font-normal text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
                >
                  <option value="">All categories</option>
                  {taxonomy.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="w-full sm:w-44">
              <label htmlFor={statusSelectId} className="sr-only">
                Filter by status
              </label>
              <select
                id={statusSelectId}
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setPage(1);
                }}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs sm:text-sm font-normal text-zinc-800 focus:border-zinc-950 focus:bg-white focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="WAITING_FOR_GUEST">Waiting for you</option>
                <option value="WAITING_FOR_HOST">Waiting for host</option>
                <option value="IN_REVIEW">Under review</option>
                <option value="ESCALATED">Escalated</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          {/* Full-Width Case Listing */}
          {loading ? (
            <div
              className="space-y-3"
              role="status"
              aria-label="Loading support cases"
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs animate-pulse flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="size-14 sm:size-16 rounded-xl bg-zinc-200 shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-24 rounded bg-zinc-200" />
                        <div className="h-4 w-32 rounded bg-zinc-100" />
                      </div>
                      <div className="h-5 w-3/4 rounded bg-zinc-200" />
                      <div className="h-3 w-1/2 rounded bg-zinc-100" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="h-6 w-20 rounded-full bg-zinc-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((c) => {
                const listingPhoto = c.listing?.photos?.[0];
                const isDirectItem =
                  currentView === "direct" ||
                  c.category === "DIRECT_RESOLUTION" ||
                  c.category === "BOOKING_DISPUTE";

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCase(c.id, c)}
                    className="w-full rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs hover:border-zinc-400 hover:shadow-xs transition-all text-left flex items-start sm:items-center justify-between gap-4 group cursor-pointer"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="relative size-14 sm:size-16 rounded-xl bg-zinc-100 border border-zinc-200/60 overflow-hidden shrink-0">
                        {listingPhoto ? (
                          <Image
                            src={listingPhoto}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-zinc-400">
                            <svg
                              className="size-6"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                              <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-medium text-zinc-500">
                            #{c.caseNumber}
                          </span>
                          {isDirectItem && (
                            <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                              Direct resolution
                            </span>
                          )}
                          {c.booking && (
                            <span className="text-xs text-blue-600 font-normal">
                              Booking · {c.listing?.title || "Reservation"} #
                              {c.booking.submissionId ||
                                c.booking.id.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-medium text-zinc-950 truncate group-hover:text-black">
                          {c.subject}
                        </h3>
                        <p className="text-xs font-normal text-zinc-500 truncate">
                          Created {formatCaseDate(c.createdAt)} · Last activity{" "}
                          {formatCaseDate(c.updatedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                      {Boolean(c.unreadCount && c.unreadCount > 0) && (
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-medium text-white">
                          {c.unreadCount}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusBadge(c.status)}`}
                      >
                        {labels[c.status] || c.status}
                      </span>
                      <svg
                        className="size-4 text-zinc-400 group-hover:text-zinc-700 transition-colors hidden sm:block"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center space-y-3">
              <p className="text-base font-medium text-zinc-800">
                {currentView === "direct"
                  ? "No direct resolution requests match these filters"
                  : "No support requests match these filters"}
              </p>
              <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                {currentView === "direct"
                  ? "You have not created or received any direct resolution requests matching the active filter criteria."
                  : "You have not submitted any support tickets matching the active search or category filters."}
              </p>
              {currentView === "direct" ? (
                <button
                  type="button"
                  onClick={() => setShowDirectCreateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors"
                >
                  New resolution request
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors"
                >
                  Create support request
                </button>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {pages.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 text-xs sm:text-sm">
              <p className="text-zinc-500 font-normal">
                Showing page{" "}
                <span className="font-medium text-zinc-900">{pages.page}</span>{" "}
                of{" "}
                <span className="font-medium text-zinc-900">
                  {pages.totalPages}
                </span>{" "}
                ({pages.total} total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pages.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={pages.page >= pages.totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(pages.totalPages, p + 1))
                  }
                  className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Regular Create Support Request Modal */}
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
                <h2
                  id="create-support-modal-title"
                  className="text-lg font-medium text-zinc-950"
                >
                  Create support request
                </h2>
                <p className="text-xs font-normal text-zinc-500">
                  Connect with StayElite Support regarding a booking, payment,
                  account, or general question.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value,
                        issueType: "",
                      })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, issueType: e.target.value })
                    }
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
                Related booking{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
                <select
                  value={form.bookingId}
                  onChange={(e) =>
                    setForm({ ...form, bookingId: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                >
                  <option value="">No related booking</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.listing?.title || "Reservation"} ·{" "}
                      {new Date(b.startDate).toLocaleDateString()}–
                      {new Date(b.endDate).toLocaleDateString()}
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
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
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

      {/* New Direct Resolution Request Modal */}
      {showDirectCreateModal && (
        <ModalOverlay
          className="fixed inset-0 z-9999 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClose={() => setShowDirectCreateModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-direct-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 shadow-xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2
                  id="create-direct-modal-title"
                  className="text-lg font-medium text-zinc-950"
                >
                  New resolution request
                </h2>
                <p className="text-xs font-normal text-zinc-500">
                  Negotiate directly with the host to settle booking, property,
                  or amenity issues.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectCreateModal(false)}
                className="size-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateDirectResolution} className="space-y-4">
              <label className="block text-xs font-medium text-zinc-800">
                Select booking
                <select
                  required
                  value={directForm.bookingId}
                  onChange={(e) =>
                    setDirectForm({ ...directForm, bookingId: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                >
                  <option value="">Choose your reservation</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.listing?.title || "Reservation"} ·{" "}
                      {new Date(b.startDate).toLocaleDateString()}–
                      {new Date(b.endDate).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-zinc-800">
                  Initial offer type
                  <select
                    value={directForm.offerType}
                    onChange={(e) =>
                      setDirectForm({
                        ...directForm,
                        offerType: e.target.value as OfferType,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                  >
                    <option value="MONETARY_COMPENSATION">
                      Monetary compensation
                    </option>
                    <option value="PROPERTY_DAMAGE">
                      Property damage compensation
                    </option>
                    <option value="NON_FINANCIAL">
                      Non-financial agreement
                    </option>
                    <option value="AMENITY_ISSUE">
                      Amenity issue resolution
                    </option>
                    <option value="OTHER">Other resolution</option>
                  </select>
                </label>

                {(directForm.offerType === "MONETARY_COMPENSATION" ||
                  directForm.offerType === "PROPERTY_DAMAGE") && (
                  <label className="block text-xs font-medium text-zinc-800">
                    Amount (SAR)
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={directForm.amount}
                      onChange={(e) =>
                        setDirectForm({ ...directForm, amount: e.target.value })
                      }
                      placeholder="e.g. 300"
                      className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                    />
                  </label>
                )}
              </div>

              <label className="block text-xs font-medium text-zinc-800">
                Subject
                <input
                  required
                  maxLength={160}
                  value={directForm.subject}
                  onChange={(e) =>
                    setDirectForm({ ...directForm, subject: e.target.value })
                  }
                  placeholder="Summary of dispute (e.g. Broken AC compensation)..."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-medium text-zinc-800">
                Explanation &amp; Settlement proposal
                <textarea
                  required
                  maxLength={4000}
                  rows={4}
                  value={directForm.description}
                  onChange={(e) =>
                    setDirectForm({
                      ...directForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Explain what occurred and how you propose to settle this issue..."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 focus:border-zinc-950 focus:outline-none"
                />
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirectCreateModal(false)}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDirect}
                  className="rounded-full bg-zinc-900 px-5 py-2 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-50"
                >
                  {submittingDirect
                    ? "Submitting..."
                    : "Send resolution request"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
