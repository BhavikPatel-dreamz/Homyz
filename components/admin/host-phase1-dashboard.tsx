"use client";

import React, { useMemo, useState } from "react";
import { AdminPagination } from "./admin-pagination";
import type { UnifiedHostAnalytics, UnifiedHostItem } from "@/services/admin.service";

export interface HostPhase1DashboardProps {
  analytics: UnifiedHostAnalytics;
  initialHosts: UnifiedHostItem[];
}

function MetricCard({
  label,
  value,
  subtitle,
  highlight = false,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-2xs transition-all ${
        highlight
          ? "border-amber-400/60 bg-amber-500/10 text-muted-foreground"
          : "border-[var(--border)] bg-[var(--surface)] text-muted-foreground"
      }`}
    >
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-muted-foreground">
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSuspended = status === "SUSPENDED";
  return isSuspended ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs">
      Suspended
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs">
      Active
    </span>
  );
}

export function HostPhase1Dashboard({ analytics, initialHosts }: HostPhase1DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "listingsCount" | "bookingsCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const newHosts = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    return initialHosts.filter((host) => new Date(host.createdAt) >= threshold).length;
  }, [initialHosts]);

  const totalListings = useMemo(
    () => initialHosts.reduce((sum, host) => sum + host.listingsCount, 0),
    [initialHosts]
  );

  const totalBookings = useMemo(
    () => initialHosts.reduce((sum, host) => sum + host.bookingsCount, 0),
    [initialHosts]
  );

  const filteredHosts = useMemo(() => {
    return initialHosts
      .filter((host) => {
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = host.name?.toLowerCase().includes(q);
          const matchEmail = host.email?.toLowerCase().includes(q);
          const matchPhone = host.phone?.toLowerCase().includes(q);
          const matchId = host.id.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
        }

        if (statusFilter !== "ALL") {
          if (statusFilter === "ACTIVE" && host.accountStatus === "SUSPENDED") return false;
          if (statusFilter === "SUSPENDED" && host.accountStatus !== "SUSPENDED") return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "createdAt") {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
        }
        if (sortBy === "name") {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          if (nameA < nameB) return sortOrder === "asc" ? -1 : 1;
          if (nameA > nameB) return sortOrder === "asc" ? 1 : -1;
          return 0;
        }
        const valA = Number(a[sortBy] ?? 0);
        const valB = Number(b[sortBy] ?? 0);
        return sortOrder === "asc" ? valA - valB : valB - valA;
      });
  }, [initialHosts, search, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredHosts.length / pageSize));
  const paginatedHosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHosts.slice(start, start + pageSize);
  }, [filteredHosts, currentPage, pageSize]);

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Page Title & Subtitle */}
      <div>
        <h1>Host Management</h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Overview of platform host accounts, listings, reservations, and account activity.
        </p>
      </div>

      {/* KPI Metric Cards (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Hosts" value={analytics.totalHosts} subtitle="Registered hosts" highlight />
        <MetricCard label="Active Hosts" value={analytics.activeHosts} subtitle="Normal standing" />
        <MetricCard label="Suspended Hosts" value={analytics.suspendedHosts} subtitle="Disabled accounts" />
        <MetricCard label="New Hosts (30d)" value={newHosts} subtitle="Recent signups" />
        <MetricCard label="Total Listings" value={totalListings} subtitle="Properties managed" />
        <MetricCard label="Total Bookings" value={totalBookings} subtitle="Reservations received" />
      </div>

      {/* Controls Bar: Search, Filters & Sorting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search host by name, email, phone..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-xs text-muted-foreground outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs"
          >
            <option value="createdAt">Joined Date</option>
            <option value="name">Host Name</option>
            <option value="listingsCount">Listings Count</option>
            <option value="bookingsCount">Bookings Count</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors shadow-2xs"
          >
            {sortOrder === "asc" ? "↑ ASC" : "↓ DESC"}
          </button>
        </div>
      </div>

      {/* Host Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Host</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Listings</th>
                <th className="py-3.5 px-4 text-center">Bookings</th>
                <th className="py-3.5 px-4">Joined Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {paginatedHosts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--muted-foreground)]">
                    No hosts found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedHosts.map((host) => (
                  <tr key={host.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    {/* Host Avatar & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold flex items-center justify-center text-xs">
                          {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-muted-foreground">
                            {host.name || "Unnamed Host"}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{host.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]">
                      {host.email || "N/A"}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)]">
                      {host.phone || "—"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={host.accountStatus} />
                    </td>

                    {/* Listings Count */}
                    <td className="py-3.5 px-4 text-center font-semibold text-muted-foreground">
                      {host.listingsCount}
                    </td>

                    {/* Bookings Count */}
                    <td className="py-3.5 px-4 text-center font-semibold text-muted-foreground">
                      {host.bookingsCount}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                      {new Date(host.createdAt).toLocaleDateString("en-US")}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`/admin/hosts/${host.id}`}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-1.5 text-xs text-muted-foreground font-semibold transition-all inline-block shadow-2xs"
                      >
                        View Details
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Host Mobile Card List View */}
      <div className="md:hidden flex flex-col gap-3">
        {paginatedHosts.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted-foreground)]">
            No hosts found matching your criteria.
          </div>
        ) : (
          paginatedHosts.map((host) => (
            <a
              key={host.id}
              href={`/admin/hosts/${host.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-3 hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold flex items-center justify-center text-xs">
                    {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      {host.name || "Unnamed Host"}
                    </h3>
                    <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
                      {host.email || "No email"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={host.accountStatus} />
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-subtle)] pt-2 text-xs">
                <div>
                  <span className="text-[var(--muted-foreground)] text-[11px] block">Listings</span>
                  <span className="font-semibold text-muted-foreground">{host.listingsCount}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] text-[11px] block">Bookings</span>
                  <span className="font-semibold text-muted-foreground">{host.bookingsCount}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] text-[11px] block">Joined</span>
                  <span className="font-semibold text-muted-foreground" suppressHydrationWarning>
                    {new Date(host.createdAt).toLocaleDateString("en-US")}
                  </span>
                </div>
              </div>
            </a>
          ))
        )}
      </div>

      {/* Admin Pagination */}
      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredHosts.length}
        itemLabel="hosts"
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
