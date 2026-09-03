"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { Alert } from "../ui";
import { toast } from "@/components/ui/toast";
import { AdminPagination } from "./admin-pagination";

export interface ComplianceMetrics {
  totalActiveHosts: number;
  compliantHosts: number;
  compliancePending: number;
  actionRequired: number;
  nonCompliant: number;
  documentsExpiringSoon: number;
  documentsExpired: number;
  suspendedForCompliance: number;
}

export interface DocumentItem {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  status: string;
  uploadedAt: string;
  expiryDate: string | null;
  daysRemaining: number | null;
  expiryStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY";
}

export interface IssueItem {
  id: string;
  issueType: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "RESOLVED" | "ESCALATED";
  createdById: string;
  createdAt: string;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
}

export interface ComplianceHostRecord {
  id: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  businessName: string | null;
  location: string | null;
  hostUser: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    status: "ACTIVE" | "SUSPENDED" | "INVITATION_PENDING";
  } | null;
  overallStatus: string;
  complianceStatus: string; // COMPLIANT, PENDING, ACTION_REQUIRED, NON_COMPLIANT, SUSPENDED
  highestRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  documents: DocumentItem[];
  issues: IssueItem[];
  openIssuesCount: number;
  criticalIssuesCount: number;
  expiringDocsCount: number;
  expiredDocsCount: number;
  assignedReviewer: { id: string; name: string | null; email: string | null } | null;
  lastReviewedAt: string | null;
  updatedAt: string;
}

export function HostComplianceDashboard() {
  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [records, setRecords] = useState<ComplianceHostRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [complianceStatusFilter, setComplianceStatusFilter] = useState("ALL");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("ALL");
  const [riskLevelFilter, setRiskLevelFilter] = useState("ALL");
  const [hostStatusFilter, setHostStatusFilter] = useState("ALL");

  // UI state
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [pendingTransition, startTransition] = useTransition();

  // Modals & Drawers
  const [selectedRecord, setSelectedRecord] = useState<ComplianceHostRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Action Modals State
  const [reVerifyModalOpen, setReVerifyModalOpen] = useState(false);
  const [reVerifyReason, setReVerifyReason] = useState("");

  const [createIssueModalOpen, setCreateIssueModalOpen] = useState(false);
  const [newIssueType, setNewIssueType] = useState("Business License");
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [newIssueSeverity, setNewIssueSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");

  const [resolveIssueModalOpen, setResolveIssueModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false);
  const [unsuspendRecord, setUnsuspendRecord] = useState<ComplianceHostRecord | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/hosts/compliance/metrics");
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.data);
      }
    } catch (err) {
      console.error("Error fetching compliance metrics:", err);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (search.trim()) params.set("search", search.trim());
      if (complianceStatusFilter !== "ALL") params.set("complianceStatus", complianceStatusFilter);
      if (documentStatusFilter !== "ALL") params.set("documentStatus", documentStatusFilter);
      if (riskLevelFilter !== "ALL") params.set("riskLevel", riskLevelFilter);
      if (hostStatusFilter !== "ALL") params.set("hostStatus", hostStatusFilter);

      const res = await fetch(`/api/v1/admin/hosts/compliance?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch compliance records");

      const json = await res.json();
      const itemsList = Array.isArray(json.data) ? json.data : json.data?.items || [];
      const paginationMeta = json.pagination || json.data?.pagination || { total: 0, totalPages: 1 };

      setRecords(itemsList);
      setTotal(paginationMeta.total || 0);
      setTotalPages(paginationMeta.totalPages || 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, complianceStatusFilter, documentStatusFilter, riskLevelFilter, hostStatusFilter]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Run Expiration Audit
  const handleRunExpirationAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch("/api/v1/admin/hosts/compliance/check-expirations", { method: "POST" });
      if (!res.ok) throw new Error("Failed to run expiration audit");

      const json = await res.json();
      toast.success(`Audit completed: Checked ${json.data.totalChecked} documents. ${json.data.expiredCount} marked expired, ${json.data.warningCount} expiring soon.`);
      fetchMetrics();
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Audit failed");
    } finally {
      setAuditing(false);
    }
  };

  // Re-verification Submission
  const handleRequestReVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !reVerifyReason.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/compliance/${selectedRecord.id}/re-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reVerifyReason.trim() }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || "Failed to request re-verification");
        }

        toast.success(`Re-verification requested for ${selectedRecord.applicantName}. Host notified.`);
        setReVerifyModalOpen(false);
        setReVerifyReason("");
        fetchRecords();
        fetchMetrics();
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  };

  // Create Issue Submission
  const handleCreateComplianceIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !newIssueDesc.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/registration-requests/${selectedRecord.id}/compliance/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueType: newIssueType,
            description: newIssueDesc.trim(),
            severity: newIssueSeverity,
          }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || "Failed to create issue");
        }

        toast.success("Compliance issue created successfully.");
        setCreateIssueModalOpen(false);
        setNewIssueDesc("");
        fetchRecords();
        fetchMetrics();
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  };

  // Resolve Issue Submission
  const handleResolveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueId || !resolutionNotes.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/compliance/issues/${selectedIssueId}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolutionNotes: resolutionNotes.trim() }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || "Failed to resolve issue");
        }

        toast.success("Compliance issue resolved.");
        setResolveIssueModalOpen(false);
        setResolutionNotes("");
        fetchRecords();
        fetchMetrics();
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  };

  // Suspend Host Submission
  const handleSuspendHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !suspendReason.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/compliance/${selectedRecord.id}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: suspendReason.trim() }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error?.message || "Failed to suspend host");
        }

        toast.success(`Host ${selectedRecord.applicantName} SUSPENDED for compliance non-compliance.`);
        setSuspendModalOpen(false);
        setSuspendReason("");
        fetchRecords();
        fetchMetrics();
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  };

  // Unsuspend Host
  const handleUnsuspendHost = (record: ComplianceHostRecord) => {
    setUnsuspendRecord(record);
    setUnsuspendModalOpen(true);
  };

  const confirmUnsuspendHost = async () => {
    if (!unsuspendRecord) return;
    const record = unsuspendRecord;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/compliance/${record.id}/unsuspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Compliance requirements satisfied by admin" }),
        });

        if (!res.ok) throw new Error("Failed to reactivate host");

        toast.success(`Host ${record.applicantName} reactivated.`);
        setUnsuspendModalOpen(false);
        setUnsuspendRecord(null);
        fetchRecords();
        fetchMetrics();
      } catch (err: any) {
        toast.error(err.message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-zinc-900/80 p-6 rounded-2xl border border-[var(--border)] shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <h1>Ongoing Host Compliance & Monitoring</h1>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">
            Continuous compliance tracking for active hosts, document expiration monitoring, re-verification triggers, and enforcement.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunExpirationAudit}
          disabled={auditing}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 self-start md:self-auto"
        >
          {auditing ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              <span>Auditing...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Run Expiration Audit</span>
            </>
          )}
        </button>
      </div>

      {/* METRICS CARDS */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider block">Active Hosts</span>
            <div className="text-2xl font-black text-muted-foreground mt-1">{metrics.totalActiveHosts}</div>
            <span className="text-[9px] text-[var(--muted-foreground)] block truncate">Onboarded hosts</span>
          </div>

          <div className="rounded-2xl border border-emerald-300 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Compliant</span>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-300 mt-1">{metrics.compliantHosts}</div>
            <span className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 block truncate">Fully verified</span>
          </div>

          <div className="rounded-2xl border border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Pending Review</span>
            <div className="text-2xl font-black text-amber-900 dark:text-amber-300 mt-1">{metrics.compliancePending}</div>
            <span className="text-[9px] text-amber-700/80 dark:text-amber-400/80 block truncate">Under review</span>
          </div>

          <div className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Action Required</span>
            <div className="text-2xl font-black text-rose-900 dark:text-rose-300 mt-1">{metrics.actionRequired}</div>
            <span className="text-[9px] text-rose-700/80 dark:text-rose-400/80 block truncate">Attention needed</span>
          </div>

          <div className="rounded-2xl border border-purple-300 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">Non-Compliant</span>
            <div className="text-2xl font-black text-purple-900 dark:text-purple-300 mt-1">{metrics.nonCompliant}</div>
            <span className="text-[9px] text-purple-700/80 dark:text-purple-400/80 block truncate">Violations</span>
          </div>

          <div className="rounded-2xl border border-amber-400 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">Docs Expiring</span>
            <div className="text-2xl font-black text-amber-950 dark:text-amber-200 mt-1">{metrics.documentsExpiringSoon}</div>
            <span className="text-[9px] text-amber-800/80 dark:text-amber-300/80 block truncate">Within 30 days</span>
          </div>

          <div className="rounded-2xl border border-rose-400 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">Docs Expired</span>
            <div className="text-2xl font-black text-rose-950 dark:text-rose-200 mt-1">{metrics.documentsExpired}</div>
            <span className="text-[9px] text-rose-800/80 dark:text-rose-300/80 block truncate">Overdue updates</span>
          </div>

          <div className="rounded-2xl border border-zinc-400 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 p-4 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">Suspended</span>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{metrics.suspendedForCompliance}</div>
            <span className="text-[9px] text-zinc-600 dark:text-zinc-400 block truncate">Blocked hosts</span>
          </div>
        </div>
      )}

      {/* SEARCH & FILTERS TOOLBAR */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Search Host</label>
            <input
              type="text"
              placeholder="Host name, email, ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Compliance Status</label>
            <select
              value={complianceStatusFilter}
              onChange={(e) => {
                setComplianceStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Compliance Statuses</option>
              <option value="COMPLIANT">Compliant</option>
              <option value="PENDING">Pending Review</option>
              <option value="ACTION_REQUIRED">Action Required</option>
              <option value="NON_COMPLIANT">Non-Compliant</option>
              <option value="SUSPENDED">Suspended for Compliance</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Document Status</label>
            <select
              value={documentStatusFilter}
              onChange={(e) => {
                setDocumentStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Documents</option>
              <option value="EXPIRING_SOON">Expiring Soon (30d)</option>
              <option value="EXPIRED">Expired Documents</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Risk Severity</label>
            <select
              value={riskLevelFilter}
              onChange={(e) => {
                setRiskLevelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
              <option value="CRITICAL">Critical Risk</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Host Account Status</label>
            <select
              value={hostStatusFilter}
              onChange={(e) => {
                setHostStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {(search || complianceStatusFilter !== "ALL" || documentStatusFilter !== "ALL" || riskLevelFilter !== "ALL" || hostStatusFilter !== "ALL") && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setComplianceStatusFilter("ALL");
                setDocumentStatusFilter("ALL");
                setRiskLevelFilter("ALL");
                setHostStatusFilter("ALL");
                setPage(1);
              }}
              className="text-xs font-extrabold text-rose-600 hover:underline cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* COMPLIANCE TABLE */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-extrabold uppercase tracking-wider">
                <th className="py-3.5 px-4">Host</th>
                <th className="py-3.5 px-4">Compliance</th>
                <th className="py-3.5 px-4">Documents</th>
                <th className="py-3.5 px-4">Issues</th>
                <th className="py-3.5 px-4">Risk Severity</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                      <span>Loading compliance monitoring data...</span>
                    </div>
                  </td>
                </tr>
              ) : !records || records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                    No matching active host compliance records found.
                  </td>
                </tr>
              ) : (
                records.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                    {/* Host Info */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-muted-foreground">{item.applicantName}</div>
                      <div className="text-[11px] font-mono text-[var(--muted-foreground)]">{item.applicantEmail}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">{item.businessName || "Individual Host"}</div>
                    </td>

                    {/* Compliance Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide inline-block ${
                          item.complianceStatus === "COMPLIANT"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.complianceStatus === "SUSPENDED" || item.complianceStatus === "NON_COMPLIANT"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {item.complianceStatus}
                      </span>
                    </td>

                    {/* Documents Expiry Badge */}
                    <td className="py-3.5 px-4">
                      {item.expiredDocsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 text-[10px] font-black block">
                          🚨 {item.expiredDocsCount} Expired
                        </span>
                      ) : item.expiringDocsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 text-[10px] font-black block">
                          ⏱️ {item.expiringDocsCount} Expiring Soon
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ All Documents Valid ({item.documents.length})
                        </span>
                      )}
                    </td>

                    {/* Compliance Issues */}
                    <td className="py-3.5 px-4">
                      {item.openIssuesCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-bold">
                          {item.openIssuesCount} Open Issue(s)
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--muted-foreground)]">None</span>
                      )}
                    </td>

                    {/* Risk Level */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          item.highestRisk === "CRITICAL"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 animate-pulse"
                            : item.highestRisk === "HIGH"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : item.highestRisk === "MEDIUM"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {item.highestRisk}
                      </span>
                    </td>

                    {/* Host User Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          item.hostUser?.status === "SUSPENDED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {item.hostUser?.status || "ACTIVE"}
                      </span>
                    </td>

                    {/* Actions dropdown / buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecord(item);
                            setDrawerOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-xs font-extrabold cursor-pointer"
                        >
                          View Compliance
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
        />
      </div>

      {/* COMPLIANCE DETAIL DRAWER */}
      {drawerOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[var(--surface)] h-full overflow-y-auto p-6 space-y-6 shadow-2xl border-l border-[var(--border)]">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  Host Compliance Monitoring Profile
                </span>
                <h2 className="text-lg font-black text-muted-foreground">{selectedRecord.applicantName}</h2>
                <p className="text-xs font-mono text-[var(--muted-foreground)]">{selectedRecord.applicantEmail}</p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* QUICK ACTIONS BAR */}
            <div className="flex flex-wrap gap-2 p-3 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setReVerifyModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold cursor-pointer shadow-xs"
              >
                Request Re-Verification
              </button>

              <button
                type="button"
                onClick={() => setCreateIssueModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer shadow-xs"
              >
                Log Compliance Issue
              </button>

              {selectedRecord.hostUser?.status === "SUSPENDED" ? (
                <button
                  type="button"
                  onClick={() => handleUnsuspendHost(selectedRecord)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  Reactivate Host
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSuspendModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer shadow-xs"
                >
                  Suspend Host
                </button>
              )}
            </div>

            {/* DOCUMENTS MONITORING LIST */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-xs text-muted-foreground uppercase tracking-wider">
                Document Expiry & Verification Monitoring
              </h3>
              {selectedRecord.documents.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)] italic">No documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {selectedRecord.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/40 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-muted-foreground block">{doc.documentType}</span>
                        <span className="text-[11px] font-mono text-[var(--muted-foreground)] block">{doc.fileName}</span>
                        {doc.expiryDate && (
                          <span className="text-[10px] text-[var(--muted-foreground)] block mt-0.5">
                            Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        {doc.expiryStatus === "EXPIRED" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 uppercase">
                            EXPIRED
                          </span>
                        ) : doc.expiryStatus === "EXPIRING_SOON" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 uppercase">
                            EXPIRING ({doc.daysRemaining}d)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                            VALID
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COMPLIANCE ISSUES LIST */}
            <div className="space-y-3">
              <h3 className="font-extrabold text-xs text-muted-foreground uppercase tracking-wider">
                Compliance Issues History ({selectedRecord.issues.length})
              </h3>
              {selectedRecord.issues.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)] italic">No compliance issues recorded.</p>
              ) : (
                <div className="space-y-3">
                  {selectedRecord.issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-muted-foreground">{iss.issueType}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              iss.severity === "CRITICAL"
                                ? "bg-purple-100 text-purple-800"
                                : iss.severity === "HIGH"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {iss.severity}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              iss.status === "RESOLVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {iss.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{iss.description}</p>

                      {iss.status !== "RESOLVED" && (
                        <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIssueId(iss.id);
                              setResolveIssueModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] cursor-pointer"
                          >
                            Resolve Issue
                          </button>
                        </div>
                      )}

                      {iss.resolutionNotes && (
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-[10px] text-emerald-900 rounded-lg">
                          <strong>Resolution Notes:</strong> {iss.resolutionNotes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: REQUEST RE-VERIFICATION */}
      {reVerifyModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleRequestReVerification}
            className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] space-y-4 shadow-2xl"
          >
            <h3 className="font-extrabold text-sm text-muted-foreground">Request Host Re-Verification</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              This will set host compliance status to <strong>ACTION_REQUIRED</strong> and notify {selectedRecord.applicantName} to provide updated documentation.
            </p>

            <textarea
              rows={3}
              placeholder="State the reason for re-verification (e.g. Business license expired, address audit)..."
              value={reVerifyReason}
              onChange={(e) => setReVerifyReason(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs p-3 outline-none text-muted-foreground"
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReVerifyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingTransition || !reVerifyReason.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Send Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CREATE COMPLIANCE ISSUE */}
      {createIssueModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateComplianceIssue}
            className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] space-y-4 shadow-2xl"
          >
            <h3 className="font-extrabold text-sm text-muted-foreground">Log Compliance Issue</h3>

            <div>
              <label className="text-xs font-bold text-[var(--muted-foreground)] block mb-1">Issue Type</label>
              <input
                type="text"
                value={newIssueType}
                onChange={(e) => setNewIssueType(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs p-2.5 outline-none text-muted-foreground"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--muted-foreground)] block mb-1">Risk Severity</label>
              <select
                value={newIssueSeverity}
                onChange={(e) => setNewIssueSeverity(e.target.value as any)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs p-2.5 outline-none text-muted-foreground"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--muted-foreground)] block mb-1">Description</label>
              <textarea
                rows={3}
                placeholder="Describe the compliance discrepancy or violation details..."
                value={newIssueDesc}
                onChange={(e) => setNewIssueDesc(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs p-3 outline-none text-muted-foreground"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateIssueModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingTransition || !newIssueDesc.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Create Issue
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: RESOLVE ISSUE */}
      {resolveIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleResolveIssue}
            className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] space-y-4 shadow-2xl"
          >
            <h3 className="font-extrabold text-sm text-muted-foreground">Resolve Compliance Issue</h3>

            <textarea
              rows={3}
              placeholder="Record resolution notes (e.g., Valid renewed document uploaded & verified)..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs p-3 outline-none text-muted-foreground"
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolveIssueModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingTransition || !resolutionNotes.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Confirm Resolution
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: SUSPEND HOST */}
      {suspendModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSuspendHost}
            className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] space-y-4 shadow-2xl"
          >
            <h3 className="font-extrabold text-sm text-rose-600 dark:text-rose-400">⚠️ Suspend Host for Compliance Violations</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              This action will change host account status to <strong>SUSPENDED</strong> and compliance status to <strong>NON_COMPLIANT</strong>. Existing listings and bookings will be preserved.
            </p>

            <textarea
              rows={3}
              placeholder="Mandatory suspension reason (e.g. Unresolved severe license issue)..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs p-3 outline-none text-muted-foreground"
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pendingTransition || !suspendReason.trim()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer shadow-xs disabled:opacity-50"
              >
                Confirm Host Suspension
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: UNSUSPEND / REACTIVATE HOST */}
      {unsuspendModalOpen && unsuspendRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Reactivate Host Account</span>
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to reactivate host <strong className="text-muted-foreground">{unsuspendRecord.applicantName}</strong> ({unsuspendRecord.applicantEmail})? Account status will return to ACTIVE and compliance restrictions will be lifted.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setUnsuspendModalOpen(false);
                  setUnsuspendRecord(null);
                }}
                disabled={pendingTransition}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUnsuspendHost}
                disabled={pendingTransition}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {pendingTransition && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                <span>{pendingTransition ? "Reactivating..." : "Reactivate Host"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
