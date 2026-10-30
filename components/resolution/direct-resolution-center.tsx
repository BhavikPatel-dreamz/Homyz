"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type OfferType = "MONETARY_COMPENSATION" | "PROPERTY_DAMAGE" | "NON_FINANCIAL" | "AMENITY_ISSUE" | "OTHER";
type Offer = { id: string; offerType: OfferType; amount: number | null; currency: string; description: string; status: string; version: number; expiresAt: string | null; proposer: { id: string; name: string | null }; recipient: { id: string; name: string | null } };
type ResolutionCase = { id: string; caseNumber: string; subject: string; description: string | null; status: string; version: number; updatedAt: string; viewer: { id: string; isAdmin: boolean }; listing?: { title: string | null } | null; resolutionOffers?: Offer[]; events?: { id: string; description: string | null; eventType: string; createdAt: string }[]; evidence?: { id: string; originalName: string; sizeBytes: number }[] };
type Booking = { id: string; startDate: string; listing?: { title?: string | null } | null };
type FormState = { offerType: OfferType; amount: string; description: string; expiresAt: string };

const offerTypes: OfferType[] = ["MONETARY_COMPENSATION", "PROPERTY_DAMAGE", "NON_FINANCIAL", "AMENITY_ISSUE", "OTHER"];
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const money = (amount: number | null, currency: string) => amount === null ? "Non-financial" : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
const emptyOffer: FormState = { offerType: "NON_FINANCIAL", amount: "", description: "", expiresAt: "" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Resolution service is temporarily unavailable.");
  return payload.data as T;
}

function OfferFields({ form, onChange }: { form: FormState; onChange: (next: FormState) => void }) {
  const monetary = form.offerType === "MONETARY_COMPENSATION" || form.offerType === "PROPERTY_DAMAGE";
  return <div className="space-y-3">
    <label className="block text-sm font-medium">Offer type
      <select value={form.offerType} onChange={(event) => onChange({ ...form, offerType: event.target.value as OfferType })} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2">
        {offerTypes.map((type) => <option key={type} value={type}>{title(type)}</option>)}
      </select>
    </label>
    {monetary && <label className="block text-sm font-medium">Amount (minor units)<input required min="1" type="number" value={form.amount} onChange={(event) => onChange({ ...form, amount: event.target.value })} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" /></label>}
    <label className="block text-sm font-medium">Explanation<textarea required maxLength={4000} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} className="mt-1 block min-h-24 w-full rounded-lg border border-zinc-300 p-2" /></label>
    <label className="block text-sm font-medium">Expires at <span className="font-normal text-zinc-500">(optional)</span><input type="datetime-local" value={form.expiresAt} onChange={(event) => onChange({ ...form, expiresAt: event.target.value })} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" /></label>
  </div>;
}

export function DirectResolutionCenter({ audience }: { audience: "guest" | "host" }) {
  const [cases, setCases] = useState<ResolutionCase[]>([]);
  const [active, setActive] = useState<ResolutionCase | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [screen, setScreen] = useState<"list" | "create" | "detail">("list");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestForm, setRequestForm] = useState({ bookingId: "", subject: "", ...emptyOffer });
  const [offerForm, setOfferForm] = useState<FormState>(emptyOffer);
  const [countering, setCountering] = useState<Offer | null>(null);
  const [mediationReason, setMediationReason] = useState("");
  const createKey = useRef<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ cases: ResolutionCase[] }>("/api/v1/support/cases?page=1&limit=100&resolutionOnly=true");
      setCases(data.cases);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load resolution requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setActive(await api<ResolutionCase>(`/api/v1/support/cases/${id}`));
      setScreen("detail");
      setCountering(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load this resolution request.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => {
      void loadCases();
      const bookingUrl = audience === "host" ? "/api/v1/host/resolution-bookings" : "/api/v1/bookings?page=1&limit=100";
      void api<Booking[]>(bookingUrl).then(setBookings).catch(() => undefined);
      const caseId = new URLSearchParams(window.location.search).get("caseId");
      if (caseId) void open(caseId);
    }, 0);
    return () => window.clearTimeout(start);
  }, [audience, loadCases, open]);

  const payload = (form: FormState) => ({ offerType: form.offerType, amount: form.amount ? Number(form.amount) : undefined, description: form.description.trim(), expiresAt: form.expiresAt || undefined });

  async function createRequest(event: FormEvent) {
    event.preventDefault();
    if (!requestForm.bookingId || !requestForm.subject.trim() || !requestForm.description.trim()) return setNotice("Choose a booking and provide a subject and explanation.");
    setSaving(true); setNotice(null); createKey.current ??= globalThis.crypto?.randomUUID?.() || `resolution-${Date.now()}`;
    try {
      const result = await api<{ supportCaseId: string }>("/api/v1/support/resolutions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: requestForm.bookingId, subject: requestForm.subject.trim(), ...payload(requestForm), idempotencyKey: createKey.current }) });
      createKey.current = null;
      await open(result.supportCaseId);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create resolution request."); }
    finally { setSaving(false); }
  }

  async function createOffer(event: FormEvent) {
    event.preventDefault();
    if (!active || !offerForm.description.trim()) return;
    setSaving(true); setNotice(null);
    try {
      await api(`/api/v1/support/cases/${active.id}/resolution-offers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload(offerForm), parentOfferId: countering?.id, idempotencyKey: globalThis.crypto?.randomUUID?.() || `offer-${Date.now()}` }) });
      setOfferForm(emptyOffer); setCountering(null); await open(active.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to submit resolution offer."); }
    finally { setSaving(false); }
  }

  async function act(offer: Offer, action: "ACCEPT" | "REJECT" | "WITHDRAW") {
    if (!window.confirm(`${title(action.toLowerCase())} this resolution offer?`)) return;
    setSaving(true); setNotice(null);
    try {
      await api(`/api/v1/support/resolution-offers/${offer.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, expectedVersion: offer.version }) });
      if (active) await open(active.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update resolution offer."); }
    finally { setSaving(false); }
  }

  async function requestMediation() {
    if (!active || !mediationReason.trim()) return;
    setSaving(true); setNotice(null);
    try {
      await api(`/api/v1/support/cases/${active.id}/mediation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: active.version, reason: mediationReason.trim() }) });
      setMediationReason(""); await open(active.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to request mediation."); }
    finally { setSaving(false); }
  }

  async function uploadEvidence(file: File) {
    if (!active) return;
    setSaving(true); setNotice(null);
    try {
      const data = new FormData(); data.set("file", file);
      await api(`/api/v1/support/cases/${active.id}/evidence/upload`, { method: "POST", body: data });
      await open(active.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to upload evidence."); }
    finally { setSaving(false); }
  }

  return <section className="mx-auto max-w-6xl space-y-6 py-7">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5"><div><p className="text-sm text-zinc-500">{audience === "host" ? "Host operations" : "Help & support"}</p><h1 className="mt-1 text-3xl font-semibold text-[#1f1f1f]">Direct Resolution Center</h1><p className="mt-1 max-w-2xl text-sm text-zinc-600">Work directly with the booking participant. Agreements are recorded; no payment or payout is executed here.</p></div>{screen === "list" ? <button type="button" onClick={() => { setScreen("create"); setNotice(null); }} className="rounded-full bg-[#1f1f1f] px-5 py-2.5 text-sm font-semibold text-white">New resolution request</button> : <button type="button" onClick={() => { setScreen("list"); setActive(null); void loadCases(); }} className="text-sm font-semibold underline">← All requests</button>}</header>
    {notice && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{notice}</p>}
    {screen === "list" && (loading ? <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" /> : <div className="grid gap-3">{cases.map((item) => <button key={item.id} type="button" onClick={() => void open(item.id)} className="rounded-xl border border-zinc-200 bg-white p-4 text-left hover:border-zinc-500"><div className="flex justify-between gap-3"><div><p className="font-mono text-xs text-zinc-500">{item.caseNumber}</p><h2 className="mt-1 font-semibold">{item.subject}</h2><p className="mt-1 text-sm text-zinc-500">{item.listing?.title || "Booking resolution"} · Updated {date(item.updatedAt)}</p></div><span className="h-fit rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold">{title(item.status)}</span></div></button>)}{!cases.length && <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500">No direct resolution requests yet.</div>}</div>)}
    {screen === "create" && <form onSubmit={createRequest} className="max-w-2xl space-y-4 rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-xl font-semibold">New resolution request</h2><label className="block text-sm font-medium">Booking<select required value={requestForm.bookingId} onChange={(event) => setRequestForm({ ...requestForm, bookingId: event.target.value })} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2"><option value="">Choose your booking</option>{bookings.map((booking) => <option key={booking.id} value={booking.id}>{booking.listing?.title || "Booking"} · {new Date(booking.startDate).toLocaleDateString()}</option>)}</select></label><label className="block text-sm font-medium">Subject<input required maxLength={160} value={requestForm.subject} onChange={(event) => setRequestForm({ ...requestForm, subject: event.target.value })} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" /></label><OfferFields form={requestForm} onChange={(next) => setRequestForm({ ...requestForm, ...next })} /><button disabled={saving} className="rounded-full bg-[#1f1f1f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Send resolution request"}</button></form>}
    {screen === "detail" && (loading || !active ? <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" /> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-6"><section className="rounded-2xl border border-zinc-200 bg-white p-5"><p className="font-mono text-xs text-zinc-500">{active.caseNumber}</p><h2 className="mt-1 text-2xl font-semibold">{active.subject}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{active.description}</p></section><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-semibold">Negotiation history</h2><div className="mt-4 space-y-3">{active.resolutionOffers?.map((offer) => { const recipient = active.viewer.id === offer.recipient.id; const proposer = active.viewer.id === offer.proposer.id; return <article key={offer.id} className="rounded-xl bg-zinc-50 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{title(offer.offerType)}</strong><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{offer.status}</span></div><p className="mt-2 text-sm">{money(offer.amount, offer.currency)} · {offer.proposer.name || "Participant"} → {offer.recipient.name || "Participant"}</p><p className="mt-2 text-sm text-zinc-700">{offer.description}</p>{offer.expiresAt && <p className="mt-2 text-xs text-zinc-500">Expires {date(offer.expiresAt)}</p>}{offer.status === "PENDING" && <div className="mt-3 flex flex-wrap gap-2">{recipient && <><button type="button" disabled={saving} onClick={() => void act(offer, "ACCEPT")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Accept</button><button type="button" disabled={saving} onClick={() => void act(offer, "REJECT")} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-800">Reject</button><button type="button" disabled={saving} onClick={() => { setCountering(offer); setOfferForm({ offerType: offer.offerType, amount: offer.amount?.toString() || "", description: "", expiresAt: "" }); }} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Counteroffer</button></>}{proposer && <button type="button" disabled={saving} onClick={() => void act(offer, "WITHDRAW")} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Withdraw</button>}</div>}</article>; })}</div><form onSubmit={createOffer} className="mt-5 border-t pt-5"><h3 className="font-semibold">{countering ? "Counteroffer" : "Propose a new offer"}</h3>{countering && <button type="button" onClick={() => setCountering(null)} className="mt-1 text-xs font-semibold underline">Cancel counteroffer</button>}<div className="mt-3"><OfferFields form={offerForm} onChange={setOfferForm} /></div><button disabled={saving} className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Send offer</button></form></section></div><aside className="space-y-5"><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-semibold">Supporting evidence</h2><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" disabled={saving} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadEvidence(file); event.currentTarget.value = ""; }} className="mt-3 block w-full text-sm" /><p className="mt-2 text-xs text-zinc-500">JPG, PNG, WEBP, or PDF; 15 MB maximum.</p><ul className="mt-3 space-y-2 text-sm">{active.evidence?.map((item) => <li key={item.id}><a href={`/api/v1/support/cases/${active.id}/evidence/${item.id}?download=true`} target="_blank" rel="noreferrer" className="underline">{item.originalName}</a></li>)}</ul></section><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-semibold">Request mediation</h2><p className="mt-1 text-sm text-zinc-600">Ask an authorized administrator to review the negotiation. This does not force a payment or decision.</p><textarea value={mediationReason} onChange={(event) => setMediationReason(event.target.value)} maxLength={2000} className="mt-3 min-h-24 w-full rounded-lg border border-zinc-300 p-2 text-sm" placeholder="Why is mediation needed?" /><button type="button" disabled={saving || !mediationReason.trim()} onClick={() => void requestMediation()} className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Request mediation</button></section><section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="font-semibold">Case activity</h2><ol className="mt-3 space-y-3 border-l border-zinc-200 pl-4">{active.events?.map((event) => <li key={event.id} className="text-sm"><p>{event.description || title(event.eventType)}</p><time className="text-xs text-zinc-500">{date(event.createdAt)}</time></li>)}</ol></section></aside></div>)}
  </section>;
}
