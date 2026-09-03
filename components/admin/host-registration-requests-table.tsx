"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { Alert } from "../ui";
import { AdminPagination } from "./admin-pagination";
import { HostRegistrationWorkspace } from "./host-registration-workspace";

export interface HostRegistrationItem {
  id: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  registrationType: string;
  businessName: string | null;
  propertyCount: number;
  location: string | null;
  notes: string | null;
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  onboardingStage: string;
  assignedReviewer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  assignedAt: Date | string | null;
  reviewedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  reviewStartedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ReviewerItem {
  id: string;
  name: string | null;
  email: string | null;
}

export interface HostRegistrationDetailsData extends HostRegistrationItem {
  hostUser?: {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date | string;
  } | null;
  activityLogs: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: Date | string;
    actorEmail: string | null;
  }>;
}

export function HostRegistrationRequestsTable() {
  // State: List & Filters
  const [items, setItems] = useState<HostRegistrationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    pending: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
  });

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [reviewerFilter, setReviewerFilter] = useState<string>("ALL");
  const [onboardingStageFilter, setOnboardingStageFilter] = useState<string>("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("ALL");

  // Sorting
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "applicantName" | "applicationId">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Reviewers list for assignment
  const [reviewers, setReviewers] = useState<ReviewerItem[]>([]);

  // Drawer / Modal States
  const [selectedItem, setSelectedItem] = useState<HostRegistrationDetailsData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Assign Reviewer Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetAssignItem, setTargetAssignItem] = useState<HostRegistrationItem | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>("");

  // Edit Request Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    applicantName: "",
    applicantEmail: "",
    applicantPhone: "",
    businessName: "",
    registrationType: "INDIVIDUAL",
    propertyCount: 1,
    location: "",
    notes: "",
  });

  // Fetch Data Function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (reviewerFilter !== "ALL") params.set("reviewerId", reviewerFilter);
      if (onboardingStageFilter !== "ALL") params.set("onboardingStage", onboardingStageFilter);
      if (dateRangeFilter !== "ALL") params.set("dateRange", dateRangeFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());

      const res = await fetch(`/api/v1/admin/hosts/registration-requests?${params.toString()}`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || "Failed to fetch host registration requests");
      }

      setItems(json.data.items || []);
      setTotal(json.data.total || 0);
      setTotalPages(json.data.totalPages || 1);
      if (json.data.statusCounts) {
        setStatusCounts(json.data.statusCounts);
      }
    } catch (err: any) {
      setError(err.message || "Error loading registration requests");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, reviewerFilter, onboardingStageFilter, dateRangeFilter, sortBy, sortOrder, page, pageSize]);

  // Fetch Available Reviewers
  const fetchReviewers = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/hosts/registration-requests/reviewers");
      const json = await res.json();
      if (json.success) {
        setReviewers(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load reviewers:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchReviewers();
  }, [fetchReviewers]);

  // Reset pagination when filters change
  const handleFilterChange = (setter: (val: any) => void, val: any) => {
    setter(val);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setReviewerFilter("ALL");
    setOnboardingStageFilter("ALL");
    setDateRangeFilter("ALL");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  const isFilterActive =
    search !== "" ||
    statusFilter !== "ALL" ||
    reviewerFilter !== "ALL" ||
    onboardingStageFilter !== "ALL" ||
    dateRangeFilter !== "ALL" ||
    sortBy !== "createdAt" ||
    sortOrder !== "desc";

  // Open Drawer / Details
  const handleOpenDetails = async (id: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/hosts/registration-requests/${id}`);
      const json = await res.json();
      if (json.success) {
        setSelectedItem(json.data);
      } else {
        setFeedback({ tone: "error", msg: json.error?.message || "Failed to load details" });
        setDrawerOpen(false);
      }
    } catch (err) {
      setFeedback({ tone: "error", msg: "Failed to connect to server" });
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Action: Start Review
  const handleStartReview = async (item: HostRegistrationItem) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/registration-requests/${item.id}/start-review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to start review" });
          return;
        }

        setFeedback({ tone: "success", msg: `Started review for application ${item.applicationId}` });
        fetchData();

        if (selectedItem?.id === item.id) {
          handleOpenDetails(item.id);
        }
      } catch (err) {
        setFeedback({ tone: "error", msg: "Failed to update review status" });
      }
    });
  };

  // Action: Assign Reviewer Modal Open
  const handleOpenAssignModal = (item: HostRegistrationItem) => {
    setTargetAssignItem(item);
    setSelectedReviewerId(item.assignedReviewer?.id || "");
    setAssignModalOpen(true);
  };

  // Action: Submit Assign Reviewer
  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssignItem) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/registration-requests/${targetAssignItem.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewerId: selectedReviewerId || null,
          }),
        });
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to assign reviewer" });
          return;
        }

        setFeedback({
          tone: "success",
          msg: selectedReviewerId
            ? `Assigned reviewer to application ${targetAssignItem.applicationId}`
            : `Unassigned reviewer from application ${targetAssignItem.applicationId}`,
        });

        setAssignModalOpen(false);
        fetchData();

        if (selectedItem?.id === targetAssignItem.id) {
          handleOpenDetails(targetAssignItem.id);
        }
      } catch (err) {
        setFeedback({ tone: "error", msg: "Failed to assign reviewer" });
      }
    });
  };

  // Action: Edit Registration Request Modal Open
  const handleOpenEditModal = (item: HostRegistrationItem) => {
    setEditForm({
      applicantName: item.applicantName || "",
      applicantEmail: item.applicantEmail || "",
      applicantPhone: item.applicantPhone || "",
      businessName: item.businessName || "",
      registrationType: item.registrationType || "INDIVIDUAL",
      propertyCount: item.propertyCount || 1,
      location: item.location || "",
      notes: item.notes || "",
    });
    setEditModalOpen(true);
  };

  // Action: Submit Edit Registration Request
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/registration-requests/${selectedItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to update application" });
          return;
        }

        setFeedback({ tone: "success", msg: `Updated application ${selectedItem.applicationId}` });
        setEditModalOpen(false);
        fetchData();
        handleOpenDetails(selectedItem.id);
      } catch (err) {
        setFeedback({ tone: "error", msg: "Failed to update application info" });
      }
    });
  };

  // Helper function for status badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            In Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Toast Feedback */}
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline ml-4 cursor-pointer">
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1>
              Host Registration Requests
            </h1>
            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-3 py-0.5 text-xs font-black text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
              Phase 1 Intake Queue
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Review, assign, and manage submitted host onboarding registration applications prior to verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Status Summary Cards (5 Status Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => handleFilterChange(setStatusFilter, "ALL")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            statusFilter === "ALL"
              ? "border-[var(--accent)] bg-[var(--surface-secondary)] shadow-2xs ring-1 ring-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
          }`}
        >
          <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider block">All Requests</span>
          <p className="mt-1 text-2xl font-black text-muted-foreground">{statusCounts.total}</p>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange(setStatusFilter, "PENDING")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            statusFilter === "PENDING"
              ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/40 shadow-2xs ring-1 ring-amber-400"
              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
          }`}
        >
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Pending</span>
          <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-300">{statusCounts.pending}</p>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange(setStatusFilter, "IN_REVIEW")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            statusFilter === "IN_REVIEW"
              ? "border-blue-400 bg-blue-50/60 dark:bg-blue-950/40 shadow-2xs ring-1 ring-blue-400"
              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
          }`}
        >
          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">In Review</span>
          <p className="mt-1 text-2xl font-black text-blue-800 dark:text-blue-300">{statusCounts.inReview}</p>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange(setStatusFilter, "APPROVED")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            statusFilter === "APPROVED"
              ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-2xs ring-1 ring-emerald-400"
              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Approved</span>
          <p className="mt-1 text-2xl font-black text-emerald-800 dark:text-emerald-300">{statusCounts.approved}</p>
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange(setStatusFilter, "REJECTED")}
          className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            statusFilter === "REJECTED"
              ? "border-rose-400 bg-rose-50/60 dark:bg-rose-950/40 shadow-2xs ring-1 ring-rose-400"
              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
          }`}
        >
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Rejected</span>
          <p className="mt-1 text-2xl font-black text-rose-800 dark:text-rose-300">{statusCounts.rejected}</p>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search Host Name, Email, Phone, App ID..."
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] pl-10 pr-4 py-2.5 text-xs text-muted-foreground outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5 text-xs text-muted-foreground outline-none"
            >
              <option value="ALL">All Application Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="IN_REVIEW">In Review Only</option>
              <option value="APPROVED">Approved Only</option>
              <option value="REJECTED">Rejected Only</option>
            </select>
          </div>

          {/* Reviewer Filter */}
          <div>
            <select
              value={reviewerFilter}
              onChange={(e) => handleFilterChange(setReviewerFilter, e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5 text-xs text-muted-foreground outline-none"
            >
              <option value="ALL">All Reviewers</option>
              <option value="UNASSIGNED">Unassigned Only</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  Reviewer: {r.name || r.email}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateRangeFilter}
              onChange={(e) => handleFilterChange(setDateRangeFilter, e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5 text-xs text-muted-foreground outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="LAST_90_DAYS">Last 90 Days</option>
              <option value="THIS_YEAR">This Year</option>
            </select>
          </div>
        </div>

        {/* Second Row: Sorting & Clear Filters */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)] flex-wrap text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-[var(--muted-foreground)]">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs text-muted-foreground outline-none"
            >
              <option value="createdAt">Submission Date</option>
              <option value="updatedAt">Last Updated</option>
              <option value="applicantName">Host Name</option>
              <option value="applicationId">Application ID</option>
            </select>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface)] transition-colors cursor-pointer"
            >
              {sortOrder === "desc" ? "↓ Newest / Desc" : "↑ Oldest / Asc"}
            </button>
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 underline cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Requests Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--muted-foreground)] space-y-3">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            <p>Loading registration requests...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600 space-y-2">
            <p className="font-bold">{error}</p>
            <button onClick={fetchData} className="underline text-xs cursor-pointer">
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--muted-foreground)] space-y-2">
            <svg className="w-10 h-10 mx-auto text-[var(--muted-foreground)] opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-bold text-sm text-muted-foreground">No host registration requests found</p>
            <p>{isFilterActive ? "Try adjusting your search query or filters." : "No applications submitted yet."}</p>
            {isFilterActive && (
              <button onClick={handleClearFilters} className="mt-2 text-xs font-bold text-amber-600 underline cursor-pointer">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Application ID</th>
                  <th className="py-3.5 px-4">Host Details</th>
                  <th className="py-3.5 px-4">Type / Category</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned Reviewer</th>
                  <th className="py-3.5 px-4">Submitted Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    {/* Application ID */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-extrabold text-muted-foreground">
                        {item.applicationId}
                      </span>
                    </td>

                    {/* Host Name & Email */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-muted-foreground">{item.applicantName}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{item.applicantEmail}</div>
                      {item.applicantPhone && (
                        <div className="text-[10px] text-[var(--muted-foreground)]">{item.applicantPhone}</div>
                      )}
                    </td>

                    {/* Registration Type & Business Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-muted-foreground">{item.registrationType}</div>
                      {item.businessName && (
                        <div className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[160px]">{item.businessName}</div>
                      )}
                      <div className="text-[10px] text-[var(--muted-foreground)]">{item.propertyCount} Property(ies)</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(item.status)}
                    </td>

                    {/* Assigned Reviewer */}
                    <td className="py-3.5 px-4">
                      {item.assignedReviewer ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-[10px] flex items-center justify-center">
                            {(item.assignedReviewer.name?.[0] || item.assignedReviewer.email?.[0] || "A").toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-muted-foreground text-xs">
                              {item.assignedReviewer.name || item.assignedReviewer.email}
                            </div>
                            <div className="text-[10px] text-[var(--muted-foreground)] font-mono">
                              Assigned {item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : ""}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-[var(--muted-foreground)] border border-dashed border-[var(--border)]">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Submitted Date */}
                    <td className="py-3.5 px-4">
                      <div className="text-[11px] text-muted-foreground font-mono" suppressHydrationWarning>
                        {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono" suppressHydrationWarning>
                        {new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Start Review (if Pending) */}
                        {item.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => handleStartReview(item)}
                            disabled={pendingTransition}
                            className="rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1 text-[11px] font-bold dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50 transition-colors cursor-pointer"
                          >
                            Start Review
                          </button>
                        )}

                        {/* Assign / Reassign Reviewer */}
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(item)}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-colors cursor-pointer"
                        >
                          {item.assignedReviewer ? "Reassign" : "Assign"}
                        </button>

                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(item.id)}
                          className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1 text-[11px] font-extrabold text-[var(--accent-foreground)] shadow-2xs transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && items.length > 0 && (
          <div className="p-3 border-t border-[var(--border-subtle)]">
            <AdminPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="applications"
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        )}
      </div>

      {/* SLIDE-OVER DRAWER FOR APPLICATION DETAILS */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-3xl bg-[var(--surface)] text-muted-foreground h-full shadow-2xl border-l border-[var(--border)] flex flex-col z-10 animate-in slide-in-from-right duration-200 overflow-y-auto p-6">
            {drawerLoading ? (
              <div className="p-12 text-center text-xs text-[var(--muted-foreground)] my-auto space-y-2">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                <p>Loading application review workspace...</p>
              </div>
            ) : selectedItem ? (
              <HostRegistrationWorkspace
                requestId={selectedItem.id}
                onClose={() => {
                  setDrawerOpen(false);
                  fetchData();
                }}
                isDrawer
              />
            ) : null}
          </div>
        </div>
      )}


      {/* ASSIGN REVIEWER MODAL */}
      {assignModalOpen && targetAssignItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-muted-foreground">Assign Reviewer</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Assign an authorized admin reviewer to application <strong className="text-muted-foreground">{targetAssignItem.applicationId}</strong> ({targetAssignItem.applicantName}).
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Select Reviewer</label>
                <select
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                >
                  <option value="">-- Unassigned (No Reviewer) --</option>
                  {reviewers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name ? `${r.name} (${r.email})` : r.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 font-extrabold text-[var(--accent-foreground)] shadow-2xs disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  {pendingTransition && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>Save Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT REQUEST MODAL */}
      {editModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-muted-foreground">Edit Registration Information</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Update application details for {selectedItem.applicationId}.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Applicant Name</label>
                  <input
                    type="text"
                    value={editForm.applicantName}
                    onChange={(e) => setEditForm({ ...editForm, applicantName: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.applicantEmail}
                    onChange={(e) => setEditForm({ ...editForm, applicantEmail: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.applicantPhone}
                    onChange={(e) => setEditForm({ ...editForm, applicantPhone: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Registration Category</label>
                  <select
                    value={editForm.registrationType}
                    onChange={(e) => setEditForm({ ...editForm, registrationType: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                    <option value="BUSINESS">BUSINESS</option>
                    <option value="PROPERTY_MANAGER">PROPERTY_MANAGER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Business Name</label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted-foreground)] font-bold mb-1">Property Count</label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.propertyCount}
                    onChange={(e) => setEditForm({ ...editForm, propertyCount: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--muted-foreground)] font-bold mb-1">Notes / Description</label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-bold text-muted-foreground hover:bg-[var(--surface-secondary)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 font-extrabold text-[var(--accent-foreground)] shadow-2xs disabled:opacity-50 transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  {pendingTransition && (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
