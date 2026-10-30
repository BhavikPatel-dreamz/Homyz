"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Status = "OPEN" | "IN_REVIEW" | "WAITING_FOR_GUEST" | "WAITING_FOR_HOST" | "WAITING_FOR_ADMIN" | "RESOLVED" | "CLOSED" | "REOPENED" | "ESCALATED";
type Taxonomy = { value: string; label: string; issueTypes: { value: string; label: string }[] };
type Case = { id: string; caseNumber: string; category: string; issueType: string | null; subject: string; description?: string | null; status: Status; priority: string; createdAt: string; updatedAt: string; booking?: { id: string; submissionId?: string | null; startDate?: string; endDate?: string } | null; listing?: { title?: string | null; city?: string | null } | null; messages?: { id: string; content: string; createdAt: string; sender: { name: string | null } }[]; evidence?: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string }[]; events?: { id: string; eventType: string; description: string | null; createdAt: string }[] };
type Booking = { id: string; startDate: string; endDate: string; listing?: { title?: string | null } | null };

const labels: Record<Status, string> = { OPEN: "Open", IN_REVIEW: "In review", WAITING_FOR_GUEST: "Waiting for you", WAITING_FOR_HOST: "Waiting for host", WAITING_FOR_ADMIN: "Waiting for support", RESOLVED: "Resolved", CLOSED: "Closed", REOPENED: "Reopened", ESCALATED: "Escalated" };
const mutable = new Set<Status>(["OPEN", "IN_REVIEW", "WAITING_FOR_GUEST", "WAITING_FOR_ADMIN", "REOPENED", "ESCALATED"]);
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const bytes = (value: number) => value < 1048576 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1048576).toFixed(1)} MB`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Support service is temporarily unavailable.");
  return payload.data as T;
}

function badge(status: Status) {
  if (status === "RESOLVED") return "bg-emerald-100 text-emerald-800";
  if (status === "CLOSED") return "bg-slate-200 text-slate-700";
  if (status === "WAITING_FOR_GUEST") return "bg-amber-100 text-amber-900";
  if (status === "ESCALATED") return "bg-rose-100 text-rose-800";
  return "bg-blue-100 text-blue-800";
}

export function SupportResolutionCenter() {
  const [screen, setScreen] = useState<"list" | "create" | "detail">("list");
  const [items, setItems] = useState<Case[]>([]);
  const [active, setActive] = useState<Case | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filters, setFilters] = useState({ status: "", category: "", search: "" });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "", issueType: "", bookingId: "", subject: "", description: "" });
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const createKey = useRef<string | null>(null);
  const replyKey = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (target = page) => {
    setLoading(true); setMessage(null);
    try {
      const query = new URLSearchParams({ page: String(target), limit: "10" });
      if (filters.status) query.set("status", filters.status);
      if (filters.category) query.set("category", filters.category);
      if (filters.search.trim()) query.set("search", filters.search.trim());
      const result = await api<{ cases: Case[]; pagination: { page: number; totalPages: number } }>(`/api/v1/support/cases?${query}`);
      setItems(result.cases); setPages(result.pagination);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load support requests."); }
    finally { setLoading(false); }
  }, [filters, page]);

  const open = useCallback(async (id: string) => {
    setDetailLoading(true); setMessage(null);
    try { setActive(await api<Case>(`/api/v1/support/cases/${encodeURIComponent(id)}`)); setScreen("detail"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open this support request."); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(page); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, page]);
  useEffect(() => {
    void Promise.all([api<{ categories: Taxonomy[] }>("/api/v1/support/case-taxonomy"), api<Booking[]>("/api/v1/bookings?page=1&limit=100")])
      .then(([categories, reservations]) => { setTaxonomy(categories.categories); setBookings(reservations); })
      .catch(() => undefined);
    const caseId = new URLSearchParams(window.location.search).get("caseId");
    if (caseId) window.setTimeout(() => { void open(caseId); }, 0);
  }, [open]);

  const back = () => { setScreen("list"); setActive(null); setMessage(null); void load(page); };
  const selected = taxonomy.find((category) => category.value === form.category);
  const key = (prefix: string) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random()}`;

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(null);
    if (!form.category || !form.issueType || !form.subject.trim() || !form.description.trim()) { setMessage("Choose a category and issue type, then add a subject and description."); return; }
    setSubmitting(true); createKey.current ??= key("case");
    try {
      const created = await api<Case>("/api/v1/support/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, bookingId: form.bookingId || undefined, idempotencyKey: createKey.current }) });
      createKey.current = null; setForm({ category: "", issueType: "", bookingId: "", subject: "", description: "" }); await open(created.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create support request."); }
    finally { setSubmitting(false); }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault(); if (!active || !reply.trim()) return;
    setSubmitting(true); setMessage(null); replyKey.current ??= key("message");
    try { await api(`/api/v1/support/cases/${active.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: reply.trim(), idempotencyKey: replyKey.current }) }); replyKey.current = null; setReply(""); await open(active.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send reply."); }
    finally { setSubmitting(false); }
  }

  async function upload(file?: File) {
    if (!active || !file) return;
    setUploading(true); setMessage(null);
    try { const data = new FormData(); data.set("file", file); await api(`/api/v1/support/cases/${active.id}/evidence/upload`, { method: "POST", body: data }); await open(active.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to upload evidence."); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  return <section className="animate-in fade-in duration-300">
    <header className="mb-6 flex flex-col gap-4 border-b border-[#e5e5e5] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-[28px] font-medium tracking-[-0.02em] text-[#1f1f1f] sm:text-[34px]">Help &amp; Support</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#727272]">Create and track requests for a reservation, payment, account, or general question.</p></div><div className="flex flex-wrap items-center gap-3">
      <Link href="/profile/resolution-center" className="text-sm font-semibold text-[#1f1f1f] underline underline-offset-4">Resolution Center</Link>
      {screen === "list" ? <button type="button" onClick={() => { setScreen("create"); setMessage(null); }} className="rounded-full bg-[#1f1f1f] px-5 py-2.5 text-sm font-semibold text-white">Create support request</button> : <button type="button" onClick={back} className="text-sm font-semibold text-[#1f1f1f] underline underline-offset-4">← My support requests</button>}</div></header>
    {message && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</div>}
    {screen === "list" && <><div className="mb-5 grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Status<select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] bg-white px-3 py-2 text-sm"><option value="">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">Category<select value={filters.category} onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] bg-white px-3 py-2 text-sm"><option value="">All categories</option>{taxonomy.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label><label className="text-sm font-medium">Search<input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(1); } }} placeholder="Case number or title" className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] px-3 py-2 text-sm" /></label></div><div className="mb-5 text-right"><button type="button" onClick={() => { setPage(1); void load(1); }} className="text-sm font-semibold underline underline-offset-4">Apply search</button></div>{loading ? <div role="status" className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-[#f3f4f5]" />)}</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d7d7d7] bg-[#fafafa] px-6 py-14 text-center"><h3 className="text-lg font-semibold">No support requests yet</h3><p className="mt-2 text-sm text-[#727272]">Create a request and its updates will appear here.</p><button type="button" onClick={() => setScreen("create")} className="mt-5 rounded-full bg-[#fcdf9c] px-5 py-2.5 text-sm font-semibold">Create support request</button></div> : <div className="space-y-3">{items.map((item) => <button type="button" key={item.id} onClick={() => void open(item.id)} className="w-full rounded-xl border border-[#e5e5e5] bg-white p-4 text-left transition hover:border-[#1f1f1f]"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-[#727272]">{item.caseNumber}</p><h3 className="mt-1 font-semibold">{item.subject}</h3><p className="mt-1 text-sm text-[#727272]">{item.category.replaceAll("_", " ")} · {item.issueType?.replaceAll("_", " ") || "General"}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-xs font-semibold ${badge(item.status)}`}>{labels[item.status]}</span></div><p className="mt-3 text-xs text-[#727272]">Created {date(item.createdAt)} · Updated {date(item.updatedAt)}</p></button>)}</div>}{pages.totalPages > 1 && <nav className="mt-5 flex items-center justify-between text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {pages.page} of {pages.totalPages}</span><button type="button" disabled={page >= pages.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></nav>}</>}
    {screen === "create" && <form onSubmit={submit} className="max-w-3xl space-y-5 rounded-2xl border border-[#e5e5e5] bg-white p-5 sm:p-7"><div><h3 className="text-xl font-semibold">Create support request</h3><p className="mt-1 text-sm text-[#727272]">For an existing booking dispute, use the dispute action on that reservation. This form creates a separate support case.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Category<select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, issueType: "" })} className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] px-3 py-2"><option value="">Choose a category</option>{taxonomy.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label><label className="text-sm font-medium">Issue type<select required disabled={!selected} value={form.issueType} onChange={(e) => setForm({ ...form, issueType: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] px-3 py-2 disabled:bg-[#f3f4f5]"><option value="">Choose an issue type</option>{selected?.issueTypes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label></div><label className="block text-sm font-medium">Related booking <span className="font-normal text-[#727272]">(optional)</span><select value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] px-3 py-2"><option value="">No related booking</option>{bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.listing?.title || "Reservation"} · {new Date(booking.startDate).toLocaleDateString()}–{new Date(booking.endDate).toLocaleDateString()}</option>)}</select></label><label className="block text-sm font-medium">Subject<input required maxLength={160} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#d7d7d7] px-3 py-2" /></label><label className="block text-sm font-medium">Description<textarea required maxLength={10000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5 min-h-36 w-full rounded-lg border border-[#d7d7d7] px-3 py-2" placeholder="Share relevant details. Do not include passwords or payment-card details." /></label><div className="flex gap-3"><button disabled={submitting || !taxonomy.length} type="submit" className="rounded-full bg-[#1f1f1f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Creating…" : "Create request"}</button><button type="button" onClick={back} className="rounded-full border px-5 py-2.5 text-sm font-semibold">Cancel</button></div></form>}
    {screen === "detail" && (detailLoading || !active ? <div className="h-96 animate-pulse rounded-xl bg-[#f3f4f5]" /> : <article className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-6"><section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-mono text-xs font-semibold text-[#727272]">{active.caseNumber}</p><h3 className="mt-1 text-2xl font-semibold">{active.subject}</h3></div><span className={`h-fit rounded-full px-3 py-1.5 text-xs font-semibold ${badge(active.status)}`}>{labels[active.status]}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[#727272]">Category</dt><dd className="mt-1 font-medium">{active.category.replaceAll("_", " ")} · {active.issueType?.replaceAll("_", " ") || "General"}</dd></div><div><dt className="text-[#727272]">Related booking</dt><dd className="mt-1 font-medium">{active.listing?.title || active.booking?.submissionId || "Not linked to a booking"}</dd></div><div><dt className="text-[#727272]">Created</dt><dd className="mt-1">{date(active.createdAt)}</dd></div><div><dt className="text-[#727272]">Latest activity</dt><dd className="mt-1">{date(active.updatedAt)}</dd></div></dl><p className="mt-5 whitespace-pre-wrap rounded-xl bg-[#f7f7f7] p-4 text-sm leading-6">{active.description || "No additional description was provided."}</p>{["RESOLVED", "CLOSED"].includes(active.status) && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">This case is {labels[active.status].toLowerCase()}. Any guest-visible resolution appears in the activity.</p>}</section><section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 sm:p-7"><h3 className="text-lg font-semibold">Messages</h3>{!active.messages?.length ? <p className="mt-4 text-sm text-[#727272]">No guest-visible messages yet.</p> : <div className="mt-4 space-y-4">{active.messages.map((entry) => <div key={entry.id} className="rounded-xl bg-[#f7f7f7] p-4"><div className="flex justify-between gap-3 text-xs text-[#727272]"><span className="font-semibold text-[#3f3f3f]">{entry.sender.name || "Support participant"}</span><time>{date(entry.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{entry.content}</p></div>)}</div>}{mutable.has(active.status) && <form onSubmit={sendReply} className="mt-5 border-t border-[#e5e5e5] pt-5"><label className="block text-sm font-medium">Reply to support<textarea value={reply} maxLength={10000} onChange={(e) => setReply(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-[#d7d7d7] px-3 py-2" /></label><button type="submit" disabled={submitting || !reply.trim()} className="mt-3 rounded-full bg-[#1f1f1f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Sending…" : "Send reply"}</button></form>}</section></div><aside className="space-y-6"><section className="rounded-2xl border border-[#e5e5e5] bg-white p-5"><h3 className="font-semibold">Evidence</h3><p className="mt-1 text-xs leading-5 text-[#727272]">JPEG, PNG, WebP, or PDF up to 15 MB. Evidence is private to authorized participants.</p><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!mutable.has(active.status) || uploading} onChange={(e) => void upload(e.target.files?.[0])} className="mt-4 block w-full text-xs" />{uploading && <p className="mt-2 text-xs text-[#727272]">Uploading securely…</p>}<ul className="mt-4 space-y-2">{active.evidence?.map((entry) => <li key={entry.id}><a href={`/api/v1/support/cases/${active.id}/evidence/${entry.id}?download=true`} target="_blank" rel="noreferrer" className="block rounded-lg bg-[#f7f7f7] p-2.5 text-sm font-medium underline">{entry.originalName}<span className="ml-1 text-xs font-normal text-[#727272]">({bytes(entry.sizeBytes)})</span></a></li>)}</ul></section><section className="rounded-2xl border border-[#e5e5e5] bg-white p-5"><h3 className="font-semibold">Activity</h3><ol className="mt-4 space-y-4 border-l border-[#d7d7d7] pl-4">{active.events?.map((entry) => <li key={entry.id} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-[#1f1f1f]" /><p className="font-medium">{entry.description || entry.eventType.replaceAll("_", " ")}</p><time className="text-xs text-[#727272]">{date(entry.createdAt)}</time></li>)}</ol></section></aside></article>)}
  </section>;
}
