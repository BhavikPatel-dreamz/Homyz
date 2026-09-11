"use client";

import React, { useMemo, useState } from "react";
import type { UnifiedHostAnalytics, UnifiedHostItem } from "@/services/admin.service";

export interface HostPhase1DashboardProps {
  analytics: UnifiedHostAnalytics;
  initialHosts: UnifiedHostItem[];
}

function MetricCard({ label, value, subtitle, highlight = false }: { label: string; value: number; subtitle: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-2xs ${highlight ? "border-amber-400/60 bg-amber-500/10" : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-muted-foreground">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{subtitle}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "ACTIVE"
    ? "bg-emerald-100/90 text-emerald-800 border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
    : status === "SUSPENDED"
      ? "bg-rose-100/90 text-rose-800 border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
      : "bg-amber-100/90 text-amber-900 border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold shadow-2xs ${classes}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export function HostPhase1Dashboard({ analytics, initialHosts }: HostPhase1DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "listingsCount" | "bookingsCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const newHosts = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    return initialHosts.filter((host) => new Date(host.createdAt) >= threshold).length;
  }, [initialHosts]);
  const totalListings = useMemo(() => initialHosts.reduce((sum, host) => sum + host.listingsCount, 0), [initialHosts]);
  const totalBookings = useMemo(() => initialHosts.reduce((sum, host) => sum + host.bookingsCount, 0), [initialHosts]);

  const filteredHosts = useMemo(() => initialHosts
    .filter((host) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [host.name, host.email, host.phone, host.id].some((value) => value?.toLowerCase().includes(query));
      return matchesSearch && (statusFilter === "ALL" || host.accountStatus === statusFilter);
    })
    .sort((a, b) => {
      const aValue = sortBy === "createdAt" ? new Date(a.createdAt).getTime() : sortBy === "name" ? (a.name || "").toLowerCase() : a[sortBy];
      const bValue = sortBy === "createdAt" ? new Date(b.createdAt).getTime() : sortBy === "name" ? (b.name || "").toLowerCase() : b[sortBy];
      return aValue < bValue ? (sortOrder === "asc" ? -1 : 1) : aValue > bValue ? (sortOrder === "asc" ? 1 : -1) : 0;
    }), [initialHosts, search, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredHosts.length / pageSize));
  const paginatedHosts = filteredHosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const resetPage = () => setCurrentPage(1);

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      <div>
        <h1>Host Management</h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">Overview of platform host accounts, listings, reservations, and account activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="Total Hosts" value={analytics.totalHosts} subtitle="Registered host accounts" highlight />
        <MetricCard label="Active Hosts" value={analytics.activeHosts} subtitle="Normal standing" />
        <MetricCard label="Suspended Hosts" value={analytics.suspendedHosts} subtitle="Disabled accounts" />
        <MetricCard label="New Hosts (30d)" value={newHosts} subtitle="Recent signups" />
        <MetricCard label="Total Listings" value={totalListings} subtitle="Properties managed" />
        <MetricCard label="Total Bookings" value={totalBookings} subtitle="Reservations received" />
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <input value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search host by name, email, phone..." className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-xs text-muted-foreground outline-none transition-all focus:border-[var(--accent)] shadow-2xs" />
            <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
            {search && <button type="button" onClick={() => { setSearch(""); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--muted-foreground)]" aria-label="Clear search">×</button>}
          </div>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); resetPage(); }} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs">
            <option value="ALL">All Statuses</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs">
            <option value="createdAt">Joined Date</option><option value="name">Host Name</option><option value="listingsCount">Listings Count</option><option value="bookingsCount">Bookings Count</option>
          </select>
          <button type="button" onClick={() => setSortOrder((order) => order === "asc" ? "desc" : "asc")} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-muted-foreground shadow-2xs hover:bg-[var(--surface-secondary)]">{sortOrder === "asc" ? "↑ ASC" : "↓ DESC"}</button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs md:block"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"><tr><th className="px-4 py-3.5">Host</th><th className="px-4 py-3.5">Email</th><th className="px-4 py-3.5">Phone</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5 text-center">Listings</th><th className="px-4 py-3.5 text-center">Bookings</th><th className="px-4 py-3.5">Joined Date</th><th className="px-4 py-3.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">
        {paginatedHosts.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--muted-foreground)]">No hosts found matching your criteria.</td></tr> : paginatedHosts.map((host) => <tr key={host.id} className="transition-colors hover:bg-[var(--surface-secondary)]"><td className="px-4 py-3.5"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-foreground)]">{(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}</div><div><div className="font-semibold text-muted-foreground">{host.name || "Unnamed Host"}</div><div className="font-mono text-[11px] text-[var(--muted-foreground)]">{host.id}</div></div></div></td><td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)]">{host.email || "N/A"}</td><td className="px-4 py-3.5 text-[var(--muted-foreground)]">{host.phone || "—"}</td><td className="px-4 py-3.5"><StatusBadge status={host.accountStatus} /></td><td className="px-4 py-3.5 text-center font-semibold">{host.listingsCount}</td><td className="px-4 py-3.5 text-center font-semibold">{host.bookingsCount}</td><td className="px-4 py-3.5 font-mono text-[11px] text-[var(--muted-foreground)]" suppressHydrationWarning>{new Date(host.createdAt).toLocaleDateString("en-US")}</td><td className="px-4 py-3.5 text-right"><a href={`/admin/hosts/${host.id}`} className="inline-block rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs transition-all hover:bg-[var(--surface-secondary)]">View Details</a></td></tr>)}
      </tbody></table></div></div>

      <div className="flex flex-col gap-3 md:hidden">{paginatedHosts.map((host) => <a key={host.id} href={`/admin/hosts/${host.id}`} className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-foreground)]">{(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}</div><div><h3 className="text-xs font-semibold text-muted-foreground">{host.name || "Unnamed Host"}</h3><p className="font-mono text-[11px] text-[var(--muted-foreground)]">{host.email || "No email"}</p></div></div><StatusBadge status={host.accountStatus} /></div><div className="grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-2 text-xs"><span>Listings: <b>{host.listingsCount}</b></span><span>Bookings: <b>{host.bookingsCount}</b></span><span suppressHydrationWarning>Joined: <b>{new Date(host.createdAt).toLocaleDateString("en-US")}</b></span></div></a>)}</div>

      <div className="flex flex-col items-center justify-between gap-4 pt-2 text-xs text-[var(--muted-foreground)] sm:flex-row"><div>Showing {filteredHosts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredHosts.length)} of {filteredHosts.length} hosts</div><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="font-semibold">Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>
    </div>
  );
}
