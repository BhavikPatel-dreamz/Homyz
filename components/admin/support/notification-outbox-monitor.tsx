"use client";

import { useCallback, useEffect, useState } from "react";

type Event = { id: string; eventType: string; entityType: string; entityId: string; status: string; attemptCount: number; maxAttempts: number; lastErrorCode: string | null; updatedAt: string };
type Summary = { counts: Record<string, number>; failedDeliveries: number; recent: Event[] };

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

  const load = useCallback(async () => {
    setLoading(true);
    try { setSummary(await api<Summary>("/api/v1/admin/support/notification-outbox")); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load notification operations."); }
    finally { setLoading(false); }
  }, []);

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

  return <section className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-slate-500">Support operations</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Notification delivery</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Bounded outbox processing only. Provider acceptance is recorded as sent, not delivered.</p></div><button type="button" disabled={processing} onClick={() => void process()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{processing ? "Processing…" : "Process up to 25 events"}</button></header>{notice && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{notice}</p>}{loading || !summary ? <div className="h-64 animate-pulse rounded-xl bg-slate-100" /> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{["PENDING", "PROCESSING", "RETRY_PENDING", "DEAD_LETTER", "DELIVERED"].map((status) => <div key={status} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{status.replaceAll("_", " ")}</p><p className="mt-2 text-2xl font-bold">{summary.counts[status] || 0}</p></div>)}</div><p className="text-sm text-slate-600">Failed or retry-pending deliveries: <strong>{summary.failedDeliveries}</strong></p><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-[800px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Event</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Last error</th><th className="p-3">Updated</th><th className="p-3" /></tr></thead><tbody>{summary.recent.map((event) => <tr key={event.id} className="border-t"><td className="p-3"><p className="font-medium">{event.eventType}</p><p className="font-mono text-xs text-slate-500">{event.entityId}</p></td><td className="p-3">{event.status}</td><td className="p-3">{event.attemptCount}/{event.maxAttempts}</td><td className="p-3 text-xs text-rose-700">{event.lastErrorCode || "—"}</td><td className="p-3 text-xs">{new Date(event.updatedAt).toLocaleString()}</td><td className="p-3">{["DEAD_LETTER", "RETRY_PENDING"].includes(event.status) && <button type="button" disabled={processing} onClick={() => void retry(event.id)} className="font-semibold text-indigo-700 hover:underline disabled:opacity-50">Retry</button>}</td></tr>)}</tbody></table>{!summary.recent.length && <p className="p-10 text-center text-sm text-slate-500">No notification outbox events have been recorded.</p>}</div></>}</section>;
}
