"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { DirectResolutionCenter } from "@/components/resolution/direct-resolution-center";
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

type HostCaseTab =
  | "all"
  | "support"
  | "booking_disputes"
  | "direct"
  | "action_needed"
  | "in_review"
  | "resolved";

function tabStatus(tab: HostCaseTab) {
  if (tab === "action_needed") return "WAITING_FOR_HOST";
  if (tab === "in_review") return "IN_REVIEW";
  if (tab === "resolved") return "RESOLVED";
  return "";
}

function supportTab(value: string | null): HostCaseTab {
  return value === "support" ||
    value === "booking_disputes" ||
    value === "direct" ||
    value === "action_needed" ||
    value === "in_review" ||
    value === "resolved"
    ? value
    : "all";
}

function tabFromSearchParams(params: URLSearchParams): HostCaseTab {
  const view = params.get("view");
  if (view === "support") return "support";
  if (view === "disputes") return "booking_disputes";
  if (view === "direct") return "direct";
  if (view === "action-needed") return "action_needed";
  if (view === "review") return "in_review";
  if (view === "resolved") return "resolved";
  return supportTab(params.get("tab"));
}

function tabHref(tab: HostCaseTab) {
  if (tab === "support") return "/host/support?view=support";
  if (tab === "booking_disputes") return "/host/support?view=disputes";
  if (tab === "direct") return "/host/support?view=direct";
  if (tab === "action_needed") return "/host/support?view=action-needed";
  if (tab === "in_review") return "/host/support?view=review";
  if (tab === "resolved") return "/host/support?view=resolved";
  return "/host/support";
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
    role?: string;
  };
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
};

type HostListing = { id: string; title: string };
type HostBooking = {
  id: string;
  startDate: string;
  endDate: string;
  listing?: { title?: string | null } | null;
};

type LegacyDispute = {
  id: string;
  caseReference: string;
  category: string;
  status: string;
  disputeWorkflowStatus: string;
  severity: string;
  responseRequired: boolean;
  createdAt: string;
  updatedAt: string;
  supportCaseId?: string | null;
  listing?: { id: string; title?: string | null; city?: string | null } | null;
  booking?: { id: string } | null;
};

type LegacyDisputeList = {
  disputes: LegacyDispute[];
  summary: {
    totalCases: number;
    responseRequired: number;
    underReview: number;
    resolved: number;
    linkedToSupportCases?: number;
    unlinkedResponseRequired?: number;
    unlinkedUnderReview?: number;
    unlinkedResolved?: number;
  };
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

const bytes = (value: number) =>
  value < 1048576
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1048576).toFixed(1)} MB`;

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

export function HostSupportCenter({
  initialCaseId,
  initialView,
}: { initialCaseId?: string; initialView?: "support" | "direct" } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState<"list" | "detail">("list");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [items, setItems] = useState<Case[]>([]);
  const [legacyDisputes, setLegacyDisputes] = useState<LegacyDispute[]>([]);
  const [active, setActive] = useState<Case | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([]);
  const [listings, setListings] = useState<HostListing[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const requestedTab = tabFromSearchParams(searchParams);
  const [filters, setFilters] = useState(() => ({
    status: tabStatus(requestedTab),
    category: "",
    search: "",
  }));
  const [activeTab, setActiveTab] = useState<HostCaseTab>(requestedTab);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "",
    issueType: "",
    listingId: "",
    bookingId: "",
    subject: "",
    description: "",
  });
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [metrics, setMetrics] = useState({
    all: 0,
    actionNeeded: 0,
    underReview: 0,
    resolved: 0,
  });
  const createKey = useRef<string | null>(null);
  const replyKey = useRef<string | null>(null);

  const load = useCallback(
    async (target = page) => {
      setLoading(true);
      setMessage(null);
      try {
        const query = new URLSearchParams({
          page: String(target),
          limit: "15",
        });
        const bookingId = searchParams.get("bookingId");
        if (bookingId) query.set("bookingId", bookingId);
        if (filters.status) query.set("status", filters.status);
        if (filters.category) query.set("category", filters.category);
        if (filters.search.trim()) query.set("search", filters.search.trim());

        const legacyQuery = new URLSearchParams({
          page: String(target),
          limit: "15",
        });
        if (bookingId) legacyQuery.set("bookingId", bookingId);
        if (filters.search.trim())
          legacyQuery.set("search", filters.search.trim());
        const [result, legacy] = await Promise.all([
          api<{
            cases: Case[];
            pagination: { page: number; totalPages: number; total: number };
          }>(`/api/v1/support/cases?${query}`),
          api<LegacyDisputeList>(`/api/v1/host/disputes?${legacyQuery}`),
        ]);
        setItems(result.cases);
        setPages(result.pagination);
        setLegacyDisputes(
          legacy.disputes.filter((dispute) => !dispute.supportCaseId),
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load host support requests.",
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, page, searchParams],
  );

  const open = useCallback(async (id: string) => {
    setDetailLoading(true);
    setMessage(null);
    try {
      setActive(
        await api<Case>(`/api/v1/support/cases/${encodeURIComponent(id)}`),
      );
      setEvidenceFiles([]);
      setScreen("detail");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open this support request.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => {
      void load(page);
    }, 0);
    return () => window.clearTimeout(start);
  }, [load, page]);

  useEffect(() => {
    void Promise.all([
      api<{ categories: Taxonomy[] }>(
        "/api/v1/support/case-taxonomy?audience=host",
      ),
      api<{ items: HostListing[] }>("/api/v1/host/listings?limit=100").catch(
        () => ({ items: [] }),
      ),
      api<HostBooking[]>("/api/v1/host/resolution-bookings").catch(() => []),
    ])
      .then(([tax, listData, resBookings]) => {
        setTaxonomy(tax.categories);
        setListings(listData.items || []);
        setBookings(resBookings || []);
      })
      .catch(() => undefined);

    const caseId = new URLSearchParams(window.location.search).get("caseId");
    const requestedCaseId = initialCaseId || caseId;
    if (requestedCaseId) {
      const sp = new URLSearchParams(window.location.search);
      sp.delete("caseId");
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      router.replace(
        `/host/support/cases/${encodeURIComponent(requestedCaseId)}${qs}`,
      );
    }
  }, [initialCaseId, open, router]);

  useEffect(() => {
    const nextTab = tabFromSearchParams(searchParams);
    const start = window.setTimeout(() => {
      setActiveTab(nextTab);
      setPage(1);
      setFilters((previous) => ({ ...previous, status: tabStatus(nextTab) }));
    }, 0);
    return () => window.clearTimeout(start);
  }, [searchParams]);

  useEffect(() => {
    void Promise.all([
      api<{ pagination: { total: number } }>(
        "/api/v1/support/cases?page=1&limit=1",
      ),
      api<{ pagination: { total: number } }>(
        "/api/v1/support/cases?page=1&limit=1&status=WAITING_FOR_HOST",
      ),
      api<{ pagination: { total: number } }>(
        "/api/v1/support/cases?page=1&limit=1&status=IN_REVIEW",
      ),
      api<{ pagination: { total: number } }>(
        "/api/v1/support/cases?page=1&limit=1&status=RESOLVED",
      ),
      api<LegacyDisputeList>("/api/v1/host/disputes?page=1&limit=1"),
    ])
      .then(([all, actionNeeded, underReview, resolved, legacy]) => {
        const legacyTotal = Math.max(
          0,
          legacy.summary.totalCases -
            (legacy.summary.linkedToSupportCases || 0),
        );
        setMetrics({
          all: all.pagination.total + legacyTotal,
          actionNeeded:
            actionNeeded.pagination.total +
            (legacy.summary.unlinkedResponseRequired ??
              legacy.summary.responseRequired),
          underReview:
            underReview.pagination.total +
            (legacy.summary.unlinkedUnderReview ?? legacy.summary.underReview),
          resolved:
            resolved.pagination.total +
            (legacy.summary.unlinkedResolved ?? legacy.summary.resolved),
        });
      })
      .catch(() => undefined);
  }, []);

  const back = () => {
    setScreen("list");
    setActive(null);
    setMessage(null);
    void load(page);
  };

  const handleSelectCase = useCallback(
    (targetCaseId: string) => {
      const query = new URLSearchParams();
      if (activeTab === "support") query.set("view", "support");
      else if (activeTab === "booking_disputes") query.set("view", "disputes");
      else if (activeTab === "direct") query.set("view", "direct");
      else if (activeTab === "action_needed")
        query.set("view", "action-needed");
      else if (activeTab === "in_review") query.set("view", "review");
      else if (activeTab === "resolved") query.set("view", "resolved");

      if (filters.category) query.set("category", filters.category);
      if (filters.status) query.set("status", filters.status);
      if (filters.search.trim()) query.set("search", filters.search.trim());
      if (page > 1) query.set("page", String(page));

      const qs = query.toString() ? `?${query.toString()}` : "";
      router.push(
        `/host/support/cases/${encodeURIComponent(targetCaseId)}${qs}`,
      );
    },
    [activeTab, filters, page, router],
  );

  const selected = taxonomy.find(
    (category) => category.value === form.category,
  );
  const key = (prefix: string) =>
    globalThis.crypto?.randomUUID?.() ||
    `${prefix}-${Date.now()}-${Math.random()}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (
      !form.category ||
      !form.issueType ||
      !form.subject.trim() ||
      !form.description.trim()
    ) {
      setMessage(
        "Please choose a category, issue type, and provide a subject and description.",
      );
      return;
    }
    setSubmitting(true);
    createKey.current ??= key("host-case");
    try {
      const created = await api<Case>("/api/v1/support/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          issueType: form.issueType,
          subject: form.subject.trim(),
          description: form.description.trim(),
          listingId: form.listingId || undefined,
          bookingId: form.bookingId || undefined,
          idempotencyKey: createKey.current,
        }),
      });
      createKey.current = null;
      setForm({
        category: "",
        issueType: "",
        listingId: "",
        bookingId: "",
        subject: "",
        description: "",
      });
      setIsCreateModalOpen(false);
      handleSelectCase(created.id);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create host support request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!active || !reply.trim()) return;
    setSubmitting(true);
    setMessage(null);
    replyKey.current ??= key("host-message");
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
      await open(active.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to send reply.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function upload() {
    if (!active || evidenceFiles.length === 0) return;
    setUploading(true);
    setMessage(null);
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
      await open(active.id);
    } catch (error) {
      setEvidenceFiles((current) => current.slice(uploaded));
      setMessage(
        error instanceof Error ? error.message : "Unable to upload evidence.",
      );
    } finally {
      setUploading(false);
    }
  }

  const isDirectView = initialView === "direct" || requestedTab === "direct";

  if (isDirectView) {
    return (
      <section className="animate-in fade-in duration-300 font-sans text-[#1F1F1F] space-y-6">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500">Host Operations</p>
            <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">
              Help &amp; Resolution Center
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-normal text-zinc-500">
              Manage support requests, booking issues, guest complaints, and
              resolutions in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("homyz:open-direct-resolution"))
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-black sm:text-sm"
            >
              New resolution request
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "All Cases",
              metrics.all,
              "border-blue-100 bg-blue-50 text-blue-800",
            ],
            [
              "Action Needed",
              metrics.actionNeeded,
              "border-amber-100 bg-amber-50 text-amber-800",
            ],
            [
              "Under Review",
              metrics.underReview,
              "border-indigo-100 bg-indigo-50 text-indigo-800",
            ],
            [
              "Resolved",
              metrics.resolved,
              "border-emerald-100 bg-emerald-50 text-emerald-800",
            ],
          ].map(([label, count, color]) => (
            <div
              key={String(label)}
              className={`rounded-2xl border p-4 ${color}`}
            >
              <p className="text-2xl font-medium">{count}</p>
              <p className="mt-1 text-xs font-medium">{label}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-zinc-200">
          <nav
            aria-label="Host support case views"
            className="-mb-px flex min-w-max gap-4 overflow-x-auto text-sm font-medium"
          >
            {[
              { id: "all", label: `All Cases (${metrics.all})` },
              { id: "support", label: "Support Requests" },
              { id: "booking_disputes", label: "Booking Disputes" },
              { id: "direct", label: "Direct Resolutions" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => router.push(tabHref(tab.id as HostCaseTab))}
                className={`whitespace-nowrap border-b-2 pb-3 text-xs font-medium transition-colors sm:text-sm ${tab.id === "direct" ? "border-zinc-900 text-zinc-950" : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-zinc-800 sm:text-sm">
            Category
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  category: event.target.value,
                }))
              }
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-normal text-zinc-900 sm:text-sm"
            >
              <option value="">All categories</option>
              {taxonomy.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-800 sm:text-sm">
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  status: event.target.value,
                }))
              }
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-normal text-zinc-900 sm:text-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-zinc-800 sm:text-sm">
            Search
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  search: event.target.value,
                }))
              }
              placeholder="Case number or subject..."
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-normal text-zinc-900 placeholder:text-zinc-400 sm:text-sm"
            />
          </label>
        </div>

        <DirectResolutionCenter
          audience="host"
          initialCaseId={initialCaseId}
          embedded
          searchTerm={filters.search}
          categoryFilter={filters.category}
          statusFilter={filters.status}
          onSelectCase={handleSelectCase}
        />
      </section>
    );
  }

  const visibleLegacyDisputes = filters.category
    ? []
    : legacyDisputes.filter((dispute) => {
        if (activeTab === "support") return false;
        if (activeTab === "booking_disputes") return true;
        if (filters.status === "WAITING_FOR_HOST")
          return dispute.responseRequired;
        if (filters.status === "IN_REVIEW")
          return !["RESOLVED", "CLOSED"].includes(
            dispute.disputeWorkflowStatus,
          );
        if (["RESOLVED", "CLOSED"].includes(filters.status))
          return (
            dispute.status === "RESOLVED" ||
            dispute.disputeWorkflowStatus === "CLOSED"
          );
        if (filters.status) return false;
        if (activeTab === "action_needed") return dispute.responseRequired;
        if (activeTab === "in_review")
          return !["RESOLVED", "CLOSED"].includes(
            dispute.disputeWorkflowStatus,
          );
        if (activeTab === "resolved")
          return (
            dispute.status === "RESOLVED" ||
            dispute.disputeWorkflowStatus === "CLOSED"
          );
        return true;
      });
  const visibleSupportCases = activeTab === "booking_disputes" ? [] : items;
  const hasCases =
    visibleSupportCases.length > 0 || visibleLegacyDisputes.length > 0;

  return (
    <section className="animate-in fade-in duration-300 font-sans text-[#1F1F1F] space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">Host Operations</p>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
            Help &amp; Resolution Center
          </h1>
          <p className="mt-1 text-sm font-normal text-zinc-500 max-w-2xl">
            Manage support requests, booking issues, guest complaints, and
            resolutions in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {screen === "list" ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-zinc-900 px-5 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors shadow-2xs"
            >
              New Request
            </button>
          ) : (
            <button
              type="button"
              onClick={back}
              className="text-xs sm:text-sm font-medium text-zinc-900 underline underline-offset-4"
            >
              ← Back to cases
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-normal text-red-800"
        >
          {message}
        </div>
      )}

      {/* Screen 1: Host Support Cases List */}
      {screen === "list" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "All Cases",
                metrics.all,
                "border-blue-100 bg-blue-50 text-blue-800",
              ],
              [
                "Action Needed",
                metrics.actionNeeded,
                "border-amber-100 bg-amber-50 text-amber-800",
              ],
              [
                "Under Review",
                metrics.underReview,
                "border-indigo-100 bg-indigo-50 text-indigo-800",
              ],
              [
                "Resolved",
                metrics.resolved,
                "border-emerald-100 bg-emerald-50 text-emerald-800",
              ],
            ].map(([label, count, color]) => (
              <div
                key={String(label)}
                className={`rounded-2xl border p-4 ${color}`}
              >
                <p className="text-2xl font-medium">{count}</p>
                <p className="mt-1 text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
          {/* Queue Filter Tabs */}
          <div className="border-b border-zinc-200">
            <nav className="-mb-px flex space-x-4 text-sm font-medium">
              {[
                { id: "all", label: `All Cases (${metrics.all})` },
                { id: "support", label: "Support Requests" },
                { id: "booking_disputes", label: "Booking Disputes" },
                { id: "direct", label: "Direct Resolutions" },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => router.push(tabHref(tab.id as HostCaseTab))}
                    className={`whitespace-nowrap pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                      active
                        ? "border-zinc-900 text-zinc-950"
                        : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Search and Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs sm:text-sm font-medium text-zinc-800">
              Category
              <select
                value={filters.category}
                onChange={(e) => {
                  setFilters({ ...filters, category: e.target.value });
                  setPage(1);
                }}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900"
              >
                <option value="">All categories</option>
                {taxonomy.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs sm:text-sm font-medium text-zinc-800">
              Status
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setPage(1);
                }}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900"
              >
                <option value="">All statuses</option>
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs sm:text-sm font-medium text-zinc-800">
              Search
              <input
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    void load(1);
                  }
                }}
                placeholder="Case number or subject..."
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm font-normal text-zinc-900 placeholder:text-zinc-400"
              />
            </label>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-zinc-100"
                />
              ))}
            </div>
          ) : !hasCases ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <svg
                  className="size-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-medium text-zinc-900">
                No support requests found
              </h3>
              <p className="mt-1 text-sm font-normal text-zinc-500 max-w-sm mx-auto">
                Have a question about payouts, reservations, guest conduct, or
                your listing? Create a request to connect with our operations
                team.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setIsCreateModalOpen(true);
                }}
                className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-xs sm:text-sm font-medium text-white hover:bg-black transition-colors"
              >
                Create Support Request
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSupportCases.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleSelectCase(item.id)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 text-left transition hover:border-zinc-900 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-zinc-500">
                          {item.caseNumber}
                        </span>
                        {item.status === "WAITING_FOR_HOST" && (
                          <span className="rounded-md bg-amber-100 border border-amber-200 px-1.5 py-0.2 text-[10px] font-medium text-amber-900">
                            Reply Needed
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-medium text-base text-zinc-950">
                        {item.subject}
                      </h3>
                      <p className="mt-0.5 text-xs font-normal text-zinc-500">
                        {item.category.replaceAll("_", " ")}
                        {item.issueType
                          ? ` · ${item.issueType.replaceAll("_", " ")}`
                          : ""}
                        {item.listing?.title
                          ? ` · Property: ${item.listing.title}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${badge(item.status)}`}
                      >
                        {labels[item.status]}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs font-normal text-zinc-400">
                    Created {date(item.createdAt)} · Last updated{" "}
                    {date(item.updatedAt)}
                  </p>
                </button>
              ))}
              {visibleLegacyDisputes.map((dispute) => {
                const resolved =
                  dispute.status === "RESOLVED" ||
                  dispute.disputeWorkflowStatus === "CLOSED";
                const statusLabel = resolved
                  ? "Resolved"
                  : dispute.responseRequired
                    ? "Reply Needed"
                    : dispute.disputeWorkflowStatus.replaceAll("_", " ");
                return (
                  <button
                    type="button"
                    key={`legacy-${dispute.id}`}
                    onClick={() =>
                      router.push(
                        `/host/resolution-center/${encodeURIComponent(dispute.id)}`,
                      )
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 text-left transition hover:border-zinc-900 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-zinc-500">
                            {dispute.caseReference}
                          </span>
                          <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                            Booking dispute
                          </span>
                        </div>
                        <h3 className="mt-1 font-medium text-base text-zinc-950">
                          {dispute.category.replaceAll("_", " ")}
                        </h3>
                        <p className="mt-0.5 text-xs font-normal text-zinc-500">
                          {dispute.listing?.title
                            ? `Property: ${dispute.listing.title}`
                            : "Booking-linked issue"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${resolved ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : dispute.responseRequired ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-blue-50 text-blue-800 border border-blue-200"}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-normal text-zinc-400">
                      Created {date(dispute.createdAt)} · Last updated{" "}
                      {date(dispute.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {pages.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-xs sm:text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-normal text-zinc-500">
                Page {pages.page} of {pages.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= pages.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </div>
      )}

      {isCreateModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-host-request-title"
              onSubmit={submit}
              className="max-h-[calc(100vh-2rem)] w-full max-w-3xl space-y-5 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="new-host-request-title"
                    className="text-xl font-medium text-zinc-900"
                  >
                    New Host Support Request
                  </h3>
                  <p className="mt-1 text-sm font-normal text-zinc-500">
                    Submit an operational or account inquiry to our dedicated
                    host management team. For guest damage claims or refund
                    requests, use the Resolution Center.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                  aria-label="Close new support request form"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              {message && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-normal text-red-800"
                >
                  {message}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-zinc-800">
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
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                  >
                    <option value="">Select a category</option>
                    {taxonomy.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-zinc-800">
                  Issue Type
                  <select
                    required
                    disabled={!selected}
                    value={form.issueType}
                    onChange={(e) =>
                      setForm({ ...form, issueType: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900 disabled:bg-zinc-50"
                  >
                    <option value="">Select an issue type</option>
                    {selected?.issueTypes.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-zinc-800">
                  Related Property{" "}
                  <span className="text-zinc-400 font-normal">(optional)</span>
                  <select
                    value={form.listingId}
                    onChange={(e) =>
                      setForm({ ...form, listingId: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                  >
                    <option value="">No specific property</option>
                    {listings.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-zinc-800">
                  Related Reservation{" "}
                  <span className="text-zinc-400 font-normal">(optional)</span>
                  <select
                    value={form.bookingId}
                    onChange={(e) =>
                      setForm({ ...form, bookingId: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                  >
                    <option value="">No specific reservation</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.listing?.title || "Reservation"} ·{" "}
                        {new Date(booking.startDate).toLocaleDateString()}–
                        {new Date(booking.endDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-zinc-800">
                Subject
                <input
                  required
                  maxLength={160}
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  placeholder="Brief summary of your inquiry"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-normal text-zinc-900"
                />
              </label>

              <label className="block text-sm font-medium text-zinc-800">
                Description
                <textarea
                  required
                  maxLength={10000}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Please provide details, dates, or context regarding your request..."
                  className="mt-1.5 min-h-36 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm font-normal text-zinc-900 leading-relaxed"
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  disabled={submitting || !taxonomy.length}
                  type="submit"
                  className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-black transition-colors"
                >
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {/* Screen 3: Host Case Detail View */}
      {screen === "detail" &&
        (detailLoading || !active ? (
          <div className="h-96 animate-pulse rounded-2xl bg-zinc-100" />
        ) : (
          <article className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
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
                      StayElite Support has requested additional details or
                      verification regarding this case. Please reply below so we
                      can proceed.
                    </p>
                  </div>
                </div>
              )}

              {/* Case Overview Card */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-medium text-zinc-500">
                      {active.caseNumber}
                    </p>
                    <h3 className="mt-1 text-2xl font-medium text-zinc-950">
                      {active.subject}
                    </h3>
                  </div>
                  <span
                    className={`h-fit rounded-full px-3 py-1.5 text-xs font-medium ${badge(active.status)}`}
                  >
                    {labels[active.status]}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500 font-normal text-xs">
                      Category
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">
                      {active.category.replaceAll("_", " ")} ·{" "}
                      {active.issueType?.replaceAll("_", " ") || "General"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 font-normal text-xs">
                      Related Property / Booking
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">
                      {active.listing?.title ||
                        active.booking?.submissionId ||
                        "Direct Platform Request"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 font-normal text-xs">
                      Created
                    </dt>
                    <dd className="mt-0.5 font-normal text-zinc-700">
                      {date(active.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500 font-normal text-xs">
                      Last Updated
                    </dt>
                    <dd className="mt-0.5 font-normal text-zinc-700">
                      {date(active.updatedAt)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 rounded-xl bg-zinc-50 border border-zinc-100 p-4">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
                    Inquiry Details
                  </span>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800 font-normal">
                    {active.description ||
                      "No additional description was provided."}
                  </p>
                </div>

                {["RESOLVED", "CLOSED"].includes(active.status) && (
                  <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-normal text-emerald-900">
                    This request has been {labels[active.status].toLowerCase()}.
                    Any official resolution appears in the case activity.
                  </p>
                )}
              </section>

              {/* Messages Thread */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
                <h3 className="text-lg font-medium text-zinc-900">
                  Support Communication
                </h3>
                <p className="text-xs font-normal text-zinc-500 mt-0.5">
                  Direct messages between you and the StayElite Support
                  Operations team.
                </p>

                {!active.messages?.length ? (
                  <p className="mt-5 text-sm font-normal text-zinc-500 bg-zinc-50 rounded-xl p-4 text-center">
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
                    onSubmit={sendReply}
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
            </div>

            {/* Right Column: Evidence & Case Activity */}
            <aside className="space-y-6">
              {/* Evidence Section */}
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
                    onError={setMessage}
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
                    onClick={() => void upload()}
                    className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {uploading
                      ? "Uploading…"
                      : `Upload ${evidenceFiles.length || ""} evidence${evidenceFiles.length === 1 ? "" : " files"}`}
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

              {/* Case Activity Timeline */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
                <h3 className="font-medium text-base text-zinc-900">
                  Activity History
                </h3>
                <ol className="mt-4 space-y-4 border-l border-zinc-200 pl-4">
                  {active.events?.map((entry) => (
                    <li key={entry.id} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-zinc-900" />
                      <p className="font-medium text-zinc-800">
                        {entry.description ||
                          entry.eventType.replaceAll("_", " ")}
                      </p>
                      <time className="text-[11px] font-normal text-zinc-400">
                        {date(entry.createdAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </article>
        ))}
    </section>
  );
}
