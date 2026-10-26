"use client";

import { useState } from "react";
import Link from "next/link";

type OperationsData = Awaited<ReturnType<typeof import("@/services/host-operational-records.service")["hostOperationalRecordsService"]["overview"]>>;

const money = (value: number, currency = "SAR") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);

export function HostOperationsClient({ initialData }: { initialData: OperationsData }) {
  const [data, setData] = useState(initialData);
  const [filterListingId, setFilterListingId] = useState("");
  const [taskListingId, setTaskListingId] = useState(initialData.listings[0]?.id || "");
  const [cleaningTitle, setCleaningTitle] = useState("");
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [saving, setSaving] = useState<"CLEANING" | "MAINTENANCE" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async (listingId = filterListingId) => {
    const query = listingId ? `?listingId=${encodeURIComponent(listingId)}` : "";
    const response = await fetch(`/api/v1/host/operations${query}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || "Could not load operations.");
    setData(payload.data);
  };

  const changeFilter = async (listingId: string) => {
    setFilterListingId(listingId);
    setError(null);
    try {
      await reload(listingId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not filter operations.");
    }
  };

  const createCleaningTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskListingId || !cleaningTitle.trim()) {
      setError("Choose a listing and provide a cleaning task title.");
      return;
    }
    setSaving("CLEANING");
    setError(null);
    try {
      const response = await fetch("/api/v1/host/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: taskListingId, title: cleaningTitle, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Could not create cleaning task.");
      setCleaningTitle("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create cleaning task.");
    } finally {
      setSaving(null);
    }
  };

  const createMaintenanceRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskListingId || !maintenanceTitle.trim()) {
      setError("Choose a listing and provide a maintenance record title.");
      return;
    }
    setSaving("MAINTENANCE");
    setError(null);
    try {
      const response = await fetch("/api/v1/host/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MAINTENANCE", listingId: taskListingId, title: maintenanceTitle, serviceDate: serviceDate || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || "Could not create maintenance record.");
      setMaintenanceTitle("");
      setServiceDate("");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create maintenance record.");
    } finally {
      setSaving(null);
    }
  };

  const complete = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/v1/host/operations/cleaning/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!response.ok) throw new Error();
      await reload();
    } catch {
      setError("Could not update the cleaning task.");
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b border-zinc-200 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Dashboard Plus</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Property operations</h1>
            <p className="mt-2 text-sm text-zinc-600">Track cleaning and maintenance using real operational records.</p>
          </div>
          <Link href="/host/dashboard" className="text-xs font-semibold underline underline-offset-4">Back to dashboard</Link>
        </div>
        <label className="mt-5 block max-w-xs text-xs font-semibold text-zinc-600">
          Property
          <select aria-label="Filter operations by property" value={filterListingId} onChange={(event) => void changeFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal">
            <option value="">All authorized listings</option>
            {initialData.listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
          </select>
        </label>
      </header>

      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Cleaning tasks" value={data.cleaning.total} />
        <Metric label="Completed" value={data.cleaning.completed} />
        <Metric label="Pending" value={data.cleaning.pending} />
        <Metric label="Overdue" value={data.cleaning.delayed} />
        <Metric label="Recorded cleaning cost" value={money(data.cleaning.recordedExpensesCents)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cleaning workflow</p><h2 className="mt-1 text-xl font-bold">Tasks</h2></div>
            <span className="text-xs text-zinc-500">Completion is manual</span>
          </div>
          <div className="mt-5 divide-y divide-zinc-100">
            {data.cleaning.tasks.length ? data.cleaning.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-4">
                <div className={`h-2.5 w-2.5 rounded-full ${task.status === "COMPLETED" ? "bg-emerald-500" : task.status === "CANCELLED" ? "bg-zinc-300" : "bg-amber-400"}`} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{task.title}</p><p className="mt-1 text-xs text-zinc-500">{task.listingTitle} · {task.scheduledFor ? new Date(task.scheduledFor).toLocaleDateString() : "Not scheduled"}</p></div>
                <span className="text-xs font-medium text-zinc-600">{task.status.replaceAll("_", " ")}</span>
                {task.status !== "COMPLETED" && task.status !== "CANCELLED" && <button type="button" onClick={() => void complete(task.id)} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-50">Complete</button>}
              </div>
            )) : <p className="py-8 text-sm text-zinc-500">No cleaning tasks recorded. Completed stays do not automatically create or complete cleaning tasks.</p>}
          </div>
        </div>

        <form onSubmit={createCleaningTask} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">New task</p><h2 className="mt-1 text-xl font-bold">Add cleaning task</h2>
          <ListingSelect listings={initialData.listings} value={taskListingId} onChange={setTaskListingId} />
          <input value={cleaningTitle} onChange={(event) => setCleaningTitle(event.target.value)} placeholder="e.g. Turnover clean" className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm" />
          <button disabled={saving !== null} className="mt-3 w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving === "CLEANING" ? "Creating…" : "Create task"}</button>
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Maintenance</p><h2 className="mt-1 text-xl font-bold">Service records</h2><p className="mt-2 text-sm text-zinc-600">{data.maintenance.message}</p>
          <div className="mt-5 divide-y divide-zinc-100">
            {data.maintenance.records.length ? data.maintenance.records.map((record) => (
              <div key={record.id} className="flex justify-between gap-4 py-3 text-sm"><div><p className="font-semibold">{record.title}</p><p className="mt-1 text-xs text-zinc-500">{record.listingTitle} · {record.serviceDate ? new Date(record.serviceDate).toLocaleDateString() : "Service date not recorded"}</p></div><span className="text-xs text-zinc-500">{record.status.replaceAll("_", " ")}</span></div>
            )) : <p className="py-8 text-sm text-zinc-500">No maintenance records have been added.</p>}
          </div>
        </div>
        <form onSubmit={createMaintenanceRecord} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">New record</p><h2 className="mt-1 text-xl font-bold">Add maintenance</h2>
          <ListingSelect listings={initialData.listings} value={taskListingId} onChange={setTaskListingId} />
          <input value={maintenanceTitle} onChange={(event) => setMaintenanceTitle(event.target.value)} placeholder="e.g. Air-conditioning service" className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm" />
          <input aria-label="Maintenance service date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} type="date" className="mt-3 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm" />
          <button disabled={saving !== null} className="mt-3 w-full rounded-xl bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving === "MAINTENANCE" ? "Creating…" : "Create maintenance record"}</button>
        </form>
      </section>
    </div>
  );
}

function ListingSelect({ listings, value, onChange }: { listings: OperationsData["listings"]; value: string; onChange: (value: string) => void }) {
  return <select aria-label="Select listing" value={value} onChange={(event) => onChange(event.target.value)} className="mt-5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm">{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}</select>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">{value}</p></div>;
}
