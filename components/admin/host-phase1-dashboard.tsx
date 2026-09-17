"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminPagination } from "./admin-pagination";
import type { UnifiedHostAnalytics, UnifiedHostItem } from "@/services/admin.service";

export interface HostPhase1DashboardProps {
  analytics: UnifiedHostAnalytics;
  initialHosts: UnifiedHostItem[];
  initialSearch?: string;
  initialStatus?: string;
  initialSortBy?: string;
  initialSortOrder?: string;
  initialPage?: number;
  initialPageSize?: number;
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

export function HostPhase1Dashboard({
  analytics,
  initialHosts,
  initialSearch = "",
  initialStatus = "ALL",
  initialSortBy = "createdAt",
  initialSortOrder = "desc",
  initialPage = 1,
  initialPageSize = 10,
}: HostPhase1DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL search params with fallback to server-rendered props
  const urlSearch = searchParams?.get("search") ?? initialSearch;
  const urlStatus = (searchParams?.get("status") ?? initialStatus).toUpperCase();
  const rawSort = searchParams?.get("sort") ?? initialSortBy;
  const urlSort = ["createdAt", "name", "listingsCount", "bookingsCount"].includes(rawSort)
    ? (rawSort as "createdAt" | "name" | "listingsCount" | "bookingsCount")
    : "createdAt";
  const urlOrder = ((searchParams?.get("order") ?? initialSortOrder).toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
  const urlPage = Number(searchParams?.get("page")) || initialPage;
  const urlPageSize = Number(searchParams?.get("pageSize")) || initialPageSize;

  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "listingsCount" | "bookingsCount">(urlSort);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(urlOrder);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);

  // Debounced URL sync helper
  const isInitialMount = useRef(true);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const syncUrl = useCallback(
    (newSearch: string, newStatus: string, newSort: string, newOrder: string, newPage: number, newPageSize: number) => {
      const params = new URLSearchParams();
      if (newSearch.trim()) params.set("search", newSearch.trim());
      if (newStatus && newStatus !== "ALL") params.set("status", newStatus);
      if (newSort && newSort !== "createdAt") params.set("sort", newSort);
      if (newOrder && newOrder !== "desc") params.set("order", newOrder);
      if (newPage > 1) params.set("page", String(newPage));
      if (newPageSize !== 10) params.set("pageSize", String(newPageSize));

      const queryStr = params.toString();
      const targetUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      window.history.replaceState(null, "", targetUrl);
    },
    [pathname]
  );

  // Sync state if user navigates back/forward with browser buttons
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const s = searchParams?.get("search") ?? "";
    const st = (searchParams?.get("status") ?? "ALL").toUpperCase();
    const rawSo = searchParams?.get("sort") ?? "createdAt";
    const so = ["createdAt", "name", "listingsCount", "bookingsCount"].includes(rawSo)
      ? (rawSo as "createdAt" | "name" | "listingsCount" | "bookingsCount")
      : "createdAt";
    const ord = ((searchParams?.get("order") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
    const p = Number(searchParams?.get("page")) || 1;
    const ps = Number(searchParams?.get("pageSize")) || 10;

    setSearch((prev) => (prev !== s ? s : prev));
    setStatusFilter((prev) => (prev !== st ? st : prev));
    setSortBy((prev) => (prev !== so ? so : prev));
    setSortOrder((prev) => (prev !== ord ? ord : prev));
    setCurrentPage((prev) => (prev !== p ? p : prev));
    setPageSize((prev) => (prev !== ps ? ps : prev));
  }, [searchParams]);

  // Handlers with URL synchronization
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      syncUrl(val, statusFilter, sortBy, sortOrder, 1, pageSize);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearch("");
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl("", statusFilter, sortBy, sortOrder, 1, pageSize);
  };

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    syncUrl(search, newStatus, sortBy, sortOrder, 1, pageSize);
  };

  const handleSortChange = (newSort: "createdAt" | "name" | "listingsCount" | "bookingsCount") => {
    setSortBy(newSort);
    setCurrentPage(1);
    syncUrl(search, statusFilter, newSort, sortOrder, 1, pageSize);
  };

  const handleSortOrderToggle = () => {
    const nextOrder = sortOrder === "asc" ? "desc" : "asc";
    setSortOrder(nextOrder);
    syncUrl(search, statusFilter, sortBy, nextOrder, currentPage, pageSize);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    syncUrl(search, statusFilter, sortBy, sortOrder, newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    syncUrl(search, statusFilter, sortBy, sortOrder, 1, newSize);
  };

  // Derived KPI metrics
  const hostMetrics = useMemo(() => {
    const total = initialHosts.length;
    const active = initialHosts.filter((h) => h.accountStatus === "ACTIVE").length;
    const suspended = initialHosts.filter((h) => h.accountStatus === "SUSPENDED").length;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const new30d = initialHosts.filter((h) => now - new Date(h.createdAt).getTime() <= thirtyDays).length;
    const totalListings = initialHosts.reduce((sum, h) => sum + h.listingsCount, 0);
    const totalBookings = initialHosts.reduce((sum, h) => sum + h.bookingsCount, 0);

    return {
      totalHosts: analytics.totalHosts || total,
      activeHosts: analytics.activeHosts || active,
      suspendedHosts: analytics.suspendedHosts || suspended,
      newHosts: analytics.newHosts || new30d,
      totalListings: analytics.totalListings ?? totalListings,
      totalBookings: analytics.totalBookings ?? totalBookings,
    };
  }, [initialHosts, analytics]);

  // Filtered and sorted hosts
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
          if (statusFilter === "ACTIVE" && host.accountStatus !== "ACTIVE") return false;
          if (statusFilter === "SUSPENDED" && host.accountStatus !== "SUSPENDED") return false;
          if (statusFilter === "NEW_30D") {
            const now = Date.now();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            if (now - new Date(host.createdAt).getTime() > thirtyDays) return false;
          }
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
  const activePage = Math.min(currentPage, totalPages);
  const paginatedHosts = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return filteredHosts.slice(start, start + pageSize);
  }, [filteredHosts, activePage, pageSize]);

  // Export CSV
  const exportCSV = () => {
    if (filteredHosts.length === 0) return;
    const headers = ["ID", "Name", "Email", "Phone", "Status", "Listings", "Bookings", "Joined Date"];
    const rows = filteredHosts.map((h) => [
      h.id,
      `"${(h.name || "Unnamed Host").replace(/"/g, '""')}"`,
      `"${(h.email || "").replace(/"/g, '""')}"`,
      `"${(h.phone || "").replace(/"/g, '""')}"`,
      h.accountStatus,
      h.listingsCount,
      h.bookingsCount,
      new Date(h.createdAt).toISOString().split("T")[0],
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `homyz_hosts_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-muted-foreground">Host Management</h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Overview of platform host accounts, listings, reservations, and account activity.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          disabled={filteredHosts.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 text-xs font-semibold transition-all shadow-2xs shrink-0 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV ({filteredHosts.length})
        </button>
      </div>

      {/* KPI Metric Cards with Interactive Quick-Filtering */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleStatusFilterChange("ALL")}
          title="Show all registered hosts"
          className={`rounded-2xl border p-4 sm:p-5 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === "ALL"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10 text-muted-foreground"
              : "border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:border-amber-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Hosts</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-muted-foreground">
            {hostMetrics.totalHosts}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Registered hosts</p>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilterChange(statusFilter === "ACTIVE" ? "ALL" : "ACTIVE")}
          title="Filter by active hosts in normal standing"
          className={`rounded-2xl border p-4 sm:p-5 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === "ACTIVE"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10 text-muted-foreground"
              : "border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:border-emerald-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Active Hosts</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
            {hostMetrics.activeHosts}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Normal standing</p>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilterChange(statusFilter === "SUSPENDED" ? "ALL" : "SUSPENDED")}
          title="Filter by suspended host accounts"
          className={`rounded-2xl border p-4 sm:p-5 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === "SUSPENDED"
              ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10 text-muted-foreground"
              : "border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:border-rose-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <p className="text-xs font-semibold text-rose-500">Suspended Hosts</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-rose-500">
            {hostMetrics.suspendedHosts}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Disabled accounts</p>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilterChange(statusFilter === "NEW_30D" ? "ALL" : "NEW_30D")}
          title="Filter hosts registered in the last 30 days"
          className={`rounded-2xl border p-4 sm:p-5 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === "NEW_30D"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10 text-muted-foreground"
              : "border-[var(--border)] bg-[var(--surface)] text-muted-foreground hover:border-amber-500/50 hover:bg-[var(--surface-secondary)]/50"
          }`}
        >
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">New Hosts (30d)</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-muted-foreground">
            {hostMetrics.newHosts}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Recent signups</p>
        </button>

        <Link
          href="/admin/listings"
          title="Open Admin Listings Workspace"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 text-left shadow-2xs transition-all hover:border-amber-500/50 hover:bg-[var(--surface-secondary)]/50 group block cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Listings</p>
            <span className="text-[10px] text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
              View →
            </span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-muted-foreground">
            {hostMetrics.totalListings}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Properties managed</p>
        </Link>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 text-left shadow-2xs">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">Total Bookings</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-muted-foreground">
            {hostMetrics.totalBookings}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Reservations received</p>
        </div>
      </div>

      {/* Controls Bar: Search, Filters & Sorting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search host by name, email, phone, ID..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-9 text-xs text-muted-foreground outline-none focus:border-amber-500 transition-all shadow-2xs"
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
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
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
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Statuses ({hostMetrics.totalHosts})</option>
            <option value="ACTIVE">Active ({hostMetrics.activeHosts})</option>
            <option value="SUSPENDED">Suspended ({hostMetrics.suspendedHosts})</option>
            <option value="NEW_30D">New Hosts (30d) ({hostMetrics.newHosts})</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as any)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs text-muted-foreground outline-none shadow-2xs cursor-pointer"
          >
            <option value="createdAt">Joined Date</option>
            <option value="name">Host Name</option>
            <option value="listingsCount">Listings Count</option>
            <option value="bookingsCount">Bookings Count</option>
          </select>

          <button
            type="button"
            onClick={handleSortOrderToggle}
            title={sortOrder === "asc" ? "Sort Ascending (click for Descending)" : "Sort Descending (click for Ascending)"}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors shadow-2xs cursor-pointer"
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
                  <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                    <p className="text-sm font-semibold text-muted-foreground">No hosts found matching your criteria.</p>
                    {(search || statusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("ALL");
                          setCurrentPage(1);
                          syncUrl("", "ALL", sortBy, sortOrder, 1, pageSize);
                        }}
                        className="mt-3 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedHosts.map((host) => (
                  <tr
                    key={host.id}
                    onClick={() => router.push(`/admin/hosts/${host.id}`)}
                    className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                  >
                    {/* Host Avatar & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold flex items-center justify-center text-xs shrink-0">
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
                      <Link
                        href={`/admin/hosts/${host.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-3.5 py-1.5 text-xs text-muted-foreground font-semibold transition-all inline-block shadow-2xs hover:border-amber-500/50"
                      >
                        View Details →
                      </Link>
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
            <p className="font-semibold text-muted-foreground">No hosts found matching your criteria.</p>
            {(search || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setCurrentPage(1);
                  syncUrl("", "ALL", sortBy, sortOrder, 1, pageSize);
                }}
                className="mt-3 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          paginatedHosts.map((host) => (
            <Link
              key={host.id}
              href={`/admin/hosts/${host.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-3 hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold flex items-center justify-center text-xs shrink-0">
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
            </Link>
          ))
        )}
      </div>

      {/* Admin Pagination */}
      <AdminPagination
        currentPage={activePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredHosts.length}
        itemLabel="hosts"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  );
}
