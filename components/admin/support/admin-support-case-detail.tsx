"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASE_TRANSITIONS } from "@/lib/support-case/lifecycle";

export type Status =
  | "OPEN"
  | "IN_REVIEW"
  | "WAITING_FOR_GUEST"
  | "WAITING_FOR_HOST"
  | "WAITING_FOR_ADMIN"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "ESCALATED";

export type SupportCaseParticipant = {
  id: string;
  role: "REPORTER" | "GUEST" | "HOST" | "ADMIN";
  canPost: boolean;
  user: {
    id: string;
    name: string | null;
    email?: string | null;
    role?: string;
  };
};

export type SupportCaseMessage = {
  id: string;
  content: string;
  visibility: "PARTICIPANTS" | "ADMINS_ONLY";
  targetAudience?: "GUEST" | "HOST" | "ALL" | "ADMINS_ONLY";
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    email?: string | null;
    role?: string;
    image?: string | null;
  };
};

export type SupportCaseEvidence = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: { id: string; name: string | null } | null;
};

export type SupportCaseEvent = {
  id: string;
  eventType: string;
  description: string | null;
  createdAt: string;
  actor?: { id: string; name: string | null } | null;
};

export type AssignmentHistoryItem = {
  id: string;
  reason?: string | null;
  createdAt: string;
  previousAssignee?: { id: string; name: string | null; email: string | null } | null;
  newAssignee?: { id: string; name: string | null; email: string | null } | null;
};

export type SupportCaseDetailData = {
  id: string;
  caseNumber: string;
  subject: string;
  description?: string | null;
  category: string;
  issueType?: string | null;
  status: Status;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  version: number;
  createdAt: string;
  updatedAt: string;
  slaDueAt?: string | null;
  firstResponseDueAt?: string | null;
  nextResponseDueAt?: string | null;
  escalationLevel?: number | null;
  escalationReason?: string | null;
  escalatedAt?: string | null;
  reporter?: { id: string; name: string | null; email?: string | null; image?: string | null } | null;
  reporterRole?: string | null;
  assignedAdmin?: { id: string; name: string | null; email: string | null } | null;
  escalationOwner?: { id: string; name: string | null; email: string | null } | null;
  booking?: {
    id: string;
    submissionId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    user?: { id: string; name: string | null; email: string | null } | null;
  } | null;
  listing?: { id: string; title: string | null; city?: string | null } | null;
  participants?: SupportCaseParticipant[];
  messages?: SupportCaseMessage[];
  evidence?: SupportCaseEvidence[];
  events?: SupportCaseEvent[];
  assignmentHistory?: AssignmentHistoryItem[];
  viewer?: { id: string; isAdmin: boolean };
};

export type Agent = { id: string; name: string | null; email: string | null };

const statusLabels: Record<Status, string> = {
  OPEN: "Open",
  IN_REVIEW: "In review",
  WAITING_FOR_GUEST: "Waiting for guest",
  WAITING_FOR_HOST: "Waiting for host",
  WAITING_FOR_ADMIN: "Waiting for support",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  ESCALATED: "Escalated",
};

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const bytes = (val: number) =>
  val < 1048576
    ? `${Math.max(1, Math.round(val / 1024))} KB`
    : `${(val / 1048576).toFixed(1)} MB`;

function statusBadgeClass(status: Status) {
  if (status === "RESOLVED") return "bg-emerald-50 text-emerald-700 border-emerald-200/70";
  if (status === "CLOSED") return "bg-zinc-100 text-zinc-600 border-zinc-200";
  if (status === "ESCALATED") return "bg-rose-50 text-rose-700 border-rose-200/70";
  if (status === "WAITING_FOR_GUEST") return "bg-amber-50 text-amber-800 border-amber-200/70";
  if (status === "WAITING_FOR_HOST") return "bg-orange-50 text-orange-800 border-orange-200/70";
  if (status === "WAITING_FOR_ADMIN") return "bg-sky-50 text-sky-800 border-sky-200/70";
  return "bg-blue-50 text-blue-700 border-blue-200/70";
}

function priorityBadgeClass(priority: string) {
  if (priority === "URGENT") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "HIGH") return "bg-amber-50 text-amber-700 border-amber-200";
  if (priority === "LOW") return "bg-zinc-100 text-zinc-600 border-zinc-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

export interface AdminSupportCaseDetailProps {
  caseId?: string;
  caseData?: SupportCaseDetailData;
  agents?: Agent[];
  currentUserId?: string;
  onRefresh?: () => Promise<void>;
  onMutate?: (url: string, body: object, method?: string) => Promise<void>;
  saving?: boolean;
  notice?: string | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || "The support service is temporarily unavailable.");
  }
  return json.data as T;
}

export function AdminSupportCaseDetail(props: AdminSupportCaseDetailProps) {
  const { caseId } = props;
  const [internalCaseData, setInternalCaseData] = useState<SupportCaseDetailData | null>(props.caseData || null);
  const [internalAgents, setInternalAgents] = useState<Agent[]>(props.agents || []);
  const [loading, setLoading] = useState(!props.caseData && Boolean(caseId));
  const [saving, setSaving] = useState(props.saving || false);
  const [notice, setNotice] = useState<string | null>(props.notice || null);

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setNotice(null);
    try {
      const [caseRes, agentsRes] = await Promise.all([
        api<SupportCaseDetailData>(`/api/v1/support/cases/${caseId}`),
        props.agents ? Promise.resolve(props.agents) : api<Agent[]>("/api/v1/admin/support/agents").catch(() => []),
      ]);
      setInternalCaseData(caseRes);
      if (!props.agents) setInternalAgents(agentsRes);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to load support case details.");
    } finally {
      setLoading(false);
    }
  }, [caseId, props.agents]);

  useEffect(() => {
    if (!props.caseData && caseId) {
      void loadData();
    }
  }, [caseId, props.caseData, loadData]);

  const handleMutate = async (url: string, body: object, method = "POST") => {
    if (props.onMutate) {
      return props.onMutate(url, body, method);
    }
    setSaving(true);
    setNotice(null);
    try {
      await api(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadData();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to update support case.");
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (props.onRefresh) return props.onRefresh();
    await loadData();
  };

  const activeCaseData = props.caseData || internalCaseData;
  const activeAgents = props.agents || internalAgents;
  const isSaving = props.saving !== undefined ? props.saving : saving;
  const activeNotice = props.notice !== undefined ? props.notice : notice;

  if (loading || !activeCaseData) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="h-5 w-40 rounded-lg bg-zinc-200" />
          <div className="h-8 w-24 rounded-full bg-zinc-200" />
        </div>
        <div className="h-28 rounded-2xl bg-zinc-100" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 h-96 rounded-2xl bg-zinc-100" />
          <div className="lg:col-span-4 h-96 rounded-2xl bg-zinc-100" />
        </div>
      </div>
    );
  }

  return (
    <AdminSupportCaseDetailView
      caseData={activeCaseData}
      agents={activeAgents}
      currentUserId={props.currentUserId || activeCaseData.viewer?.id}
      onRefresh={handleRefresh}
      onMutate={handleMutate}
      saving={isSaving}
      notice={activeNotice}
    />
  );
}

function AdminSupportCaseDetailView({
  caseData,
  agents,
  currentUserId,
  onRefresh,
  onMutate,
  saving,
  notice,
}: {
  caseData: SupportCaseDetailData;
  agents: Agent[];
  currentUserId?: string;
  onRefresh: () => Promise<void>;
  onMutate: (url: string, body: object, method?: string) => Promise<void>;
  saving: boolean;
  notice: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"conversation" | "evidence" | "activity" | "history">("conversation");
  const [composerMode, setComposerMode] = useState<"public" | "internal">("public");
  const [targetAudience, setTargetAudience] = useState<"GUEST" | "HOST" | "ALL">("GUEST");
  const [messageText, setMessageText] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [escalationLevel, setEscalationLevel] = useState<number>(caseData.escalationLevel ? Math.min(4, caseData.escalationLevel + 1) : 2);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [submittingEscalation, setSubmittingEscalation] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const validNextStatuses = useMemo(() => {
    const allowed = CASE_TRANSITIONS[caseData.status as keyof typeof CASE_TRANSITIONS];
    return Object.entries(statusLabels).filter(
      ([val]) => val === caseData.status || (allowed && (allowed as ReadonlySet<string>).has(val))
    );
  }, [caseData.status]);

  // Check which participants exist in this case
  const participants = caseData.participants || [];
  const hasGuestParticipant = useMemo(() => {
    return (
      caseData.reporterRole === "GUEST" ||
      caseData.reporterRole === "REPORTER" ||
      participants.some((p) => p.role === "GUEST" || p.role === "REPORTER")
    );
  }, [caseData.reporterRole, participants]);

  const hasHostParticipant = useMemo(() => {
    return (
      caseData.reporterRole === "HOST" ||
      participants.some((p) => p.role === "HOST")
    );
  }, [caseData.reporterRole, participants]);

  // Adjust default target audience based on participants
  useEffect(() => {
    if (!hasGuestParticipant && hasHostParticipant) {
      setTargetAudience("HOST");
    } else if (hasGuestParticipant && !hasHostParticipant) {
      setTargetAudience("GUEST");
    }
  }, [hasGuestParticipant, hasHostParticipant]);

  // Scroll to bottom of message thread on tab change or new messages
  useEffect(() => {
    if (activeTab === "conversation") {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, caseData.messages?.length]);

  // SLA Calculation
  const slaOverdue = useMemo(() => {
    if (!caseData.slaDueAt || ["RESOLVED", "CLOSED"].includes(caseData.status)) return false;
    return new Date(caseData.slaDueAt).getTime() < Date.now();
  }, [caseData.slaDueAt, caseData.status]);

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || submittingMessage || saving) return;

    setSubmittingMessage(true);
    const idempotencyKey = `admin-msg-${caseData.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      if (composerMode === "internal") {
        await onMutate(`/api/v1/support/cases/${caseData.id}/messages`, {
          content: trimmed,
          visibility: "ADMINS_ONLY",
          idempotencyKey,
        });
      } else {
        await onMutate(`/api/v1/support/cases/${caseData.id}/messages`, {
          content: trimmed,
          visibility: "PARTICIPANTS",
          targetAudience,
          idempotencyKey,
        });
      }
      setMessageText("");
    } finally {
      setSubmittingMessage(false);
    }
  }

  async function handleEscalate(e: FormEvent) {
    e.preventDefault();
    const reasonTrimmed = escalationReason.trim();
    if (!reasonTrimmed || submittingEscalation || saving) return;

    if (caseData.status === "ESCALATED" && caseData.escalationLevel === escalationLevel) {
      return;
    }

    setSubmittingEscalation(true);
    const idempotencyKey = `admin-esc-${caseData.id}-${caseData.version}-${escalationLevel}`;
    try {
      await onMutate(`/api/v1/support/cases/${caseData.id}/escalation`, {
        expectedVersion: caseData.version,
        level: escalationLevel,
        reason: reasonTrimmed,
        idempotencyKey,
      });
      setEscalationReason("");
    } finally {
      setSubmittingEscalation(false);
    }
  }

  const isAlreadyAtSelectedLevel =
    caseData.status === "ESCALATED" && caseData.escalationLevel === escalationLevel;

  return (
    <div className="space-y-6">
      {/* ── Top Navigation Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-4">
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to all support cases
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-50 transition"
          >
            <svg
              className={`size-3.5 ${saving ? "animate-spin text-zinc-400" : "text-zinc-600"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs sm:text-sm text-red-800">
          {notice}
        </div>
      )}

      {/* ── Case Header ── */}
      <header className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-zinc-500 bg-zinc-100 px-2.5 py-0.5 rounded-md">
                {caseData.caseNumber}
              </span>
              <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium bg-zinc-50 text-zinc-700 border-zinc-200">
                {caseData.category.replaceAll("_", " ")}
              </span>
              {caseData.issueType && (
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium bg-zinc-50 text-zinc-600 border-zinc-200">
                  {caseData.issueType.replaceAll("_", " ")}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950 pt-1 break-words">
              {caseData.subject}
            </h1>
            <p className="text-xs text-zinc-500 font-normal">
              Opened on {date(caseData.createdAt)} · Latest activity {date(caseData.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium shadow-2xs ${priorityBadgeClass(
                caseData.priority
              )}`}
            >
              {caseData.priority} Priority
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium shadow-2xs ${statusBadgeClass(
                caseData.status
              )}`}
            >
              {statusLabels[caseData.status]}
            </span>
            {caseData.escalationLevel ? (
              <span className="rounded-full border border-rose-300 bg-rose-50 text-rose-800 px-3 py-1 text-xs font-medium shadow-2xs">
                Escalated Level {caseData.escalationLevel}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action Status Banner */}
        {caseData.status === "WAITING_FOR_GUEST" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-center gap-2.5">
            <svg className="size-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              <span className="font-medium">Action required from Guest:</span> Support has requested additional information. Case responsibility will return to In review when the guest replies.
            </span>
          </div>
        )}

        {caseData.status === "WAITING_FOR_HOST" && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 text-xs text-orange-900 flex items-center gap-2.5">
            <svg className="size-4 shrink-0 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              <span className="font-medium">Action required from Host:</span> Support has requested host input. Case responsibility will return to In review when the host replies.
            </span>
          </div>
        )}

        {caseData.status === "ESCALATED" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 flex items-center gap-2.5">
            <svg className="size-4 shrink-0 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>
              <span className="font-medium">Under Internal Escalation (Level {caseData.escalationLevel}):</span> {caseData.escalationReason || "Case escalated for supervisor review."}
              {caseData.escalationOwner && ` · Assigned reviewer: ${caseData.escalationOwner.name || caseData.escalationOwner.email}`}
            </span>
          </div>
        )}
      </header>

      {/* ── Main Layout: 2 Columns (Content + Right-side Panel) ── */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (8 cols): Tabs & Case Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-zinc-200 text-xs sm:text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("conversation")}
              className={`pb-3 px-4 border-b-2 transition cursor-pointer ${
                activeTab === "conversation"
                  ? "border-[#1F1F1F] text-zinc-950 font-medium"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Case Conversation ({caseData.messages?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("evidence")}
              className={`pb-3 px-4 border-b-2 transition cursor-pointer ${
                activeTab === "evidence"
                  ? "border-[#1F1F1F] text-zinc-950 font-medium"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Evidence ({caseData.evidence?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`pb-3 px-4 border-b-2 transition cursor-pointer ${
                activeTab === "activity"
                  ? "border-[#1F1F1F] text-zinc-950 font-medium"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Activity Timeline ({caseData.events?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`pb-3 px-4 border-b-2 transition cursor-pointer ${
                activeTab === "history"
                  ? "border-[#1F1F1F] text-zinc-950 font-medium"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Assignment &amp; Escalation ({caseData.assignmentHistory?.length || 0})
            </button>
          </div>

          {/* TAB 1: CONVERSATION */}
          {activeTab === "conversation" && (
            <div className="space-y-6">
              {/* Description Card */}
              {caseData.description && (
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 sm:p-5">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Initial Description by Reporter
                  </h3>
                  <p className="mt-2 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
                    {caseData.description}
                  </p>
                </div>
              )}

              {/* Message Thread */}
              <div className="rounded-3xl border border-zinc-200/90 bg-white shadow-xs overflow-hidden">
                <div className="border-b border-zinc-100 bg-zinc-50/70 p-4 px-5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-700">Communication Thread</span>
                    <span className="text-[11px] text-zinc-400 font-normal">
                      · {caseData.messages?.length || 0} messages
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-500 font-normal">
                    <span>Participants:</span>
                    <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      Guest: {hasGuestParticipant ? (caseData.reporter?.name || "Active") : "None"}
                    </span>
                    <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                      Host: {hasHostParticipant ? "Authorized" : "Not participating"}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4 max-h-[560px] overflow-y-auto">
                  {!caseData.messages?.length ? (
                    <div className="py-12 text-center text-zinc-400 text-sm">
                      <p>No messages recorded for this case yet.</p>
                      <p className="text-xs mt-1 text-zinc-400">
                        Use the composer below to send a public reply or record an internal note.
                      </p>
                    </div>
                  ) : (
                    caseData.messages.map((msg) => {
                      const isInternal = msg.visibility === "ADMINS_ONLY" || msg.targetAudience === "ADMINS_ONLY";
                      const isAdminSender = msg.sender.role === "ADMIN" || msg.sender.email?.endsWith("@homyz.app");
                      const isHostSender = !isAdminSender && caseData.reporterRole === "HOST";

                      // Internal Note Card
                      if (isInternal) {
                        return (
                          <div
                            key={msg.id}
                            className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-2xs space-y-2 animate-in fade-in duration-150"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                                <svg className="size-3.5 text-amber-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <span>Internal Note · Admin Only</span>
                                <span className="text-amber-700/60 font-normal">({msg.sender.name || "Admin"})</span>
                              </div>
                              <time className="text-[11px] text-amber-800/70 font-normal">
                                {date(msg.createdAt)}
                              </time>
                            </div>
                            <p className="text-xs sm:text-sm text-amber-950 whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        );
                      }

                      // Public Admin Reply (Right-aligned dark bubble)
                      if (isAdminSender) {
                        return (
                          <div key={msg.id} className="flex flex-col items-end space-y-1">
                            <div className="max-w-[85%] rounded-2xl bg-[#1A1A1A] p-4 text-white shadow-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-3 border-b border-zinc-700/50 pb-1.5 text-[11px]">
                                <span className="font-medium text-[#FCDF9C]">
                                  StayElite Support ({msg.sender.name || "Admin"})
                                </span>
                                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 font-normal">
                                  {msg.targetAudience === "GUEST"
                                    ? "Sent to: Guest only"
                                    : msg.targetAudience === "HOST"
                                      ? "Sent to: Host only"
                                      : "Shared with Guest & Host"}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed">
                                {msg.content}
                              </p>
                            </div>
                            <span className="text-[10px] text-zinc-400 pr-1">
                              {date(msg.createdAt)}
                            </span>
                          </div>
                        );
                      }

                      // Public Participant Message (Guest / Host Left-aligned bubble)
                      return (
                        <div key={msg.id} className="flex flex-col items-start space-y-1">
                          <div
                            className={`max-w-[85%] rounded-2xl p-4 shadow-xs space-y-1.5 border ${
                              isHostSender
                                ? "bg-orange-50/50 border-orange-200/80 text-zinc-900"
                                : "bg-zinc-50 border-zinc-200/80 text-zinc-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 border-b border-zinc-200/60 pb-1.5 text-[11px]">
                              <span className="font-medium text-zinc-900">
                                {msg.sender.name || (isHostSender ? "Host" : "Guest")}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  isHostSender
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {isHostSender ? "Property Host" : "Guest / Reporter"}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                          <span className="text-[10px] text-zinc-400 pl-1">
                            {date(msg.createdAt)}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={messageEndRef} />
                </div>

                {/* ── Advanced Message Composer ── */}
                <div className="border-t border-zinc-200 bg-zinc-50/50 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setComposerMode("public")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                        composerMode === "public"
                          ? "bg-[#1F1F1F] text-white shadow-2xs"
                          : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      Send Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode("internal")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                        composerMode === "internal"
                          ? "bg-amber-600 text-white shadow-2xs"
                          : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                      }`}
                    >
                      <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Internal Note (Admin only)
                    </button>
                  </div>

                  {composerMode === "public" ? (
                    /* Public Recipient Selector */
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-zinc-500 font-normal">Deliver to:</span>
                      <button
                        type="button"
                        onClick={() => setTargetAudience("GUEST")}
                        className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer border ${
                          targetAudience === "GUEST"
                            ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        Guest only
                      </button>

                      {hasHostParticipant ? (
                        <button
                          type="button"
                          onClick={() => setTargetAudience("HOST")}
                          className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer border ${
                            targetAudience === "HOST"
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          Host only
                        </button>
                      ) : (
                        <span
                          title="Host is not an authorized participant in this case"
                          className="rounded-lg px-2.5 py-1 text-zinc-400 border border-dashed border-zinc-200 text-[11px] cursor-not-allowed"
                        >
                          Host only (Not participating)
                        </span>
                      )}

                      {hasHostParticipant && hasGuestParticipant && (
                        <button
                          type="button"
                          onClick={() => setTargetAudience("ALL")}
                          className={`rounded-lg px-2.5 py-1 font-medium transition cursor-pointer border ${
                            targetAudience === "ALL"
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-2xs"
                              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                          }`}
                        >
                          Guest &amp; Host (Shared)
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Internal Note Banner */
                    <div className="mb-3 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 flex items-center gap-2">
                      <svg className="size-3.5 text-amber-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>
                        🔒 This note will only be visible to administrators. Guests and hosts will never see it.
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="space-y-3">
                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      maxLength={10000}
                      rows={3}
                      placeholder={
                        composerMode === "internal"
                          ? "Add an internal note visible only to support staff..."
                          : targetAudience === "GUEST"
                            ? "Type a public reply to the guest..."
                            : targetAudience === "HOST"
                              ? "Type a public reply to the property host..."
                              : "Type a shared reply to all case participants..."
                      }
                      className="w-full rounded-2xl border border-zinc-300 bg-white p-3 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none transition shadow-2xs"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-400 font-normal">
                        {messageText.length} / 10,000 characters
                      </span>

                      <button
                        type="submit"
                        disabled={submittingMessage || saving || !messageText.trim()}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium text-white shadow-2xs transition disabled:opacity-50 cursor-pointer ${
                          composerMode === "internal"
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-[#1F1F1F] hover:bg-zinc-800"
                        }`}
                      >
                        {submittingMessage ? (
                          <>
                            <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending…
                          </>
                        ) : composerMode === "internal" ? (
                          "Add Internal Note"
                        ) : (
                          "Send Reply"
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVIDENCE */}
          {activeTab === "evidence" && (
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-medium text-zinc-950">Submitted Case Evidence</h3>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  Private binary evidence uploaded by case participants or support staff.
                </p>
              </div>

              {!caseData.evidence?.length ? (
                <div className="py-12 text-center text-zinc-400 text-sm rounded-2xl border border-dashed border-zinc-200">
                  No evidence files attached to this support case.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
                  {caseData.evidence.map((item) => (
                    <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-zinc-50/60 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0">
                          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-zinc-900 truncate">
                            {item.originalName}
                          </p>
                          <p className="text-[11px] text-zinc-400 font-normal">
                            {bytes(item.sizeBytes)} · {item.mimeType} · Uploaded {date(item.createdAt)}
                          </p>
                        </div>
                      </div>

                      <a
                        href={`/api/v1/support/cases/${caseData.id}/evidence/${item.id}?download=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-2xs transition"
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download Securely
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVITY TIMELINE */}
          {activeTab === "activity" && (
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-medium text-zinc-950">Case Activity History</h3>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  Append-only chronological audit log of all events and state changes.
                </p>
              </div>

              {!caseData.events?.length ? (
                <div className="py-12 text-center text-zinc-400 text-sm">
                  No activity events recorded yet.
                </div>
              ) : (
                <ol className="relative border-l border-zinc-200/80 ml-3 space-y-5 py-2">
                  {caseData.events.map((evt) => (
                    <li key={evt.id} className="ml-5 relative">
                      <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-[#1F1F1F] ring-4 ring-white" />
                      <p className="text-xs sm:text-sm font-medium text-zinc-900 leading-snug">
                        {evt.description || evt.eventType.replaceAll("_", " ")}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-1">
                        {evt.actor?.name && <span>By {evt.actor.name}</span>}
                        <span>·</span>
                        <time>{date(evt.createdAt)}</time>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* TAB 4: ASSIGNMENT & ESCALATION HISTORY */}
          {activeTab === "history" && (
            <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 sm:p-7 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-medium text-zinc-950">Assignment Audit Trail</h3>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  Complete record of agent handoffs and responsibility changes.
                </p>
              </div>

              {!caseData.assignmentHistory?.length ? (
                <div className="py-8 text-center text-zinc-400 text-sm rounded-2xl border border-dashed border-zinc-200">
                  No assignment changes recorded yet. Case is currently {caseData.assignedAdmin ? `assigned to ${caseData.assignedAdmin.name || caseData.assignedAdmin.email}` : "unassigned"}.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden text-xs">
                  {caseData.assignmentHistory.map((item) => (
                    <div key={item.id} className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {item.previousAssignee?.name || item.previousAssignee?.email || "Unassigned"}
                          {" → "}
                          <span className="text-emerald-700">
                            {item.newAssignee?.name || item.newAssignee?.email || "Unassigned"}
                          </span>
                        </p>
                        {item.reason && (
                          <p className="text-zinc-500 mt-0.5 font-normal">Reason: {item.reason}</p>
                        )}
                      </div>
                      <time className="text-[11px] text-zinc-400 shrink-0 font-normal">
                        {date(item.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Management & Actions Panel */}
        <aside className="lg:col-span-4 space-y-5">
          {/* 1. Case Management Card */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-medium text-zinc-950 border-b border-zinc-100 pb-2.5">
              Case Management
            </h3>

            {/* Assignee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-700">Assigned Agent</label>
                {currentUserId && caseData.assignedAdmin?.id !== currentUserId && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void onMutate(
                        `/api/v1/support/cases/${caseData.id}/assignment`,
                        { assignedAdminId: currentUserId, expectedVersion: caseData.version },
                        "PATCH"
                      )
                    }
                    className="text-[11px] font-medium text-indigo-700 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              <select
                value={caseData.assignedAdmin?.id || ""}
                onChange={(e) =>
                  void onMutate(
                    `/api/v1/support/cases/${caseData.id}/assignment`,
                    { assignedAdminId: e.target.value || null, expectedVersion: caseData.version },
                    "PATCH"
                  )
                }
                disabled={saving}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none disabled:opacity-50"
              >
                <option value="">Unassigned</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name || ag.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700">Priority Level</label>
              <select
                value={caseData.priority}
                onChange={(e) =>
                  void onMutate(
                    `/api/v1/support/cases/${caseData.id}/priority`,
                    { priority: e.target.value, expectedVersion: caseData.version },
                    "PATCH"
                  )
                }
                disabled={saving}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none disabled:opacity-50"
              >
                <option value="LOW">Low (120h target)</option>
                <option value="MEDIUM">Medium (72h target)</option>
                <option value="HIGH">High (36h target)</option>
                <option value="URGENT">Urgent (16h target)</option>
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700">Case Status</label>
              <select
                value={caseData.status}
                onChange={(e) => {
                  const nextStatus = e.target.value;
                  if (nextStatus === caseData.status) return;
                  void onMutate(
                    `/api/v1/support/cases/${caseData.id}/status`,
                    {
                      status: nextStatus,
                      expectedVersion: caseData.version,
                      reason:
                        nextStatus === "REOPENED"
                          ? "Reopened by support administrator"
                          : nextStatus === "ESCALATED"
                          ? "Escalated by support administrator"
                          : nextStatus === "CLOSED"
                          ? "Case closed by support administrator"
                          : undefined,
                    },
                    "PATCH"
                  );
                }}
                disabled={saving}
                className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden disabled:opacity-50"
              >
                {validNextStatuses.map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Escalation Panel */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
              <h3 className="text-sm font-medium text-zinc-950">Internal Escalation</h3>
              {caseData.escalationLevel ? (
                <span className="text-[10px] bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-medium">
                  Level {caseData.escalationLevel} Active
                </span>
              ) : (
                <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-medium">
                  Normal Flow
                </span>
              )}
            </div>

            <form onSubmit={handleEscalate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Target Tier</label>
                <select
                  value={escalationLevel}
                  onChange={(e) => setEscalationLevel(Number(e.target.value))}
                  disabled={saving || submittingEscalation}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none disabled:opacity-50"
                >
                  <option value={1}>Level 1 – Support Agent</option>
                  <option value={2}>Level 2 – Senior Support</option>
                  <option value={3}>Level 3 – Support Supervisor / Admin</option>
                  <option value={4}>Level 4 – Critical Review</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">Reason for Escalation</label>
                <textarea
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="State the technical, policy, or safety reason for escalating..."
                  disabled={saving || submittingEscalation}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={saving || submittingEscalation || !escalationReason.trim() || isAlreadyAtSelectedLevel}
                className="w-full rounded-full border border-rose-300 bg-rose-50/80 px-4 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50 cursor-pointer transition shadow-2xs"
              >
                {submittingEscalation ? (
                  "Escalating case…"
                ) : isAlreadyAtSelectedLevel ? (
                  `Already Escalated to Level ${escalationLevel}`
                ) : (
                  `Escalate to Level ${escalationLevel}`
                )}
              </button>
            </form>
          </div>

          {/* 3. SLA & Policy Card */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-medium text-zinc-950 border-b border-zinc-100 pb-2">
              SLA &amp; Timelines
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-normal">SLA Status:</span>
                {slaOverdue ? (
                  <span className="rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-medium">
                    Breached / Overdue
                  </span>
                ) : ["RESOLVED", "CLOSED"].includes(caseData.status) ? (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-medium">
                    Completed
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium border border-emerald-200">
                    On Track
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-normal">First Response Due:</span>
                <span className="text-zinc-800 font-medium">{date(caseData.firstResponseDueAt)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 font-normal">Resolution Target:</span>
                <span className="text-zinc-800 font-medium">{date(caseData.slaDueAt)}</span>
              </div>
            </div>
          </div>

          {/* 4. Case Context & Participant Summary */}
          <div className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-xs space-y-3 text-xs">
            <h3 className="text-sm font-medium text-zinc-950 border-b border-zinc-100 pb-2">
              Case Context
            </h3>

            <div className="space-y-2">
              <div>
                <span className="text-zinc-500 font-normal block">Reporter:</span>
                <span className="text-zinc-900 font-medium">
                  {caseData.reporter?.name || "Unknown"}
                  {caseData.reporter?.email ? ` (${caseData.reporter.email})` : ""}
                </span>
                <span className="ml-1.5 text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600 font-normal">
                  {caseData.reporterRole || "Reporter"}
                </span>
              </div>

              {caseData.booking && (
                <div>
                  <span className="text-zinc-500 font-normal block">Reservation:</span>
                  <span className="text-zinc-900 font-medium">
                    {caseData.booking.submissionId || caseData.booking.id}
                  </span>
                  {caseData.booking.startDate && caseData.booking.endDate && (
                    <span className="text-zinc-500 font-normal block text-[11px]">
                      {new Date(caseData.booking.startDate).toLocaleDateString()} – {new Date(caseData.booking.endDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              {caseData.listing && (
                <div>
                  <span className="text-zinc-500 font-normal block">Property:</span>
                  <span className="text-zinc-900 font-medium">
                    {caseData.listing.title}
                    {caseData.listing.city ? ` · ${caseData.listing.city}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
