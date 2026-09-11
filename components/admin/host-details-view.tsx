"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { toast } from "@/components/ui/toast";
import type { HostDetailsData } from "@/services/admin.service";
import { formatSarFromHalalas } from "@/lib/currency";

export type HostDetailsDTO = HostDetailsData;
type HostTab = "overview" | "listings" | "bookings" | "earnings" | "activity";

function StatusBadge({ status }: { status: string }) {
  const classes = status === "ACTIVE"
    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
    : status === "SUSPENDED"
      ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
      : "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60";
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function MetricCard({ label, value, subtitle }: { label: string; value: string | number; subtitle: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-muted-foreground">{value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{subtitle}</p></div>;
}

function ConfirmModal({ title, description, confirmLabel, danger = false, onCancel, onConfirm, pending }: { title: string; description: string; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void; pending: boolean }) {
  return <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="host-action-title" onMouseDown={onCancel}><div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}><h2 id="host-action-title" className="text-lg font-semibold text-muted-foreground">{title}</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} disabled={pending} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className={`rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>{pending ? "Working…" : confirmLabel}</button></div></div></ModalOverlay>;
}

export function HostDetailsView({ initialData }: { initialData: HostDetailsDTO }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<HostTab>("overview");
  const [modal, setModal] = useState<"suspend" | "delete" | null>(null);
  const [pending, startTransition] = useTransition();
  const { host, metrics } = data;
  const status = String(host.accountStatus || host.status);

  function performAction() {
    if (!modal) return;
    startTransition(async () => {
      try {
        if (modal === "delete") {
          const response = await fetch(`/api/v1/admin/hosts/${host.id}`, { method: "DELETE" });
          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.error?.message || "Unable to delete host.");
          toast.success("Host account deleted.");
          router.push("/admin/hosts");
          return;
        }
        const shouldSuspend = status !== "SUSPENDED";
        const response = await fetch(`/api/v1/admin/hosts/${host.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: shouldSuspend ? "SUSPEND" : "UNSUSPEND" }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "Unable to update host status.");
        setData((current) => ({ ...current, host: { ...current.host, status: shouldSuspend ? "SUSPENDED" : "ACTIVE", accountStatus: shouldSuspend ? "SUSPENDED" : "ACTIVE" } }));
        toast.success(shouldSuspend ? "Host account suspended." : "Host account restored.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally { setModal(null); }
    });
  }

  const tabs: { id: HostTab; label: string }[] = [{ id: "overview", label: "Overview" }, { id: "listings", label: "Listings" }, { id: "bookings", label: "Bookings" }, { id: "earnings", label: "Earnings" }, { id: "activity", label: "Activity" }];

  return <div className="flex flex-col gap-6 font-sans text-muted-foreground">
    <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 md:flex-row md:items-center"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-xl font-semibold text-[var(--accent-foreground)]">{(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}</div><div><div className="flex flex-wrap items-center gap-3"><h1>{host.name || "Unnamed Host"}</h1><StatusBadge status={status} /></div><p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{host.email || "No email"} · ID: {host.id}</p></div></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setModal("suspend")} className={`rounded-full border px-4 py-2 text-xs font-semibold shadow-2xs ${status === "SUSPENDED" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>{status === "SUSPENDED" ? "Restore Account" : "Suspend Account"}</button><button type="button" onClick={() => setModal("delete")} className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700">Delete Host</button></div></div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Total Listings" value={metrics.totalListings} subtitle="Properties managed" /><MetricCard label="Total Bookings" value={metrics.totalBookings} subtitle="Reservations received" /><MetricCard label="Total Earnings" value={formatSarFromHalalas(metrics.totalEarnings)} subtitle="Confirmed bookings" /><MetricCard label="Average Rating" value={metrics.averageRating.toFixed(1)} subtitle={`${metrics.reviewsCount} reviews`} /></div>

    <div className="overflow-x-auto border-b border-[var(--border-subtle)]"><div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${activeTab === tab.id ? "border-[var(--accent)] text-muted-foreground" : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"}`}>{tab.label}</button>)}</div></div>

    {activeTab === "overview" && <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><h2 className="text-sm font-semibold text-muted-foreground">Host Profile</h2><dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-[var(--muted-foreground)]">Full name</dt><dd className="mt-1 font-semibold">{host.name || "Not provided"}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Email address</dt><dd className="mt-1 break-all font-semibold">{host.email || "Not provided"}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Phone number</dt><dd className="mt-1 font-semibold">{host.phone || "Not provided"}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Joined</dt><dd className="mt-1 font-semibold" suppressHydrationWarning>{new Date(host.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Last active</dt><dd className="mt-1 font-semibold" suppressHydrationWarning>{new Date(host.lastActive).toLocaleDateString("en-US", { dateStyle: "medium" })}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Account status</dt><dd className="mt-1"><StatusBadge status={status} /></dd></div></dl></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><h2 className="text-sm font-semibold text-muted-foreground">Recent Activity</h2>{data.activity.length === 0 ? <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">No recent activity.</p> : <div className="mt-4 space-y-4">{data.activity.slice(0, 5).map((item) => <div key={item.id} className="border-b border-[var(--border-subtle)] pb-3 last:border-0"><p className="text-sm font-medium">{item.description || item.action}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]" suppressHydrationWarning>{new Date(item.createdAt).toLocaleString("en-US")} · {item.actorEmail || "System"}</p></div>)}</div>}</section></div>}

    {activeTab === "listings" && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] uppercase tracking-wider text-[var(--muted-foreground)]"><tr><th className="px-4 py-3.5">Listing</th><th className="px-4 py-3.5">Location</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5 text-right">Price / night</th><th className="px-4 py-3.5 text-center">Bookings</th><th className="px-4 py-3.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{data.listings.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--muted-foreground)]">This host has no listings yet.</td></tr> : data.listings.map((listing) => <tr key={listing.id}><td className="px-4 py-3.5 font-semibold">{listing.title}</td><td className="px-4 py-3.5 text-[var(--muted-foreground)]">{[listing.city, listing.country].filter(Boolean).join(", ") || "—"}</td><td className="px-4 py-3.5"><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold">{listing.status}</span></td><td className="px-4 py-3.5 text-right font-semibold">{formatSarFromHalalas(listing.price)}</td><td className="px-4 py-3.5 text-center font-semibold">{listing.bookingsCount}</td><td className="px-4 py-3.5 text-right"><Link href={`/admin/listings/${listing.id}`} className="font-semibold text-[var(--accent)] hover:underline">View listing</Link></td></tr>)}</tbody></table></div></section>}

    {activeTab === "bookings" && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] uppercase tracking-wider text-[var(--muted-foreground)]"><tr><th className="px-4 py-3.5">Guest</th><th className="px-4 py-3.5">Listing</th><th className="px-4 py-3.5">Dates</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{data.bookings.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-[var(--muted-foreground)]">This host has no bookings yet.</td></tr> : data.bookings.map((booking) => <tr key={booking.id}><td className="px-4 py-3.5"><p className="font-semibold">{booking.guestName || "Guest"}</p><p className="font-mono text-[11px] text-[var(--muted-foreground)]">{booking.guestEmail || "—"}</p></td><td className="px-4 py-3.5">{booking.listingTitle}</td><td className="px-4 py-3.5" suppressHydrationWarning>{new Date(booking.startDate).toLocaleDateString("en-US")} – {new Date(booking.endDate).toLocaleDateString("en-US")}</td><td className="px-4 py-3.5"><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold">{booking.status}</span></td><td className="px-4 py-3.5 text-right font-semibold">{formatSarFromHalalas(booking.amount)}</td></tr>)}</tbody></table></div></section>}

    {activeTab === "earnings" && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><MetricCard label="Confirmed earnings" value={formatSarFromHalalas(metrics.totalEarnings)} subtitle="From confirmed bookings" /><MetricCard label="Total bookings" value={metrics.totalBookings} subtitle="All reservation records" /><MetricCard label="Average booking value" value={formatSarFromHalalas(metrics.totalBookings ? Math.round(metrics.totalEarnings / metrics.totalBookings) : 0)} subtitle="Confirmed earnings per booking" /></div>}

    {activeTab === "activity" && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"><h2 className="text-sm font-semibold text-muted-foreground">Account Activity</h2>{data.activity.length === 0 ? <p className="py-10 text-center text-xs text-[var(--muted-foreground)]">No account activity found.</p> : <div className="mt-4 space-y-4">{data.activity.map((item) => <div key={item.id} className="flex flex-col justify-between gap-2 border-b border-[var(--border-subtle)] pb-4 text-sm last:border-0 sm:flex-row"><div><p className="font-semibold">{item.description || item.action}</p><p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{item.actorEmail || "System"}</p></div><time className="shrink-0 text-xs text-[var(--muted-foreground)]" suppressHydrationWarning>{new Date(item.createdAt).toLocaleString("en-US")}</time></div>)}</div>}</section>}

    {modal && <ConfirmModal title={modal === "delete" ? "Delete host account?" : status === "SUSPENDED" ? "Restore host account?" : "Suspend host account?"} description={modal === "delete" ? "This permanently removes the host account. This action cannot be undone." : status === "SUSPENDED" ? "The host will be able to use their account again." : "The host will no longer be able to use their account until it is restored."} confirmLabel={modal === "delete" ? "Delete host" : status === "SUSPENDED" ? "Restore account" : "Suspend account"} danger={modal === "delete" || status !== "SUSPENDED"} onCancel={() => setModal(null)} onConfirm={performAction} pending={pending} />}
  </div>;
}
