"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AttachmentPicker } from "@/components/support/attachment-picker";

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

type CaseMessage = {
  id: string;
  content: string;
  createdAt: string;
  targetAudience?: string;
  sender: {
    id?: string;
    name: string | null;
    role?: string;
  };
};

type Offer = {
  id: string;
  version: number;
  offerType: string;
  status: string;
  amount: number | null;
  currency: string;
  description: string;
  expiresAt: string | null;
  proposer: { id: string; name: string | null };
  recipient: { id: string; name: string | null };
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
  version: number;
  createdAt: string;
  updatedAt: string;
  booking?: {
    id: string;
    submissionId?: string | null;
    startDate?: string;
    endDate?: string;
  } | null;
  listing?: { id: string; title?: string | null; city?: string | null } | null;
  messages?: CaseMessage[];
  evidence?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }[];
  events?: {
    id: string;
    eventType: string;
    description: string | null;
    createdAt: string;
  }[];
  resolutionOffers?: Offer[];
  viewer: { id: string; role?: string | null; isAdmin?: boolean };
};

type OfferFormState = {
  offerType: string;
  amount: string;
  description: string;
  expiresAt: string;
};

const emptyOffer: OfferFormState = {
  offerType: "PARTIAL_REFUND",
  amount: "",
  description: "",
  expiresAt: "",
};

const labels: Record<Status, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  WAITING_FOR_GUEST: "Waiting for Guest",
  WAITING_FOR_HOST: "Action Needed from You",
  WAITING_FOR_ADMIN: "Waiting for Support",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  ESCALATED: "Escalated",
};

const mutable = new Set<Status>([
  "OPEN",
  "IN_REVIEW",
  "WAITING_FOR_GUEST",
  "WAITING_FOR_HOST",
  "WAITING_FOR_ADMIN",
  "REOPENED",
  "ESCALATED",
]);

const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const money = (amount: number | null, currency = "USD") => {
  if (amount === null || Number.isNaN(amount)) return "No payment";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
};

const bytes = (value: number) =>
  value < 1048576
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1048576).toFixed(1)} MB`;

const title = (text: string) =>
  text
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.error?.message || "Support service is temporarily unavailable.",
    );
  }
  return payload.data as T;
}

function badge(status: Status) {
  if (status === "RESOLVED")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "CLOSED")
    return "bg-zinc-100 text-zinc-600 border border-zinc-200";
  if (status === "WAITING_FOR_HOST")
    return "bg-amber-50 text-amber-800 border border-amber-200";
  if (status === "ESCALATED")
    return "bg-rose-50 text-rose-800 border border-rose-200";
  return "bg-blue-50 text-blue-800 border border-blue-200";
}

function OfferFields({
  form,
  onChange,
}: {
  form: OfferFormState;
  onChange: (next: OfferFormState) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-700 sm:text-sm">
          Resolution Type
          <select
            value={form.offerType}
            onChange={(e) => onChange({ ...form, offerType: e.target.value })}
            className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs font-normal text-zinc-900 sm:text-sm"
          >
            <option value="PARTIAL_REFUND">Partial refund</option>
            <option value="FULL_REFUND">Full refund</option>
            <option value="EXTRA_SERVICES">Extra services</option>
            <option value="MUTUAL_CANCELLATION">Mutual cancellation</option>
            <option value="OTHER">Other settlement</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-700 sm:text-sm">
          Amount (USD, optional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => onChange({ ...form, amount: e.target.value })}
            placeholder="0.00"
            className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs font-normal text-zinc-900 placeholder:text-zinc-400 sm:text-sm"
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-zinc-700 sm:text-sm">
        Offer Details &amp; Proposed Terms
        <textarea
          required
          maxLength={2000}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Explain the proposed resolution terms clearly..."
          className="mt-1 min-h-20 w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-normal text-zinc-900 placeholder:text-zinc-400 sm:text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-700 sm:text-sm">
        Offer Expiration (optional)
        <input
          type="datetime-local"
          value={form.expiresAt}
          onChange={(e) => onChange({ ...form, expiresAt: e.target.value })}
          className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs font-normal text-zinc-900 sm:text-sm"
        />
      </label>
    </div>
  );
}

export function HostCaseDetailClient({
  caseId,
  initialSearchParams = {},
}: {
  caseId: string;
  initialSearchParams?: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [mediationReason, setMediationReason] = useState("");
  const [offerForm, setOfferForm] = useState<OfferFormState>(emptyOffer);
  const [countering, setCountering] = useState<Offer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const replyKey = useRef<string | null>(null);
  const discussionKey = useRef<string | null>(null);

  const loadCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Case>(
        `/api/v1/support/cases/${encodeURIComponent(caseId)}`,
      );
      setActive(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load support case details.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  // Construct return link back to the host support dashboard
  const rawView =
    typeof initialSearchParams.view === "string"
      ? initialSearchParams.view
      : undefined;
  const rawTab =
    typeof initialSearchParams.tab === "string"
      ? initialSearchParams.tab
      : undefined;
  const currentView = rawView || rawTab || "all";

  const buildReturnHref = () => {
    const params = new URLSearchParams();
    if (rawView) params.set("view", rawView);
    else if (rawTab) params.set("tab", rawTab);

    if (
      typeof initialSearchParams.category === "string" &&
      initialSearchParams.category
    ) {
      params.set("category", initialSearchParams.category);
    }
    if (
      typeof initialSearchParams.status === "string" &&
      initialSearchParams.status
    ) {
      params.set("status", initialSearchParams.status);
    }
    if (
      typeof initialSearchParams.search === "string" &&
      initialSearchParams.search.trim()
    ) {
      params.set("search", initialSearchParams.search.trim());
    }
    if (
      typeof initialSearchParams.page === "string" &&
      initialSearchParams.page
    ) {
      params.set("page", initialSearchParams.page);
    }

    const qs = params.toString();
    return `/host/support${qs ? `?${qs}` : ""}`;
  };

  const sendSupportReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !reply.trim()) return;
    setSubmitting(true);
    setError(null);
    replyKey.current ??=
      globalThis.crypto?.randomUUID?.() || `host-reply-${Date.now()}`;
    try {
      await api(`/api/v1/support/cases/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: reply.trim(),
          idempotencyKey: replyKey.current,
        }),
      });
      replyKey.current = null;
      setReply("");
      await loadCase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reply.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendDiscussionMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !discussion.trim()) return;
    setSubmitting(true);
    setError(null);
    discussionKey.current ??=
      globalThis.crypto?.randomUUID?.() || `resolution-msg-${Date.now()}`;
    try {
      await api(`/api/v1/support/cases/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: discussion.trim(),
          idempotencyKey: discussionKey.current,
        }),
      });
      discussionKey.current = null;
      setDiscussion("");
      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send discussion message.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOffer = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !offerForm.description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/v1/support/cases/${active.id}/resolution-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerType: offerForm.offerType,
          amount: offerForm.amount ? Number(offerForm.amount) : undefined,
          description: offerForm.description.trim(),
          expiresAt: offerForm.expiresAt || undefined,
          parentOfferId: countering?.id,
          idempotencyKey:
            globalThis.crypto?.randomUUID?.() || `offer-${Date.now()}`,
        }),
      });
      setOfferForm(emptyOffer);
      setCountering(null);
      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit resolution offer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOfferAction = async (
    offer: Offer,
    action: "ACCEPT" | "REJECT" | "WITHDRAW",
  ) => {
    if (!window.confirm(`${title(action)} this resolution offer?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/v1/support/resolution-offers/${offer.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedVersion: offer.version }),
      });
      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update resolution offer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestMediation = async () => {
    if (!active || !mediationReason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/v1/support/cases/${active.id}/mediation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: active.version,
          reason: mediationReason.trim(),
        }),
      });
      setMediationReason("");
      await loadCase();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to request mediation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadEvidence = async () => {
    if (!active || evidenceFiles.length === 0) return;
    setUploading(true);
    setError(null);
    let uploaded = 0;
    try {
      for (const file of evidenceFiles) {
        const data = new FormData();
        data.set("file", file);
        await api(`/api/v1/support/cases/${active.id}/evidence/upload`, {
          method: "POST",
          body: data,
        });
        uploaded += 1;
      }
      setEvidenceFiles([]);
      await loadCase();
    } catch (err) {
      setEvidenceFiles((current) => current.slice(uploaded));
      setError(
        err instanceof Error ? err.message : "Unable to upload evidence.",
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse font-sans">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-zinc-200" />
            <div className="h-8 w-72 rounded-lg bg-zinc-200" />
          </div>
          <div className="flex gap-4">
            <div className="h-6 w-24 rounded bg-zinc-200" />
            <div className="h-6 w-36 rounded bg-zinc-200" />
          </div>
        </div>
        <div className="h-48 rounded-2xl bg-zinc-100 border border-zinc-200" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-96 rounded-2xl bg-zinc-100 border border-zinc-200" />
          <div className="space-y-5">
            <div className="h-44 rounded-2xl bg-zinc-100 border border-zinc-200" />
            <div className="h-44 rounded-2xl bg-zinc-100 border border-zinc-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !active) {
    return (
      <div className="space-y-6 font-sans">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-5">
          <div>
            <p className="text-xs font-medium text-zinc-500">Host Operations</p>
            <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">
              Case Not Found
            </h1>
          </div>
          <Link
            href={buildReturnHref()}
            className="text-xs font-medium text-zinc-900 underline underline-offset-4 sm:text-sm"
          >
            {getReturnLabel()}
          </Link>
        </div>
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-normal text-red-800"
        >
          {error ||
            "This support case could not be found or you do not have permission to view it."}
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => router.push(buildReturnHref())}
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black transition-colors shadow-2xs"
          >
            Return to Support Center
          </button>
        </div>
      </div>
    );
  }

  const isDirectResolution =
    (active.resolutionOffers && active.resolutionOffers.length > 0) ||
    currentView === "direct";

  return (
    <section className="animate-in fade-in duration-300 font-sans text-[#1F1F1F] space-y-6">
      {/* Top Header & Navigation */}
      <div className="border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Link
              href={buildReturnHref()}
              aria-label="Back to case list"
              title="Back to case list"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-900 text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <p className="text-xs font-medium text-zinc-500">
              Host Operations / Help &amp; Resolution Center
            </p>
          </div>
          <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">
            {active.subject}
          </h1>
          <p className="mt-1 text-xs font-normal text-zinc-500">
            Case{" "}
            <span className="font-mono font-medium text-zinc-700">
              {active.caseNumber}
            </span>{" "}
            · Created {date(active.createdAt)}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-normal text-red-800"
        >
          {error}
        </div>
      )}

      {/* Prominent Action Banner for WAITING_FOR_HOST */}
      {active.status === "WAITING_FOR_HOST" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-sm text-amber-950 flex items-start gap-3 shadow-2xs">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 mt-0.5">
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <div>
            <h4 className="font-medium text-amber-950 text-sm">
              Action Needed: Support requested your input
            </h4>
            <p className="mt-0.5 text-xs text-amber-800 font-normal leading-relaxed">
              StayElite Support has requested additional details or verification
              regarding this case. Please reply below so we can proceed.
            </p>
          </div>
        </div>
      )}

      {/* Case Overview Card */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium text-zinc-500">
              {active.caseNumber}
            </span>
            {isDirectResolution && (
              <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
                Direct resolution
              </span>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${badge(active.status)}`}
          >
            {labels[active.status]}
          </span>
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-zinc-500 font-normal text-xs">Category</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {active.category.replaceAll("_", " ")}
              {active.issueType
                ? ` · ${active.issueType.replaceAll("_", " ")}`
                : ""}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-normal text-xs">
              Related Property / Booking
            </dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {active.booking?.id ? (
                <Link
                  href={`/host/bookings/${encodeURIComponent(active.booking.id)}`}
                  className="underline underline-offset-2 hover:text-black transition-colors"
                >
                  {active.listing?.title ||
                    active.booking.submissionId ||
                    "Booking Record"}
                </Link>
              ) : (
                active.listing?.title || "Platform Support Request"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-normal text-xs">Created</dt>
            <dd className="mt-0.5 font-normal text-zinc-700">
              {date(active.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 font-normal text-xs">Last Activity</dt>
            <dd className="mt-0.5 font-normal text-zinc-700">
              {date(active.updatedAt)}
            </dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl bg-zinc-50 border border-zinc-100 p-4">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Inquiry Description
          </span>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800 font-normal">
            {active.description || "No detailed description was provided."}
          </p>
        </div>

        {["RESOLVED", "CLOSED"].includes(active.status) && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-normal text-emerald-900">
            This request has been {labels[active.status].toLowerCase()}. Any
            official resolution appears in the case activity.
          </p>
        )}
      </section>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Discussion, Negotiation & Communication */}
        <div className="space-y-6">
          {isDirectResolution ? (
            <>
              {/* Guest-Host Discussion Section */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-950">
                      Guest–host discussion
                    </h2>
                    <p className="text-xs font-normal text-zinc-500 mt-0.5">
                      Direct messaging between host and guest. Shared with
                      authorized case participants.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {!active.messages?.length ? (
                    <p className="text-center text-sm font-normal text-zinc-500 bg-zinc-50 rounded-xl p-6">
                      No discussion messages yet. Start the conversation with
                      the booking participant below.
                    </p>
                  ) : (
                    active.messages.map((message) => {
                      const own = message.sender?.id === active.viewer?.id;
                      const isSupport = message.sender?.role === "ADMIN";

                      return (
                        <article
                          key={message.id}
                          className={`max-w-[88%] rounded-2xl p-4 text-sm ${
                            own
                              ? "ml-auto bg-zinc-900 text-white"
                              : isSupport
                                ? "bg-amber-50 border border-amber-200 text-zinc-900"
                                : "bg-zinc-100 text-zinc-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`text-xs font-medium ${own ? "text-zinc-300" : isSupport ? "text-amber-900" : "text-zinc-600"}`}
                            >
                              {own
                                ? "You (Host)"
                                : isSupport
                                  ? "StayElite Support"
                                  : `${message.sender?.name || "Guest"}`}
                            </span>
                            <time
                              className={`text-[11px] font-normal ${own ? "text-zinc-400" : "text-zinc-500"}`}
                            >
                              {date(message.createdAt)}
                            </time>
                          </div>
                          <p className="whitespace-pre-wrap leading-6 font-normal">
                            {message.content}
                          </p>
                        </article>
                      );
                    })
                  )}
                </div>

                {mutable.has(active.status) && (
                  <form
                    onSubmit={sendDiscussionMessage}
                    className="mt-6 border-t border-zinc-200 pt-5"
                  >
                    <label className="block text-sm font-medium text-zinc-900">
                      Message to booking participant
                      <textarea
                        value={discussion}
                        maxLength={10000}
                        onChange={(e) => setDiscussion(e.target.value)}
                        placeholder="Write a message to the booking participant…"
                        className="mt-2 min-h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm font-normal text-zinc-900 placeholder:text-zinc-400 leading-relaxed focus:border-zinc-900 focus:outline-hidden"
                      />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting || !discussion.trim()}
                        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-black transition-colors"
                      >
                        {submitting ? "Sending…" : "Send message"}
                      </button>
                    </div>
                  </form>
                )}
              </section>

              {/* Negotiation History & Offers */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
                <div className="border-b border-zinc-100 pb-4">
                  <h2 className="text-lg font-medium text-zinc-950">
                    Negotiation history &amp; offers
                  </h2>
                  <p className="text-xs font-normal text-zinc-500 mt-0.5">
                    Official resolution offers. Accept, counter, or propose a
                    financial agreement.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {!active.resolutionOffers?.length ? (
                    <p className="text-center text-sm font-normal text-zinc-500 bg-zinc-50 rounded-xl p-4">
                      No offers proposed yet. You can submit a resolution offer
                      below.
                    </p>
                  ) : (
                    active.resolutionOffers.map((offer) => {
                      const isRecipient =
                        active.viewer?.id === offer.recipient?.id;
                      const isProposer =
                        active.viewer?.id === offer.proposer?.id;

                      return (
                        <article
                          key={offer.id}
                          className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-sm text-zinc-950">
                              {title(offer.offerType)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                offer.status === "ACCEPTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : offer.status === "REJECTED"
                                    ? "bg-rose-100 text-rose-800"
                                    : offer.status === "WITHDRAWN"
                                      ? "bg-zinc-200 text-zinc-700"
                                      : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {offer.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-zinc-900">
                            {money(offer.amount, offer.currency)} ·{" "}
                            {offer.proposer?.name || "Participant"} →{" "}
                            {offer.recipient?.name || "Participant"}
                          </p>
                          <p className="mt-1 text-sm font-normal text-zinc-700 leading-relaxed">
                            {offer.description}
                          </p>
                          {offer.expiresAt && (
                            <p className="mt-2 text-xs font-normal text-zinc-500">
                              Expires {date(offer.expiresAt)}
                            </p>
                          )}
                          {offer.status === "PENDING" &&
                            mutable.has(active.status) && (
                              <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-zinc-200">
                                {isRecipient && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() =>
                                        void handleOfferAction(offer, "ACCEPT")
                                      }
                                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() =>
                                        void handleOfferAction(offer, "REJECT")
                                      }
                                      className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-50 transition-colors"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() => {
                                        setCountering(offer);
                                        setOfferForm({
                                          offerType: offer.offerType,
                                          amount:
                                            offer.amount?.toString() || "",
                                          description: "",
                                          expiresAt: "",
                                        });
                                      }}
                                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                                    >
                                      Counteroffer
                                    </button>
                                  </>
                                )}
                                {isProposer && (
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() =>
                                      void handleOfferAction(offer, "WITHDRAW")
                                    }
                                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                                  >
                                    Withdraw
                                  </button>
                                )}
                              </div>
                            )}
                        </article>
                      );
                    })
                  )}
                </div>

                {mutable.has(active.status) && (
                  <form
                    onSubmit={handleCreateOffer}
                    className="mt-6 border-t border-zinc-200 pt-5"
                  >
                    <h3 className="font-medium text-sm text-zinc-950">
                      {countering
                        ? "Counteroffer proposal"
                        : "Propose a new offer"}
                    </h3>
                    {countering && (
                      <button
                        type="button"
                        onClick={() => setCountering(null)}
                        className="mt-1 text-xs font-medium text-zinc-500 underline"
                      >
                        Cancel counteroffer mode
                      </button>
                    )}
                    <div className="mt-3">
                      <OfferFields form={offerForm} onChange={setOfferForm} />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-black transition-colors"
                    >
                      {submitting
                        ? "Submitting…"
                        : countering
                          ? "Send counteroffer"
                          : "Submit resolution offer"}
                    </button>
                  </form>
                )}
              </section>
            </>
          ) : (
            /* Standard Support Case Communication Thread */
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
              <h3 className="text-lg font-medium text-zinc-900">
                Support Communication
              </h3>
              <p className="text-xs font-normal text-zinc-500 mt-0.5">
                Direct messages between you and the StayElite Support Operations
                team.
              </p>

              {!active.messages?.length ? (
                <p className="mt-5 text-sm font-normal text-zinc-500 bg-zinc-50 rounded-xl p-6 text-center">
                  No replies yet. An operations specialist will review your
                  request shortly.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {active.messages.map((entry) => {
                    const isStaff =
                      entry.sender?.role === "ADMIN" || !entry.sender?.role;

                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl p-4 border transition-all ${
                          isStaff
                            ? "bg-zinc-50 border-zinc-200/90"
                            : "bg-white border-amber-200/80 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            {isStaff ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-medium text-white">
                                <svg
                                  className="size-3"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                                </svg>
                                <span>StayElite Support</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
                                <span>You (Host)</span>
                              </span>
                            )}
                            <span className="font-medium text-zinc-800">
                              {entry.sender?.name ||
                                (isStaff ? "Support Operations" : "You")}
                            </span>
                          </div>
                          <time className="text-zinc-400 font-normal">
                            {date(entry.createdAt)}
                          </time>
                        </div>
                        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-zinc-800 font-normal">
                          {entry.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {mutable.has(active.status) && (
                <form
                  onSubmit={sendSupportReply}
                  className="mt-6 border-t border-zinc-200 pt-5"
                >
                  <label className="block text-sm font-medium text-zinc-900">
                    Reply to StayElite Support
                    <textarea
                      value={reply}
                      maxLength={10000}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your response or clarification here..."
                      className="mt-2 min-h-24 w-full rounded-xl border border-zinc-200 p-3 text-sm font-normal text-zinc-900 placeholder:text-zinc-400 leading-relaxed focus:border-zinc-900 focus:outline-hidden"
                    />
                  </label>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || !reply.trim()}
                      className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-black transition-colors"
                    >
                      {submitting ? "Sending…" : "Send Reply"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Evidence, Mediation & Case Activity */}
        <aside className="space-y-6">
          {/* Supporting Evidence Section */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
            <h3 className="font-medium text-base text-zinc-900">
              Evidence &amp; Documents
            </h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500 font-normal">
              Upload images, receipts, or PDFs up to 15 MB. Files are stored
              securely and only accessible by authorized case participants.
            </p>

            <div className="mt-4">
              <AttachmentPicker
                files={evidenceFiles}
                onChange={setEvidenceFiles}
                onError={setError}
                disabled={!mutable.has(active.status) || uploading}
                label="Select evidence"
                description="JPG, PNG, WEBP, or PDF files up to 15 MB each."
              />
              <button
                type="button"
                disabled={
                  !mutable.has(active.status) ||
                  uploading ||
                  evidenceFiles.length === 0
                }
                onClick={() => void handleUploadEvidence()}
                className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading
                  ? "Uploading…"
                  : `Upload ${evidenceFiles.length || ""} evidence${
                      evidenceFiles.length === 1 ? "" : " files"
                    }`}
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {active.evidence?.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`/api/v1/support/cases/${active.id}/evidence/${entry.id}?download=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg bg-zinc-50 p-2.5 text-xs font-medium text-zinc-900 hover:bg-zinc-100 transition-colors underline"
                  >
                    {entry.originalName}
                    <span className="ml-1 text-[11px] font-normal text-zinc-500">
                      ({bytes(entry.sizeBytes)})
                    </span>
                  </a>
                </li>
              ))}
              {!active.evidence?.length && (
                <li className="text-xs font-normal text-zinc-400 py-2">
                  No evidence uploaded.
                </li>
              )}
            </ul>
          </section>

          {/* Request Mediation (For direct resolution or escalated booking disputes) */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
            <h3 className="font-medium text-base text-zinc-900">
              Request mediation
            </h3>
            <p className="mt-1 text-xs text-zinc-500 font-normal leading-relaxed">
              Ask an authorized StayElite administrator to review this
              negotiation. This does not force a payment or payout.
            </p>

            {active.status === "ESCALATED" ? (
              <div className="mt-3 rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-xs font-normal text-amber-900 leading-relaxed">
                Mediation is currently active. Support operations will update
                this case here.
              </div>
            ) : mutable.has(active.status) ? (
              <div className="mt-3 space-y-3">
                <textarea
                  value={mediationReason}
                  onChange={(e) => setMediationReason(e.target.value)}
                  maxLength={2000}
                  placeholder="Explain why mediation by StayElite Support is needed…"
                  className="min-h-20 w-full rounded-xl border border-zinc-200 p-2.5 text-xs font-normal text-zinc-900 placeholder:text-zinc-400"
                />
                <button
                  type="button"
                  disabled={submitting || !mediationReason.trim()}
                  onClick={() => void handleRequestMediation()}
                  className="w-full rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-40"
                >
                  {submitting ? "Requesting…" : "Request Admin Mediation"}
                </button>
              </div>
            ) : null}
          </section>

          {/* Case Activity History */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
            <h3 className="font-medium text-base text-zinc-900">
              Case activity
            </h3>
            <ol className="mt-4 space-y-4 border-l border-zinc-200 pl-4">
              {active.events?.map((event) => (
                <li key={event.id} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-zinc-900" />
                  <p className="font-medium text-zinc-800">
                    {event.description || title(event.eventType)}
                  </p>
                  <time className="text-[11px] font-normal text-zinc-400">
                    {date(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </section>
  );
}
