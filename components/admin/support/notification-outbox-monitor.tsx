"use client";

import { useCallback, useEffect, useState } from "react";

type Event = { id: string; eventType: string; entityType: string; entityId: string; status: string; attemptCount: number; maxAttempts: number; lastErrorCode: string | null; updatedAt: string };
type Delivery = { id: string; channel: string; status: string; attemptCount: number; failureReason: string | null; createdAt: string; lastAttemptedAt: string | null; recipient: { id: string; name: string | null; email: string | null }; outboxEvent: { id: string; eventType: string; entityType: string; entityId: string; status: string } };
type Summary = { counts: Record<string, number>; deliveryCounts: Record<string, number>; failedDeliveries: number; recent: Event[]; deliveries: Delivery[]; pagination: { page: number; totalPages: number; total: number } };

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) throw new Error(json?.error?.message || "Notification operations are unavailable.");
  return json.data as T;
}

export function NotificationOutboxMonitor() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (nextPage = page, nextStatus = deliveryStatus) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (nextStatus) params.set("status", nextStatus);
      setSummary(await api<Summary>(`/api/v1/admin/support/notification-outbox?${params}`));
    }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load notification operations."); }
    finally { setLoading(false); }
  }, [deliveryStatus, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function process() {
    setProcessing(true); setNotice(null);
    try { await api("/api/v1/admin/support/notification-outbox/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 25 }) }); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to run a bounded notification batch."); }
    finally { setProcessing(false); }
  }

  async function retry(id: string) {
    setProcessing(true); setNotice(null);
    try { await api(`/api/v1/admin/support/notification-outbox/${id}/retry`, { method: "POST" }); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to retry this event."); }
    finally { setProcessing(false); }
  }

  return <section className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-slate-500">Support operations</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Notification delivery</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Bounded outbox processing only. Provider acceptance is recorded as sent, not delivered.</p></div><button type="button" disabled={processing} onClick={() => void process()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{processing ? "Processing…" : "Process up to 25 events"}</button></header>{notice && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{notice}</p>}{loading || !summary ? <div className="h-64 animate-pulse rounded-xl bg-slate-100" /> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Outbox pending", summary.counts.PENDING || 0], ["Outbox retrying", summary.counts.RETRY_PENDING || 0], ["Email sent", summary.deliveryCounts.SENT || 0], ["In-app delivered", summary.deliveryCounts.DELIVERED || 0], ["Failed / dead letter", summary.failedDeliveries + (summary.counts.DEAD_LETTER || 0)]].map(([label, count]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{count}</p></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Failed or retry-pending deliveries: <strong>{summary.failedDeliveries}</strong></p><label className="text-sm font-medium">Delivery status<select value={deliveryStatus} onChange={(event) => { setDeliveryStatus(event.target.value); setPage(1); }} className="ml-2 rounded border p-2 text-sm font-normal"><option value="">All</option>{["PENDING", "SENDING", "SENT", "DELIVERED", "FAILED", "RETRY_PENDING", "PERMANENTLY_FAILED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Notification</th><th className="p-3">Recipient</th><th className="p-3">Channel</th><th className="p-3">Delivery</th><th className="p-3">Attempts</th><th className="p-3">Last error</th><th className="p-3">Created / attempted</th><th className="p-3" /></tr></thead><tbody>{summary.deliveries.map((delivery) => <tr key={delivery.id} className="border-t"><td className="p-3"><p className="font-medium">{delivery.outboxEvent.eventType}</p><p className="font-mono text-xs text-slate-500">{delivery.outboxEvent.entityType}: {delivery.outboxEvent.entityId}</p></td><td className="p-3">{delivery.recipient.name || "Unnamed"}<p className="text-xs text-slate-500">{delivery.recipient.email || delivery.recipient.id}</p></td><td className="p-3">{delivery.channel}</td><td className="p-3">{delivery.status}</td><td className="p-3">{delivery.attemptCount}</td><td className="p-3 text-xs text-rose-700">{delivery.failureReason || "—"}</td><td className="p-3 text-xs">{new Date(delivery.createdAt).toLocaleString()}<p>{delivery.lastAttemptedAt ? new Date(delivery.lastAttemptedAt).toLocaleString() : "Not attempted"}</p></td><td className="p-3">{["DEAD_LETTER", "RETRY_PENDING"].includes(delivery.outboxEvent.status) && <button type="button" disabled={processing} onClick={() => void retry(delivery.outboxEvent.id)} className="font-semibold text-indigo-700 hover:underline disabled:opacity-50">Retry</button>}</td></tr>)}</tbody></table>{!summary.deliveries.length && <p className="p-10 text-center text-sm text-slate-500">No notification deliveries match this filter.</p>}</div><nav className="flex items-center justify-between text-sm"><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button><span>Page {summary.pagination.page} of {summary.pagination.totalPages} · {summary.pagination.total} deliveries</span><button disabled={page >= summary.pagination.totalPages || loading} onClick={() => setPage(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button></nav></>}</section>;
}
