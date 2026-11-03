"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AttachmentPicker } from "@/components/support/attachment-picker";
import { BackButton } from "@/components/ui/back-button";

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
  proposer: { id: string; name: string | null };
  recipient: { id: string; name: string | null };
};
type ResolutionCase = {
  id: string;
  caseNumber: string;
  category?: string;
  subject: string;
  description: string | null;
  status: string;
  version: number;
  updatedAt: string;
  viewer: { id: string; isAdmin: boolean };
  listing?: { title: string | null } | null;
  resolutionOffers?: Offer[];
  messages?: {
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; name: string | null; role?: string };
  }[];
  events?: {
    id: string;
    description: string | null;
    eventType: string;
    createdAt: string;
  }[];
  evidence?: { id: string; originalName: string; sizeBytes: number }[];
};
type Booking = {
  id: string;
  startDate: string;
  listing?: { title?: string | null } | null;
};
type FormState = {
  offerType: OfferType;
  amount: string;
  description: string;
  expiresAt: string;
};

const offerTypes: OfferType[] = [
  "MONETARY_COMPENSATION",
  "PROPERTY_DAMAGE",
  "NON_FINANCIAL",
  "AMENITY_ISSUE",
  "OTHER",
];
const title = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const money = (amount: number | null, currency: string) =>
  amount === null
    ? "Non-financial"
    : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
        amount / 100,
      );
const emptyOffer: FormState = {
  offerType: "NON_FINANCIAL",
  amount: "",
  description: "",
  expiresAt: "",
};

function HostSupportTabs({ total }: { total: number | null }) {
  const tabs = [
    {
      href: "/host/support",
      label: `All Cases${total === null ? "" : ` (${total})`}`,
    },
    { href: "/host/support?tab=support", label: "Support Requests" },
    { href: "/host/support?tab=booking_disputes", label: "Booking Disputes" },
    {
      href: "/host/support?view=direct",
      label: "Direct Resolutions",
      active: true,
    },
    {
      href: "/host/support?tab=action_needed",
      label: "Action Needed from You",
    },
    { href: "/host/support?tab=in_review", label: "Under Review" },
    { href: "/host/support?tab=resolved", label: "Resolved & Closed" },
  ];

  return (
    <nav
      aria-label="Help and Resolution Center case views"
      className="-mt-2 overflow-x-auto border-b border-zinc-200"
    >
      <div className="flex min-w-max gap-4 text-xs font-medium sm:text-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 pb-3 transition-colors ${tab.active ? "border-zinc-900 text-zinc-950" : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success)
    throw new Error(
      payload?.error?.message ||
        "Resolution service is temporarily unavailable.",
    );
  return payload.data as T;
}

function OfferFields({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
}) {
  const monetary =
    form.offerType === "MONETARY_COMPENSATION" ||
    form.offerType === "PROPERTY_DAMAGE";
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Offer type
        <select
          value={form.offerType}
          onChange={(event) =>
            onChange({ ...form, offerType: event.target.value as OfferType })
          }
          className="mt-1 block w-full rounded-lg border border-zinc-300 p-2"
        >
          {offerTypes.map((type) => (
            <option key={type} value={type}>
              {title(type)}
            </option>
          ))}
        </select>
      </label>
      {monetary && (
        <label className="block text-sm font-medium">
          Amount (minor units)
          <input
            required
            min="1"
            type="number"
            value={form.amount}
            onChange={(event) =>
              onChange({ ...form, amount: event.target.value })
            }
            className="mt-1 block w-full rounded-lg border border-zinc-300 p-2"
          />
        </label>
      )}
      <label className="block text-sm font-medium">
        Explanation
        <textarea
          required
          maxLength={4000}
          value={form.description}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
          className="mt-1 block min-h-24 w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>
      <label className="block text-sm font-medium">
        Expires at <span className="font-normal text-zinc-500">(optional)</span>
        <input
          type="datetime-local"
          value={form.expiresAt}
          onChange={(event) =>
            onChange({ ...form, expiresAt: event.target.value })
          }
          className="mt-1 block w-full rounded-lg border border-zinc-300 p-2"
        />
      </label>
    </div>
  );
}

export function DirectResolutionCenter({
  audience,
  initialCaseId,
  embedded = false,
  searchTerm = "",
  categoryFilter = "",
  statusFilter = "",
  onSelectCase,
}: {
  audience: "guest" | "host";
  initialCaseId?: string;
  embedded?: boolean;
  searchTerm?: string;
  categoryFilter?: string;
  statusFilter?: string;
  onSelectCase?: (caseId: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<ResolutionCase[]>([]);
  const [active, setActive] = useState<ResolutionCase | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [screen, setScreen] = useState<"list" | "detail">("list");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestForm, setRequestForm] = useState({
    bookingId: "",
    subject: "",
    ...emptyOffer,
  });
  const [offerForm, setOfferForm] = useState<FormState>(emptyOffer);
  const [countering, setCountering] = useState<Offer | null>(null);
  const [mediationReason, setMediationReason] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [hostCaseTotal, setHostCaseTotal] = useState<number | null>(null);
  const createKey = useRef<string | null>(null);
  const messageKey = useRef<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ cases: ResolutionCase[] }>(
        "/api/v1/support/cases?page=1&limit=100&resolutionOnly=true",
      );
      setCases(data.cases);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load resolution requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(
    async (id: string, updateUrl = true) => {
      setLoading(true);
      try {
        setActive(await api<ResolutionCase>(`/api/v1/support/cases/${id}`));
        setEvidenceFiles([]);
        setScreen("detail");
        setCountering(null);
        if (embedded && updateUrl && searchParams.get("caseId") !== id)
          router.push(
            `/host/support?view=direct&caseId=${encodeURIComponent(id)}`,
            { scroll: false },
          );
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Unable to load this resolution request.",
        );
      } finally {
        setLoading(false);
      }
    },
    [embedded, router, searchParams],
  );

  useEffect(() => {
    const start = window.setTimeout(() => {
      void loadCases();
      const bookingUrl =
        audience === "host"
          ? "/api/v1/host/resolution-bookings"
          : "/api/v1/bookings?page=1&limit=100";
      void api<Booking[]>(bookingUrl)
        .then(setBookings)
        .catch(() => undefined);
      const caseId =
        initialCaseId ||
        new URLSearchParams(window.location.search).get("caseId");
      if (caseId) void open(caseId, false);
    }, 0);
    return () => window.clearTimeout(start);
  }, [audience, initialCaseId, loadCases, open]);

  useEffect(() => {
    if (audience !== "host" || embedded) return;
    let current = true;
    void Promise.all([
      api<{ pagination: { total: number } }>(
        "/api/v1/support/cases?page=1&limit=1",
      ),
      api<{ summary: { totalCases: number; linkedToSupportCases?: number } }>(
        "/api/v1/host/disputes?page=1&limit=1",
      ),
    ])
      .then(([support, disputes]) => {
        if (current)
          setHostCaseTotal(
            support.pagination.total +
              Math.max(
                0,
                disputes.summary.totalCases -
                  (disputes.summary.linkedToSupportCases || 0),
              ),
          );
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [audience, embedded]);

  useEffect(() => {
    if (!embedded) return;
    const caseId = searchParams.get("caseId");
    const start = window.setTimeout(() => {
      if (caseId && caseId !== active?.id) void open(caseId, false);
      if (!caseId && screen === "detail") {
        setActive(null);
        setScreen("list");
      }
    }, 0);
    return () => window.clearTimeout(start);
  }, [active?.id, embedded, open, screen, searchParams]);

  useEffect(() => {
    if (!embedded) return;
    const openCreateForm = () => {
      setNotice(null);
      setIsCreateModalOpen(true);
    };
    window.addEventListener("homyz:open-direct-resolution", openCreateForm);
    return () =>
      window.removeEventListener(
        "homyz:open-direct-resolution",
        openCreateForm,
      );
  }, [embedded]);

  const payload = (form: FormState) => ({
    offerType: form.offerType,
    amount: form.amount ? Number(form.amount) : undefined,
    description: form.description.trim(),
    expiresAt: form.expiresAt || undefined,
  });
  const visibleCases = cases.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.caseNumber.toLowerCase().includes(term) ||
      item.subject.toLowerCase().includes(term) ||
      item.listing?.title?.toLowerCase().includes(term);
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  async function createRequest(event: FormEvent) {
    event.preventDefault();
    if (
      !requestForm.bookingId ||
      !requestForm.subject.trim() ||
      !requestForm.description.trim()
    )
      return setNotice(
        "Choose a booking and provide a subject and explanation.",
      );
    setSaving(true);
    setNotice(null);
    createKey.current ??=
      globalThis.crypto?.randomUUID?.() || `resolution-${Date.now()}`;
    try {
      const result = await api<{ supportCaseId: string }>(
        "/api/v1/support/resolutions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: requestForm.bookingId,
            subject: requestForm.subject.trim(),
            ...payload(requestForm),
            idempotencyKey: createKey.current,
          }),
        },
      );
      createKey.current = null;
      setIsCreateModalOpen(false);
      if (onSelectCase) {
        onSelectCase(result.supportCaseId);
      } else {
        await open(result.supportCaseId);
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to create resolution request.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createOffer(event: FormEvent) {
    event.preventDefault();
    if (!active || !offerForm.description.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      await api(`/api/v1/support/cases/${active.id}/resolution-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload(offerForm),
          parentOfferId: countering?.id,
          idempotencyKey:
            globalThis.crypto?.randomUUID?.() || `offer-${Date.now()}`,
        }),
      });
      setOfferForm(emptyOffer);
      setCountering(null);
      await open(active.id);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to submit resolution offer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function act(offer: Offer, action: "ACCEPT" | "REJECT" | "WITHDRAW") {
    if (
      !window.confirm(`${title(action.toLowerCase())} this resolution offer?`)
    )
      return;
    setSaving(true);
    setNotice(null);
    try {
      await api(`/api/v1/support/resolution-offers/${offer.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedVersion: offer.version }),
      });
      if (active) await open(active.id);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update resolution offer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function requestMediation() {
    if (!active || !mediationReason.trim()) return;
    setSaving(true);
    setNotice(null);
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
      await open(active.id);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to request mediation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendDiscussion(event: FormEvent) {
    event.preventDefault();
    if (!active || !discussion.trim()) return;
    setSaving(true);
    setNotice(null);
    messageKey.current ??=
      globalThis.crypto?.randomUUID?.() || `resolution-message-${Date.now()}`;
    try {
      await api(`/api/v1/support/cases/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: discussion.trim(),
          idempotencyKey: messageKey.current,
        }),
      });
      messageKey.current = null;
      setDiscussion("");
      await open(active.id);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to send your message.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadEvidence() {
    if (!active || evidenceFiles.length === 0) return;
    setSaving(true);
    setNotice(null);
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
      setNotice(
        error instanceof Error ? error.message : "Unable to upload evidence.",
      );
    } finally {
      setSaving(false);
    }
  }

  function backToDirectList() {
    setScreen("list");
    setActive(null);
    if (embedded) router.push("/host/support?view=direct", { scroll: false });
    else void loadCases();
  }

  return (
    <section className="w-full space-y-6">
      {!embedded && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
            <div className="flex items-start gap-3 sm:gap-4">
              {audience === "guest" && screen === "list" ? (
                <BackButton
                  href="/profile/tab/support"
                  aria-label="Back to Help & Support"
                  className="mt-1 sm:mt-1.5"
                />
              ) : (
                <BackButton
                  onClick={backToDirectList}
                  aria-label="Back to List of Direct Resolutions"
                  className="mt-1 sm:mt-1.5"
                />
              )}
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  {audience === "host" ? "Host Operations" : "Help & support"}
                </p>
                <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-zinc-950 sm:text-3xl">
                  Direct resolutions
                </h1>
                <p className="mt-1 max-w-2xl text-sm font-normal text-zinc-500">
                  Work directly with the booking participant. Agreements are
                  recorded; no payment or payout is executed here.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {audience === "host" && (
                <Link
                  href="/host/today"
                  className="text-sm font-medium text-zinc-900 underline underline-offset-4"
                >
                  ← Back to Today
                </Link>
              )}
              {screen === "list" && (
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setIsCreateModalOpen(true);
                  }}
                  className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black transition-colors"
                >
                  New resolution request
                </button>
              )}
            </div>
          </header>
          {audience === "host" && <HostSupportTabs total={hostCaseTotal} />}
        </>
      )}
      {embedded && screen !== "list" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={backToDirectList}
            className="text-sm font-medium text-zinc-900 underline underline-offset-4"
          >
            ← Back to Direct Resolutions
          </button>
        </div>
      )}
      {notice && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {notice}
        </p>
      )}
      {screen === "list" &&
        (loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl bg-zinc-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleCases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onSelectCase) onSelectCase(item.id);
                  else void open(item.id);
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-2xs transition hover:border-zinc-900 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-zinc-500">
                        {item.caseNumber}
                      </span>
                      <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                        Direct resolution
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-medium text-zinc-950">
                      {item.subject}
                    </h2>
                    <p className="mt-0.5 text-xs font-normal text-zinc-500">
                      {item.category
                        ? item.category.replaceAll("_", " ")
                        : "Booking resolution"}
                      {item.listing?.title
                        ? ` · Property: ${item.listing.title}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                    {title(item.status)}
                  </span>
                </div>
                <p className="mt-3 text-xs font-normal text-zinc-400">
                  Last updated {date(item.updatedAt)}
                </p>
              </button>
            ))}
            {!visibleCases.length && (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center text-sm text-zinc-500">
                No direct resolution requests match these filters.
              </div>
            )}
          </div>
        ))}
      {isCreateModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-resolution-request-title"
              onSubmit={createRequest}
              className="max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <h2
                  id="new-resolution-request-title"
                  className="text-xl font-medium"
                >
                  New resolution request
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={saving}
                  aria-label="Close new resolution request form"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
                >
                  ×
                </button>
              </div>
              {notice && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {notice}
                </div>
              )}
              <label className="block text-sm font-medium">
                Booking
                <select
                  required
                  value={requestForm.bookingId}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      bookingId: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 p-2"
                >
                  <option value="">Choose your booking</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.listing?.title || "Booking"} ·{" "}
                      {new Date(booking.startDate).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Subject
                <input
                  required
                  maxLength={160}
                  value={requestForm.subject}
                  onChange={(event) =>
                    setRequestForm({
                      ...requestForm,
                      subject: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 p-2"
                />
              </label>
              <OfferFields
                form={requestForm}
                onChange={(next) => setRequestForm({ ...requestForm, ...next })}
              />
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  disabled={saving}
                  className="rounded-full bg-[#1f1f1f] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Creating…" : "Send resolution request"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={saving}
                  className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
      {screen === "detail" &&
        (loading || !active ? (
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="font-mono text-xs text-zinc-500">
                  {active.caseNumber}
                </p>
                <h2 className="mt-1 text-2xl font-medium">{active.subject}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                  {active.description}
                </p>
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-medium">Guest–host discussion</h2>
                  <span className="text-xs text-zinc-500">
                    Shared with authorized participants
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {active.messages?.map((message) => {
                    const own = message.sender.id === active.viewer.id;
                    return (
                      <article
                        key={message.id}
                        className={`max-w-[88%] rounded-2xl p-3 text-sm ${own ? "ml-auto bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"}`}
                      >
                        <p
                          className={`text-xs font-medium ${own ? "text-zinc-300" : "text-zinc-500"}`}
                        >
                          {own
                            ? "You"
                            : `${message.sender.name || "Participant"}${message.sender.role ? ` · ${title(message.sender.role)}` : ""}`}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap leading-6">
                          {message.content}
                        </p>
                        <time
                          className={`mt-2 block text-[11px] ${own ? "text-zinc-400" : "text-zinc-500"}`}
                        >
                          {date(message.createdAt)}
                        </time>
                      </article>
                    );
                  })}
                  {!active.messages?.length && (
                    <p className="text-sm text-zinc-500">
                      No discussion messages yet.
                    </p>
                  )}
                </div>
                <form onSubmit={sendDiscussion} className="mt-5 border-t pt-4">
                  <label className="sr-only">
                    Message to booking participant
                  </label>
                  <textarea
                    value={discussion}
                    onChange={(event) => setDiscussion(event.target.value)}
                    maxLength={10000}
                    placeholder="Write a message to the booking participant…"
                    className="min-h-24 w-full rounded-xl border border-zinc-300 p-3 text-sm"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      disabled={saving || !discussion.trim()}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Send message
                    </button>
                  </div>
                </form>
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="font-medium">Negotiation history</h2>
                <div className="mt-4 space-y-3">
                  {active.resolutionOffers?.map((offer) => {
                    const recipient = active.viewer.id === offer.recipient.id;
                    const proposer = active.viewer.id === offer.proposer.id;
                    return (
                      <article
                        key={offer.id}
                        className="rounded-xl bg-zinc-50 p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">
                            {title(offer.offerType)}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-medium">
                            {offer.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">
                          {money(offer.amount, offer.currency)} ·{" "}
                          {offer.proposer.name || "Participant"} →{" "}
                          {offer.recipient.name || "Participant"}
                        </p>
                        <p className="mt-2 text-sm text-zinc-700">
                          {offer.description}
                        </p>
                        {offer.expiresAt && (
                          <p className="mt-2 text-xs text-zinc-500">
                            Expires {date(offer.expiresAt)}
                          </p>
                        )}
                        {offer.status === "PENDING" && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recipient && (
                              <>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void act(offer, "ACCEPT")}
                                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void act(offer, "REJECT")}
                                  className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-800"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    setCountering(offer);
                                    setOfferForm({
                                      offerType: offer.offerType,
                                      amount: offer.amount?.toString() || "",
                                      description: "",
                                      expiresAt: "",
                                    });
                                  }}
                                  className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                                >
                                  Counteroffer
                                </button>
                              </>
                            )}
                            {proposer && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void act(offer, "WITHDRAW")}
                                className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                <form onSubmit={createOffer} className="mt-5 border-t pt-5">
                  <h3 className="font-medium">
                    {countering ? "Counteroffer" : "Propose a new offer"}
                  </h3>
                  {countering && (
                    <button
                      type="button"
                      onClick={() => setCountering(null)}
                      className="mt-1 text-xs font-medium underline"
                    >
                      Cancel counteroffer
                    </button>
                  )}
                  <div className="mt-3">
                    <OfferFields form={offerForm} onChange={setOfferForm} />
                  </div>
                  <button
                    disabled={saving}
                    className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    Send offer
                  </button>
                </form>
              </section>
            </div>
            <aside className="space-y-5">
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="font-medium">Supporting evidence</h2>
                <AttachmentPicker
                  files={evidenceFiles}
                  onChange={setEvidenceFiles}
                  onError={setNotice}
                  disabled={saving}
                  label="Select evidence"
                  description="JPG, PNG, WEBP, or PDF files up to 15 MB each."
                />
                <button
                  type="button"
                  disabled={saving || evidenceFiles.length === 0}
                  onClick={() => void uploadEvidence()}
                  className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Uploading…"
                    : `Upload ${evidenceFiles.length || ""} evidence${
                        evidenceFiles.length === 1 ? "" : " files"
                      }`}
                </button>
                <ul className="mt-3 space-y-2 text-sm">
                  {active.evidence?.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`/api/v1/support/cases/${active.id}/evidence/${item.id}?download=true`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {item.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="font-medium">Request mediation</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Ask an authorized administrator to review the negotiation.
                  This does not force a payment or decision.
                </p>
                {active.status === "ESCALATED" ? (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    Mediation is already requested. Support will update this
                    case here.
                  </p>
                ) : (
                  <>
                    <textarea
                      value={mediationReason}
                      onChange={(event) =>
                        setMediationReason(event.target.value)
                      }
                      maxLength={2000}
                      className="mt-3 min-h-24 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                      placeholder="Why is mediation needed?"
                    />
                    <button
                      type="button"
                      disabled={saving || !mediationReason.trim()}
                      onClick={() => void requestMediation()}
                      className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
                    >
                      Request mediation
                    </button>
                  </>
                )}
              </section>
              <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="font-medium">Case activity</h2>
                <ol className="mt-3 space-y-3 border-l border-zinc-200 pl-4">
                  {active.events?.map((event) => (
                    <li key={event.id} className="text-sm">
                      <p>{event.description || title(event.eventType)}</p>
                      <time className="text-xs text-zinc-500">
                        {date(event.createdAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        ))}
    </section>
  );
}
