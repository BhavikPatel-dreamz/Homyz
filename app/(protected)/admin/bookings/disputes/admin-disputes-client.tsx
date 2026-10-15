"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { DisputeSummaryData } from "@/services/dispute.service";

interface DisputeItem {
  id: string;
  caseReference: string;
  category: string;
  status: string;
  disputeWorkflowStatus: string;
  severity: string;
  description: string;
  reporterRole: string;
  reportedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  booking: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  } | null;
  listing: {
    id: string;
    title: string;
    city: string | null;
    host: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  } | null;
  internalNotesCount: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
  assignedAdmin: { id: string; email: string } | null;
}

interface AdminDisputesClientProps {
  initialSummary: DisputeSummaryData;
  initialDisputes: DisputeItem[];
  initialPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialTab?: string;
  initialSearch?: string;
  initialCategory?: string;
  initialSeverity?: string;
  initialAssignedAdminEmail?: string;
  initialStartDate?: string;
  initialEndDate?: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  try {
    return dateFormatter.format(new Date(val));
  } catch {
    return String(val);
  }
}

export function AdminDisputesClient({
  initialSummary,
  initialDisputes,
  initialPagination,
  initialTab = "all",
  initialSearch = "",
  initialCategory = "ALL",
  initialSeverity = "ALL",
  initialAssignedAdminEmail = "",
  initialStartDate = "",
  initialEndDate = "",
}: AdminDisputesClientProps) {
  const [summary, setSummary] = useState<DisputeSummaryData>(initialSummary);
  const [disputes, setDisputes] = useState<DisputeItem[]>(initialDisputes);
  const [pagination, setPagination] = useState(initialPagination);
  const [pageSize, setPageSize] = useState(initialPagination.limit);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [filterCategory, setFilterCategory] = useState<string>(initialCategory);
  const [filterSeverity, setFilterSeverity] = useState<string>(initialSeverity);
  const [assignedAdminEmail, setAssignedAdminEmail] = useState(initialAssignedAdminEmail);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const hasLoadedInitialData = useRef(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createBookingId, setCreateBookingId] = useState("");
  const [createCategory, setCreateCategory] = useState("PROPERTY_CONDITION");
  const [createSeverity, setCreateSeverity] = useState("MEDIUM");
  const [createDescription, setCreateDescription] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    const res = await fetch("/api/v1/admin/bookings/disputes/summary");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || "Failed to refresh dispute summary");
    setSummary(json.data ?? json);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchDisputes = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set("page", String(pageToLoad));
        sp.set("limit", String(pageSize));
        if (activeTab && activeTab !== "all") sp.set("tab", activeTab);
        if (debouncedSearch.trim()) sp.set("search", debouncedSearch.trim());
        if (filterCategory !== "ALL") sp.set("category", filterCategory);
        if (filterSeverity !== "ALL") sp.set("severity", filterSeverity);
        if (assignedAdminEmail.trim()) sp.set("assignedAdminEmail", assignedAdminEmail.trim());
        if (startDate) sp.set("startDate", startDate);
        if (endDate) sp.set("endDate", endDate);

        const res = await fetch(`/api/v1/admin/bookings/disputes?${sp.toString()}`);
        const json = await res.json();
        const data = json.data ?? json;
        if (!res.ok) throw new Error(data.error?.message || "Failed to load dispute cases");
        setDisputes(data.disputes || []);
        if (data.pagination) setPagination(data.pagination);
        const nextUrl = `${window.location.pathname}${sp.toString() ? `?${sp.toString()}` : ""}`;
        window.history.replaceState(window.history.state, "", nextUrl);
      } catch (err) {
        console.error("[AdminDisputesClient] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, debouncedSearch, filterCategory, filterSeverity, assignedAdminEmail, startDate, endDate, pageSize],
  );

  useEffect(() => {
    if (!hasLoadedInitialData.current) {
      hasLoadedInitialData.current = true;
      return;
    }
    fetchDisputes(1);
  }, [fetchDisputes]);

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createBookingId.trim()) {
      setCreateError("Booking ID is required.");
      return;
    }
    if (!createDescription.trim()) {
      setCreateError("Description is required.");
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/v1/admin/bookings/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: createBookingId.trim(),
          category: createCategory,
          severity: createSeverity,
          description: createDescription.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create dispute case");

      setCreateModalOpen(false);
      setCreateBookingId("");
      setCreateDescription("");
      await Promise.all([fetchDisputes(1), fetchSummary()]);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create dispute case");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const tabs = [
    { id: "all", label: "All Cases", count: pagination.total },
    { id: "new", label: "New Cases", count: summary.newCases },
    { id: "open", label: "Open & Investigating", count: summary.openCases },
    { id: "resolved", label: "Resolved", count: summary.resolvedCases },
    { id: "attention", label: "Requires Attention", count: summary.attentionCases },
  ];

  const clearFilters = () => {
    setActiveTab("all");
    setSearchInput("");
    setDebouncedSearch("");
    setFilterCategory("ALL");
    setFilterSeverity("ALL");
    setAssignedAdminEmail("");
    setStartDate("");
    setEndDate("");
  };

  const exportCSV = () => {
    if (disputes.length === 0) return;
    const headers = [
      "Case Reference",
      "Booking ID",
      "Property Title",
      "Category",
      "Severity",
      "Reporter Role",
      "Reported By",
      "Status",
      "Date Filed",
    ];
    const rows = disputes.map((d) => [
      `"${d.caseReference}"`,
      `"${d.booking?.id || ""}"`,
      `"${(d.listing?.title || "").replace(/"/g, '""')}"`,
      `"${d.category}"`,
      `"${d.severity}"`,
      `"${d.reporterRole}"`,
      `"${d.reportedBy?.name || ""}"`,
      `"${d.status}"`,
      `"${formatDate(d.createdAt)}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_disputes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-20">
      {/* 12.2 — Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Disputes & Complaints
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Review booking-related complaints, investigate issues, and track resolutions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/bookings/refunds"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Refunds</span>
          </Link>
          <Link
            href="/admin/bookings/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>Payments</span>
          </Link>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all"
          >
            <span>+ File New Case</span>
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={exportCSV}
            disabled={disputes.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-foreground px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 12.2 — 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Total Cases
          </p>
          <p className="text-lg font-bold text-foreground mt-1">{summary.totalCases}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">All time</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            New Cases
          </p>
          <p className="text-lg font-bold text-amber-600 mt-1">{summary.newCases}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Unreviewed</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Open Cases
          </p>
          <p className="text-lg font-bold text-sky-600 mt-1">{summary.openCases}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Active</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Investigating
          </p>
          <p className="text-lg font-bold text-blue-600 mt-1">{summary.underInvestigationCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Assigned</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Awaiting Info
          </p>
          <p className="text-lg font-bold text-purple-600 mt-1">{summary.awaitingInfoCount}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Party pending</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Resolved
          </p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{summary.resolvedCases}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Settled</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Closed
          </p>
          <p className="text-lg font-bold text-zinc-600 mt-1">{summary.closedCases}</p>
          <p className="text-2xs text-[var(--muted-foreground)] mt-0.5">Completed</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 shadow-2xs">
          <p className="text-2xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            Attention
          </p>
          <p className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.attentionCases}</p>
          <p className="text-2xs text-rose-600/80 mt-0.5">Critical / Stale</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-2xs"
                  : "text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--surface-secondary)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  isActive
                    ? "bg-black/15 text-[var(--accent-foreground)]"
                    : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <svg className="w-4 h-4 text-[var(--muted-foreground)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by case reference, booking, guest, property..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground text-xs"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground"
          >
            <option value="ALL">All Categories</option>
            <option value="CLEANLINESS">Cleanliness</option>
            <option value="PROPERTY_CONDITION">Property Condition</option>
            <option value="LISTING_ACCURACY">Listing Accuracy</option>
            <option value="SAFETY_HAZARD">Safety Hazard</option>
            <option value="HOST_SERVICE">Host Service</option>
            <option value="OTHER">Other</option>
          </select>

          <input
            type="email"
            value={assignedAdminEmail}
            onChange={(event) => setAssignedAdminEmail(event.target.value)}
            aria-label="Filter by assigned administrator email"
            placeholder="Assigned admin email"
            className="min-w-40 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground placeholder:text-[var(--muted-foreground)]"
          />

          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-label="Cases created on or after"
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-label="Cases created on or before"
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-foreground"
          />

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <button
            type="button"
            onClick={() => fetchDisputes(pagination.page)}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* 12.5 — Disputes Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-secondary)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
              <tr>
                <th className="py-3 px-4">Case Reference</th>
                <th className="py-3 px-4">Booking</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Reported By</th>
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Admin</th>
                <th className="py-3 px-4">Filed</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-muted-foreground">
              {loading && disputes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[var(--muted-foreground)]">
                    Loading dispute cases...
                  </td>
                </tr>
              ) : disputes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[var(--muted-foreground)]">
                    No dispute or complaint cases found.
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--surface-secondary)]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-foreground">
                      <Link href={`/admin/bookings/disputes/${d.id}`} className="hover:underline">
                        {d.caseReference}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-2xs text-foreground">
                      {d.booking ? (
                        <Link href={`/admin/bookings/all?search=${d.booking.id}`} className="hover:underline">
                          {d.booking.id.slice(0, 10)}...
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-foreground block">
                        {d.category.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[160px] truncate font-medium text-foreground">
                      {d.listing?.title || "Property"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-foreground block truncate">
                        {d.reportedBy?.name || "User"}
                      </span>
                      <span className="text-3xs text-[var(--muted-foreground)] block uppercase font-bold">
                        {d.reporterRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-foreground block truncate max-w-32">
                        {d.listing?.host?.name || "—"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold uppercase ${
                          d.severity === "CRITICAL"
                            ? "bg-rose-500/10 text-rose-700 border border-rose-500/20"
                            : d.severity === "HIGH"
                            ? "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {d.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold uppercase ${
                          d.status === "RESOLVED"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : d.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                        }`}
                      >
                        {d.disputeWorkflowStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-2xs text-[var(--muted-foreground)]">
                      {d.assignedAdmin?.email || "Unassigned"}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-2xs text-[var(--muted-foreground)]">
                      {formatDate(d.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-2xs text-[var(--muted-foreground)]">
                      {formatDate(d.updatedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/bookings/disputes/${d.id}`}
                        className="px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-foreground transition-all"
                      >
                        View Case
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/30 text-xs">
          <span>
            Showing {disputes.length} of {pagination.total} cases (Page {pagination.page} of{" "}
            {pagination.totalPages || 1})
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
              Per page
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-foreground"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <button
              onClick={() => fetchDisputes(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              ← Prev
            </button>
            <button
              onClick={() => fetchDisputes(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-foreground disabled:opacity-40 hover:bg-[var(--surface-secondary)] transition-all font-semibold"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Create Dispute Modal with ModalOverlay */}
      {createModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-foreground">File Dispute / Complaint</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateDispute} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Booking ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createBookingId}
                  onChange={(e) => setCreateBookingId(e.target.value)}
                  placeholder="Enter Booking ID (e.g. cm...)"
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Category</label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  >
                    <option value="PROPERTY_CONDITION">Property Condition</option>
                    <option value="CLEANLINESS">Cleanliness</option>
                    <option value="LISTING_ACCURACY">Listing Accuracy</option>
                    <option value="SAFETY_HAZARD">Safety Hazard</option>
                    <option value="HOST_SERVICE">Host Service</option>
                    <option value="OTHER">Other Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">Priority</label>
                  <select
                    value={createSeverity}
                    onChange={(e) => setCreateSeverity(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Complaint Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Provide detailed information regarding the complaint or incident..."
                  className="w-full p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-foreground placeholder:text-[var(--muted-foreground)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-foreground hover:bg-[var(--surface-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-xl bg-[var(--primary)] text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {createSubmitting ? "Submitting..." : "Submit Case"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
