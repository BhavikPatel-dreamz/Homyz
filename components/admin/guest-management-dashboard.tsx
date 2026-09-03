"use client";

import React, { useState, useMemo } from "react";
import { AdminPagination } from "./admin-pagination";
import type { GuestAnalyticsData, GuestTableItem } from "@/services/admin.service";

interface GuestDashboardProps {
  analytics: GuestAnalyticsData;
  initialGuests: GuestTableItem[];
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
      <p className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-muted-foreground">
        {value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
    </div>
  );
}

export function GuestManagementDashboard({
  analytics,
  initialGuests,
}: GuestDashboardProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "totalSpending" | "bookingsCount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredGuests = useMemo(() => {
    return initialGuests
      .filter((guest) => {
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = guest.name?.toLowerCase().includes(q);
          const matchEmail = guest.email?.toLowerCase().includes(q);
          const matchPhone = guest.phone?.toLowerCase().includes(q);
          const matchId = guest.id.toLowerCase().includes(q);
          if (!matchName && !matchEmail && !matchPhone && !matchId) return false;
        }

        if (statusFilter !== "ALL") {
          if (statusFilter === "ACTIVE" && guest.status !== "ACTIVE") return false;
          if (statusFilter === "SUSPENDED" && guest.status !== "SUSPENDED") return false;
        }

        return true;
      })
      .sort((a, b) => {
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
  }, [initialGuests, search, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredGuests.length / pageSize) || 1;
  const paginatedGuests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGuests.slice(start, start + pageSize);
  }, [filteredGuests, currentPage, pageSize]);

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Page Title & Subtitle */}
      <div>
        <h1>
          Guest Management
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Overview of platform guest accounts, reservations, and spending activity.
        </p>
      </div>

      {/* KPI Metric Cards (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Guests" value={analytics.totalGuests} subtitle="Registered guests" highlight />
        <MetricCard label="Active Guests" value={analytics.activeGuests} subtitle="Normal standing" />
        <MetricCard label="Suspended Guests" value={analytics.suspendedGuests} subtitle="Disabled accounts" />
        <MetricCard label="New Guests (30d)" value={analytics.newGuests} subtitle="Recent signups" />
        <MetricCard label="Total Bookings" value={analytics.totalBookings} subtitle="Reservations made" />
        <MetricCard label="Total Spending" value={`$${(analytics.totalSpending / 100).toFixed(0)}`} subtitle="Gross revenue" />
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
              placeholder="Search guest by name, email, phone..."
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
            <option value="name">Guest Name</option>
            <option value="totalSpending">Total Spending</option>
            <option value="bookingsCount">Bookings Count</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors shadow-2xs"
          >
            {sortOrder === "asc" ? "↑ ASC" : "↓ DESC"}
          </button>
        </div>
      </div>

      {/* Guest Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Guest</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4">Phone</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-center">Bookings</th>
              <th className="py-3.5 px-4 text-right">Total Spending</th>
              <th className="py-3.5 px-4">Joined Date</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {paginatedGuests.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--muted-foreground)]">
                  No guests found matching your criteria.
                </td>
              </tr>
            ) : (
              paginatedGuests.map((guest) => (
                <tr key={guest.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                  {/* Guest Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center text-xs">
                        {(guest.name?.[0] || guest.email?.[0] || "G").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-muted-foreground">
                          {guest.name || "Unnamed Guest"}
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{guest.id}</div>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]">
                    {guest.email || "N/A"}
                  </td>

                  {/* Phone */}
                  <td className="py-3.5 px-4 text-[var(--muted-foreground)]">
                    {guest.phone || "—"}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {guest.status === "ACTIVE" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100/90 text-rose-800 border border-rose-300/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs">
                        Suspended
                      </span>
                    )}
                  </td>

                  {/* Bookings Count */}
                  <td className="py-3.5 px-4 text-center font-bold text-muted-foreground">
                    {guest.bookingsCount}
                  </td>

                  {/* Total Spending */}
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    ${(guest.totalSpending / 100).toFixed(2)}
                  </td>

                  {/* Joined Date */}
                  <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                    {new Date(guest.createdAt).toLocaleDateString("en-US")}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <a
                      href={`/admin/guests/${guest.id}`}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-1.5 text-xs text-muted-foreground font-bold transition-all inline-block shadow-2xs"
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

      {/* Guest Mobile Card List View */}
      <div className="md:hidden flex flex-col gap-3">
        {paginatedGuests.map((guest) => (
          <div key={guest.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold flex items-center justify-center text-xs">
                  {(guest.name?.[0] || guest.email?.[0] || "G").toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-muted-foreground text-xs">{guest.name || "Unnamed Guest"}</h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{guest.email}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                guest.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
              }`}>
                {guest.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--muted-foreground)]">Bookings:</span> <span className="font-bold text-muted-foreground">{guest.bookingsCount}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Spending:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">${(guest.totalSpending / 100).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Joined:</span> <span className="font-bold text-muted-foreground" suppressHydrationWarning>{new Date(guest.createdAt).toLocaleDateString("en-US")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted-foreground)] pt-2">
        <div>
          Showing {filteredGuests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
          {Math.min(currentPage * pageSize, filteredGuests.length)} of {filteredGuests.length} guests
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Previous
          </button>
          <span className="font-bold text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
