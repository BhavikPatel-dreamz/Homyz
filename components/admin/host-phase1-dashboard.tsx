"use client";

import React, { useState, useMemo } from "react";
import { AdminPagination } from "./admin-pagination";
import type { HostPhase1Analytics } from "@/services/admin.service";

export interface HostTableItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  isRestricted: boolean;
  verificationStatus: string;
  listingsCount: number;
  bookingsCount: number;
  rating: number;
  createdAt: string | Date;
  lastActive: string | Date;
}

interface HostPhase1DashboardProps {
  analytics: HostPhase1Analytics;
  initialHosts: HostTableItem[];
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
          ? "border-amber-400/60 bg-amber-500/10 text-[var(--foreground)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
      }`}
    >
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function HostPhase1Dashboard({
  analytics,
  initialHosts,
}: HostPhase1DashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "listingsCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredHosts = useMemo(() => {
    return initialHosts.filter((host) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = host.name?.toLowerCase().includes(q);
        const matchEmail = host.email?.toLowerCase().includes(q);
        const matchPhone = host.phone?.toLowerCase().includes(q);
        const matchId = host.id.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
      }

      if (statusFilter !== "ALL") {
        if (statusFilter === "ACTIVE" && host.status !== "ACTIVE") return false;
        if (statusFilter === "SUSPENDED" && host.status !== "SUSPENDED") return false;
      }

      if (verificationFilter !== "ALL") {
        if (verificationFilter === "APPROVED" && host.verificationStatus !== "APPROVED") return false;
        if (verificationFilter === "UNVERIFIED" && host.verificationStatus !== "UNVERIFIED") return false;
      }

      if (dateFilter !== "ALL") {
        const created = new Date(host.createdAt).getTime();
        const now = new Date().getTime();
        if (dateFilter === "LAST_30_DAYS" && now - created > 30 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === "LAST_90_DAYS" && now - created > 90 * 24 * 60 * 60 * 1000) return false;
        if (dateFilter === "THIS_YEAR") {
          const currentYear = new Date().getFullYear();
          if (new Date(host.createdAt).getFullYear() !== currentYear) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let valA: string | number | Date = a[sortBy] ?? 0;
      let valB: string | number | Date = b[sortBy] ?? 0;

      if (sortBy === "createdAt") {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortBy === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [initialHosts, search, statusFilter, verificationFilter, dateFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredHosts.length / pageSize) || 1;
  const paginatedHosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHosts.slice(start, start + pageSize);
  }, [filteredHosts, currentPage, pageSize]);

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Top Title Section */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Host Management
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Overview of registered platform hosts, property counts, and active status.
        </p>
      </div>

      {/* Metric KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Hosts" value={analytics.totalHosts} subtitle="Registered hosts" highlight />
        <MetricCard label="Active Hosts" value={analytics.activeHosts} subtitle="Verified & active" />
        <MetricCard label="Pending / Unverified" value={analytics.pendingUnverifiedHosts} subtitle="Awaiting verification" />
        <MetricCard label="Suspended / Inactive" value={analytics.suspendedHosts} subtitle="Disabled accounts" />
        <MetricCard label="Active Listing Hosts" value={analytics.hostsWithActiveListings} subtitle="Published properties" />
      </div>

      {/* Controls Bar: Search & Filters */}
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
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
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
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Verification Status Filter */}
          <select
            value={verificationFilter}
            onChange={(e) => {
              setVerificationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">All Verification</option>
            <option value="APPROVED">Approved</option>
            <option value="UNVERIFIED">Unverified</option>
          </select>

          {/* Date Range Filter */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="ALL">All Time</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="LAST_90_DAYS">Last 90 Days</option>
            <option value="THIS_YEAR">This Year</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-[var(--foreground)] outline-none shadow-2xs"
          >
            <option value="createdAt">Joined Date</option>
            <option value="name">Host Name</option>
            <option value="listingsCount">Listings Count</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors shadow-2xs"
          >
            {sortOrder === "asc" ? "↑ ASC" : "↓ DESC"}
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Host Name</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4">Phone</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Verification</th>
              <th className="py-3.5 px-4 text-center">Listings</th>
              <th className="py-3.5 px-4 text-center">Reservations</th>
              <th className="py-3.5 px-4 text-center">Rating</th>
              <th className="py-3.5 px-4">Joined Date</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {paginatedHosts.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-[var(--muted-foreground)]">
                  No hosts found matching your criteria.
                </td>
              </tr>
            ) : (
              paginatedHosts.map((host) => (
                <tr key={host.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                  {/* Host Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center text-xs">
                        {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">
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

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {host.status === "ACTIVE" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs">
                        Suspended
                      </span>
                    )}
                  </td>

                  {/* Verification Status */}
                  <td className="py-3.5 px-4">
                    {host.verificationStatus === "APPROVED" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100/90 text-sky-800 border border-sky-300/80 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60 shadow-2xs">
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 shadow-2xs">
                        Unverified
                      </span>
                    )}
                  </td>

                  {/* Number of Listings */}
                  <td className="py-3.5 px-4 text-center font-bold text-[var(--foreground)]">
                    {host.listingsCount}
                  </td>

                  {/* Number of Reservations */}
                  <td className="py-3.5 px-4 text-center font-bold text-[var(--foreground)]">
                    {host.bookingsCount}
                  </td>

                  {/* Rating */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-extrabold text-amber-700 dark:text-amber-300 inline-flex items-center justify-center gap-1 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-800/60 text-[11px] shadow-2xs">
                      ★ {host.rating}
                    </span>
                  </td>

                  {/* Joined Date */}
                  <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                    {new Date(host.createdAt).toLocaleDateString("en-US")}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <a
                      href={`/admin/hosts/${host.id}`}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-1.5 text-xs text-[var(--foreground)] font-bold transition-all inline-block shadow-2xs"
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

      {/* Mobile Card List View */}
      <div className="md:hidden flex flex-col gap-3">
        {paginatedHosts.map((host) => (
          <div key={host.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center text-xs">
                  {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--foreground)] text-xs">{host.name || "Unnamed Host"}</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{host.email}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                host.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
              }`}>
                {host.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--muted-foreground)]">Listings:</span> <span className="font-bold text-[var(--foreground)]">{host.listingsCount}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Reservations:</span> <span className="font-bold text-[var(--foreground)]">{host.bookingsCount}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Joined:</span> <span className="font-bold text-[var(--foreground)]" suppressHydrationWarning>{new Date(host.createdAt).toLocaleDateString("en-US")}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Rating:</span> <span className="font-bold text-amber-600 dark:text-amber-400">★ {host.rating}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted-foreground)] pt-2">
        <div>
          Showing {filteredHosts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, filteredHosts.length)} of {filteredHosts.length} hosts
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Previous
          </button>
          <span className="font-bold text-[var(--foreground)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
