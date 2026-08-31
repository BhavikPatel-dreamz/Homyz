"use client";

import React, { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { Alert } from "../ui";
import { AdminPagination } from "./admin-pagination";
import { HostPermissionsTab } from "./host-permissions-tab";
import type { HostDetailsData } from "@/services/admin.service";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export type HostDetailsDTO = HostDetailsData;

export type HostDetailTabId =
  | "overview"
  | "onboarding"
  | "documents"
  | "compliance"
  | "listings"
  | "bookings"
  | "earnings"
  | "activity"
  | "permissions";

export function HostDetailsView({ initialData }: { initialData: HostDetailsDTO }) {
  const { data: session } = useSession();
  const user = session?.user;
  const userPermissions = user?.permissions || [];
  const isSuper =
    user?.role === "ADMIN" &&
    (user?.adminRoleSlug === "super_admin" || user?.adminRoleSlug === "super-admin");

  const canViewDocuments =
    isSuper ||
    userPermissions.includes("*") ||
    userPermissions.includes(PERMISSIONS.HOST_REGISTRATION_VIEW_DOCUMENTS) ||
    userPermissions.includes(PERMISSIONS.HOST_COMPLIANCE_VIEW_DOCUMENTS) ||
    userPermissions.includes("host_documents.view") ||
    userPermissions.includes(PERMISSIONS.HOSTS_VIEW);

  const canViewCompliance =
    isSuper ||
    userPermissions.includes("*") ||
    userPermissions.includes(PERMISSIONS.HOST_REGISTRATION_VIEW_COMPLIANCE) ||
    userPermissions.includes(PERMISSIONS.HOST_COMPLIANCE_VIEW) ||
    userPermissions.includes("host_compliance.view") ||
    userPermissions.includes(PERMISSIONS.HOSTS_VIEW);

  const canManageCompliance =
    isSuper ||
    userPermissions.includes("*") ||
    userPermissions.includes(PERMISSIONS.HOST_REGISTRATION_MANAGE_COMPLIANCE) ||
    userPermissions.includes(PERMISSIONS.HOST_COMPLIANCE_MANAGE) ||
    userPermissions.includes("host_compliance.manage") ||
    userPermissions.includes(PERMISSIONS.HOSTS_EDIT);

  const canManagePermissions =
    isSuper ||
    userPermissions.includes("*") ||
    userPermissions.includes(PERMISSIONS.HOSTS_MANAGE_PERMISSIONS);

  const [data, setData] = useState<HostDetailsDTO>(initialData);
  const [activeTab, setActiveTab] = useState<HostDetailTabId>("overview");

  // Tab pagination states
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsPageSize, setListingsPageSize] = useState(5);

  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(5);

  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(5);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Compliance Modals State
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [issueType, setIssueType] = useState("IDENTITY_VERIFICATION");
  const [issueSeverity, setIssueSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [issueDescription, setIssueDescription] = useState("");

  const [showResolveIssueModal, setShowResolveIssueModal] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionStatus, setResolutionStatus] = useState<"RESOLVED" | "REJECTED">("RESOLVED");

  const [showUpdateCompModal, setShowUpdateCompModal] = useState(false);
  const [newCompStatus, setNewCompStatus] = useState<"COMPLIANT" | "NON_COMPLIANT" | "ACTION_REQUIRED" | "UNDER_REVIEW">("COMPLIANT");
  const [compNotes, setCompNotes] = useState("");
  const [loadingCheckId, setLoadingCheckId] = useState<string | null>(null);

  // Activity Timeline Filter State
  const [activityCategory, setActivityCategory] = useState<string>("ALL");
  const [activitySearch, setActivitySearch] = useState<string>("");
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);

  // Form input states
  const [editName, setEditName] = useState(data.host.name || "");
  const [editEmail, setEditEmail] = useState(data.host.email || "");
  const [editPhone, setEditPhone] = useState(data.host.phone || "");

  const [verifStatusChoice, setVerifStatusChoice] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [verifReason, setVerifReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const host = data.host;
  const metrics = data.metrics;

  // Helper: Refresh data from server
  async function refreshData() {
    try {
      const res = await fetch(`/api/v1/admin/hosts/${host.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to refresh host details", err);
    }
  }

  // Pagination calculations for tabs
  const totalListingsPages = Math.max(1, Math.ceil(data.listings.length / listingsPageSize));
  const paginatedListings = data.listings.slice(
    (listingsPage - 1) * listingsPageSize,
    listingsPage * listingsPageSize
  );

  const totalBookingsPages = Math.max(1, Math.ceil(data.bookings.length / bookingsPageSize));
  const paginatedBookings = data.bookings.slice(
    (bookingsPage - 1) * bookingsPageSize,
    bookingsPage * bookingsPageSize
  );

  // Activity Filtering
  const filteredActivity = (data.activity || []).filter((a: any) => {
    const matchesCategory = activityCategory === "ALL" || a.category === activityCategory;
    const matchesSearch =
      !activitySearch.trim() ||
      (a.action || "").toLowerCase().includes(activitySearch.toLowerCase()) ||
      (a.description || "").toLowerCase().includes(activitySearch.toLowerCase()) ||
      (a.actorDisplay || "").toLowerCase().includes(activitySearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalActivityPages = Math.max(1, Math.ceil(filteredActivity.length / activityPageSize));
  const paginatedActivity = filteredActivity.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize
  );

  // Define tab list dynamically based on RBAC permissions
  const tabs: { id: HostDetailTabId; label: string; visible: boolean }[] = [
    { id: "overview", label: "Overview", visible: true },
    { id: "onboarding", label: "Onboarding", visible: true },
    { id: "documents", label: `Documents (${data.documents.length})`, visible: canViewDocuments },
    { id: "compliance", label: "Compliance", visible: canViewCompliance },
    { id: "listings", label: `Listings (${data.listings.length})`, visible: true },
    { id: "bookings", label: `Bookings (${data.bookings.length})`, visible: true },
    { id: "earnings", label: "Earnings", visible: true },
    { id: "activity", label: `Activity (${data.activity.length})`, visible: true },
    { id: "permissions", label: "Access & Permissions", visible: canManagePermissions },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  // Handler: Edit Host Info
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "UPDATE_PROFILE",
            data: { name: editName, email: editEmail, phone: editPhone },
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to update host profile" });
          return;
        }
        setData((prev) => ({
          ...prev,
          host: {
            ...prev.host,
            name: editName,
            email: editEmail,
            phone: editPhone,
          },
        }));
        setShowEditModal(false);
        setFeedback({ tone: "success", msg: "Host profile updated successfully." });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to connect to API server." });
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          name: editName,
          email: editEmail,
          phone: editPhone,
        },
      }));
      setShowEditModal(false);
      setFeedback({ tone: "success", msg: "Host profile updated successfully." });
    });
  }

  // Handler: Suspend / Unsuspend Host
  async function handleSuspendSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const newAction = host.status === "SUSPENDED" ? "UNSUSPEND" : "SUSPEND";
    const newStatus = host.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: newAction,
            reason: suspendReason,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to change host status" });
          return;
        }
        setData((prev) => ({
          ...prev,
          host: {
            ...prev.host,
            status: newStatus as any,
          },
        }));
        setShowSuspendModal(false);
        setFeedback({ tone: "success", msg: `Host status changed to ${newStatus}.` });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to update host status." });
      }

      setData((prev) => ({
        ...prev,
        host: {
          ...prev.host,
          status: newStatus as any,
        },
      }));
      setShowSuspendModal(false);
      setFeedback({ tone: "success", msg: `Host status changed to ${newStatus}.` });
    });
  }

  // Application Review Modals State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showActionReqModal, setShowActionReqModal] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [showDocRejectModal, setShowDocRejectModal] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docRejectReason, setDocRejectReason] = useState("");

  // Handler: Approve Host Application
  async function handleApproveApplication() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE_APPLICATION" }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to approve application." });
          setShowApproveModal(false);
          return;
        }
        setData((prev) => ({
          ...prev,
          host: {
            ...prev.host,
            status: "ACTIVE" as any,
            applicationStatus: "APPROVED",
            onboardingStage: "ONBOARDING_COMPLETE",
            onboardingStageLabel: "Onboarding Complete",
            verificationStatus: "VERIFIED",
            complianceStatus: "COMPLIANT",
            progressPercent: 100,
          },
        }));
        setShowApproveModal(false);
        setFeedback({ tone: "success", msg: "Host application approved successfully! User role updated to HOST." });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to connect to API server." });
        setShowApproveModal(false);
      }
      window.location.href = "/admin/hosts";
    });
  }

  // Handler: Reject Host Application
  async function handleRejectApplication(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REJECT_APPLICATION", reason: rejectReason }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to reject application." });
          setShowRejectModal(false);
          return;
        }
        setData((prev) => ({
          ...prev,
          host: {
            ...prev.host,
            applicationStatus: "REJECTED",
          },
        }));
        setShowRejectModal(false);
        setFeedback({ tone: "success", msg: "Host application rejected." });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to connect to API server." });
        setShowRejectModal(false);
      }
    });
  }

  // Handler: Request Action / Updates
  async function handleRequestAction(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REQUEST_ACTION", notes: actionNotes }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to send action request." });
          setShowActionReqModal(false);
          return;
        }
        setData((prev) => ({
          ...prev,
          host: {
            ...prev.host,
            applicationStatus: "WAITING_FOR_DOCUMENTS",
            onboardingStage: "DOCUMENT_VERIFICATION",
            onboardingStageLabel: "Document Verification",
          },
        }));
        setShowActionReqModal(false);
        setFeedback({ tone: "success", msg: "Action request sent to applicant." });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to connect to API server." });
        setShowActionReqModal(false);
      }
    });
  }

  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Handler: Document Verification / Rejection
  async function handleDocumentVerify(docId: string, status: "VERIFIED" | "REJECTED", reason?: string) {
    setFeedback(null);
    setLoadingDocId(docId);
    try {
      const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY_DOCUMENT", documentId: docId, status, reason }),
      });
      const result = await res.json();
      if (!result.success) {
        setFeedback({ tone: "error", msg: result.error?.message || "Failed to update document status." });
        setShowDocRejectModal(false);
        return;
      }
      setData((prev) => ({
        ...prev,
        documents: prev.documents.map((d: any) =>
          d.id === docId ? { ...d, status, rejectionReason: reason || null } : d
        ),
      }));
      setShowDocRejectModal(false);
      setFeedback({ tone: "success", msg: `Document marked as ${status}.` });
      await refreshData();
    } catch {
      setFeedback({ tone: "error", msg: "Failed to connect to API server." });
      setShowDocRejectModal(false);
    } finally {
      setLoadingDocId(null);
    }
  }

  // Compliance Check Update Handler
  async function handleComplianceCheckUpdate(checkId: string, status: "PASSED" | "FAILED" | "PENDING", notes?: string) {
    setFeedback(null);
    const actionKey = `${checkId}_${status}`;
    setLoadingCheckId(actionKey);

    // Optimistic UI state update
    setData((prev) => {
      const updatedChecks = prev.compliance.checks.map((check: any) => {
        if (check.id === checkId) {
          return {
            ...check,
            status,
            notes: notes || check.notes,
            completedAt: new Date().toISOString(),
            reviewer: { name: "Homyz Admin", email: "admin@homyz.com" },
          };
        }
        return check;
      });

      const completedCount = updatedChecks.filter((c: any) => c.status === "PASSED" || c.status === "COMPLIANT").length;
      const totalCount = updatedChecks.length;
      const pendingCount = totalCount - completedCount;

      return {
        ...prev,
        compliance: {
          ...prev.compliance,
          checks: updatedChecks,
          summary: {
            ...prev.compliance.summary,
            totalChecks: totalCount,
            completedChecks: completedCount,
            pendingChecks: pendingCount,
            openIssuesCount: prev.compliance.summary?.openIssuesCount || 0,
          },
        },
      };
    });

    try {
      const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_COMPLIANCE_CHECK", checkId, status, notes }),
      });
      const result = await res.json();
      if (!result.success) {
        setFeedback({ tone: "error", msg: result.error?.message || "Failed to update compliance check." });
      } else {
        setFeedback({ tone: "success", msg: `Compliance check marked as ${status}.` });
      }
      await refreshData();
    } catch {
      setFeedback({ tone: "error", msg: "Failed to update compliance check." });
    } finally {
      setLoadingCheckId(null);
    }
  }

  // Create Compliance Issue Handler
  async function handleCreateComplianceIssue(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CREATE_COMPLIANCE_ISSUE",
            issueType,
            severity: issueSeverity,
            description: issueDescription,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to log compliance issue." });
          setShowCreateIssueModal(false);
          return;
        }
        await refreshData();
        setShowCreateIssueModal(false);
        setIssueDescription("");
        setFeedback({ tone: "success", msg: "Compliance issue logged successfully." });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to log compliance issue." });
        setShowCreateIssueModal(false);
      }
    });
  }

  // Resolve Compliance Issue Handler
  async function handleResolveComplianceIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIssueId) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "RESOLVE_COMPLIANCE_ISSUE",
            issueId: selectedIssueId,
            status: resolutionStatus,
            resolutionNotes,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to update compliance issue." });
          setShowResolveIssueModal(false);
          return;
        }
        await refreshData();
        setShowResolveIssueModal(false);
        setSelectedIssueId(null);
        setResolutionNotes("");
        setFeedback({ tone: "success", msg: `Compliance issue marked as ${resolutionStatus}.` });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to update compliance issue." });
        setShowResolveIssueModal(false);
      }
    });
  }

  // Update Compliance Status Handler
  async function handleUpdateComplianceStatus(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/hosts/${host.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "UPDATE_COMPLIANCE_STATUS",
            status: newCompStatus,
            notes: compNotes,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          setFeedback({ tone: "error", msg: result.error?.message || "Failed to update compliance status." });
          setShowUpdateCompModal(false);
          return;
        }
        await refreshData();
        setShowUpdateCompModal(false);
        setFeedback({ tone: "success", msg: `Overall compliance status set to ${newCompStatus}.` });
      } catch {
        setFeedback({ tone: "error", msg: "Failed to update compliance status." });
        setShowUpdateCompModal(false);
      }
    });
  }

  const onboardingProgressValue =
    host.applicationStatus === "APPROVED" || host.onboardingStage === "ONBOARDING_COMPLETE"
      ? 100
      : (host as any).progressPercent ?? (host as any).onboardingProgress ?? 0;

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">
      {/* Alert Feedback */}
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold flex items-center justify-center text-xl shadow-2xs">
            {(host.name?.[0] || host.email?.[0] || "H").toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
                {host.name || "Unnamed Host / Applicant"}
              </h1>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  host.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : host.status === "SUSPENDED"
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                Account: {host.status}
              </span>

              {/* Application Status Badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                App: {host.applicationStatus}
              </span>

              {/* Onboarding Stage Badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-300">
                Stage: {host.onboardingStageLabel}
              </span>
            </div>

            <p className="mt-1 text-xs text-[var(--muted-foreground)] font-mono">
              {host.email || "No Email"} • ID: {host.id}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {host.applicationStatus !== "APPROVED" && (
            <>
              <button
                type="button"
                onClick={() => setShowApproveModal(true)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white transition-all shadow-2xs"
              >
                Approve Application
              </button>

              <button
                type="button"
                onClick={() => setShowActionReqModal(true)}
                className="rounded-full bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-extrabold text-zinc-950 transition-all shadow-2xs"
              >
                Request Updates
              </button>

              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-extrabold text-white transition-all shadow-2xs"
              >
                Reject App
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
          >
            Edit Profile
          </button>

          <button
            type="button"
            onClick={() => setShowSuspendModal(true)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all border shadow-2xs ${
              host.status === "SUSPENDED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
          >
            {host.status === "SUSPENDED" ? "Unsuspend Account" : "Suspend Account"}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-full bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-2xs"
          >
            Delete Host
          </button>
        </div>
      </div>

      {/* Top Metric Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Onboarding Progress Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[var(--muted-foreground)]">
              Onboarding Progress
            </span>
            <div className="h-9 w-9 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/50 dark:border-sky-800/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black tracking-tight text-sky-600 dark:text-sky-400">
              {onboardingProgressValue}%
            </p>
            <span className="text-xs font-bold text-[var(--muted-foreground)]">
              {onboardingProgressValue === 100 ? "Completed ✓" : `${(host as any).completedStepsCount ?? 1}/7 Steps`}
            </span>
          </div>
          {/* Dynamic Progress Bar */}
          <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-secondary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, onboardingProgressValue))}%` }}
            />
          </div>
        </div>

        {/* Listings Owned Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[var(--muted-foreground)]">
              Listings Owned
            </span>
            <div className="h-9 w-9 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200/50 dark:border-violet-800/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m-5 0V11m0 5h5" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black tracking-tight text-[var(--foreground)]">
              {metrics.totalListings}
            </p>
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Active Properties</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
            <span>● Managed listings</span>
          </div>
        </div>

        {/* Total Bookings Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[var(--muted-foreground)]">
              Total Bookings
            </span>
            <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black tracking-tight text-[var(--foreground)]">
              {metrics.totalBookings}
            </p>
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">Reservations</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            <span>● Guest reservations</span>
          </div>
        </div>

        {/* Total Earnings Card */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs hover:shadow-xs transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold tracking-wider uppercase text-[var(--muted-foreground)]">
              Total Earnings
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              ${(metrics.totalEarnings / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span>● Lifetime host payout</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar Navigation */}
      <div className="border-b border-[var(--border)] flex items-center gap-2 overflow-x-auto pt-2" suppressHydrationWarning>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[var(--accent)] text-[var(--foreground)] font-extrabold"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
              Personal & Profile Info
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Full Name</span>
                <span className="font-semibold text-[var(--foreground)]">{host.name || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Email Address</span>
                <span className="font-semibold text-[var(--foreground)]">{host.email || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Phone Number</span>
                <span className="font-semibold text-[var(--foreground)]">{host.phone || "Not provided"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Account Role</span>
                <span className="font-semibold text-[var(--foreground)]">{host.role}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Account Status</span>
                <span className="font-semibold text-[var(--foreground)]">{host.status}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Verification Status</span>
                <span className="font-semibold text-[var(--foreground)]">{host.verificationStatus}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
              Lifecycle & Timestamps
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Application Status</span>
                <span className="font-semibold text-[var(--foreground)]">{host.applicationStatus}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Onboarding Stage</span>
                <span className="font-semibold text-[var(--foreground)]">{host.onboardingStageLabel}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Compliance Status</span>
                <span className="font-semibold text-[var(--foreground)]">{data.compliance.complianceStatus}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Joined / Intake Date</span>
                <span className="font-semibold text-[var(--foreground)] font-mono" suppressHydrationWarning>
                  {new Date(host.createdAt).toLocaleString("en-US")}
                </span>
              </div>
            </div>
          </div>

          {/* Compliance, Document Verification & Onboarding Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4 md:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--foreground)]">Host Compliance & Onboarding Review</h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Verification assessment, document compliance checkpoints, and application status.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifModal(true)}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3.5 py-1.5 text-xs font-bold text-[var(--accent-foreground)] transition-colors shadow-2xs"
              >
                Change Verification Status
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">ID & Identity Check</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    host.verificationStatus === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {host.verificationStatus === "APPROVED" ? "Verified" : "Pending Review"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Government-issued identity & host contact credentials.</p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">Account Compliance</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    host.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  }`}>
                    {host.status === "ACTIVE" ? "Compliant" : "Restricted"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Platform terms of service and community policy compliance status.</p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--foreground)]">Onboarding Readiness</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    host.status === "ACTIVE" && host.verificationStatus === "APPROVED"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {host.status === "ACTIVE" && host.verificationStatus === "APPROVED" ? "Ready to Host" : "Action Required"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {host.status === "ACTIVE" && host.verificationStatus === "APPROVED"
                    ? "Host is authorized to publish listings and accept bookings."
                    : "Host requires approval or account resolution before publishing."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: ONBOARDING */}
      {activeTab === "onboarding" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
              Onboarding Workflow Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Registration Type</span>
                <span className="font-semibold text-[var(--foreground)]">{(host as any).registrationType || "INDIVIDUAL"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Business Name</span>
                <span className="font-semibold text-[var(--foreground)]">{(host as any).businessName || "Individual / N/A"}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Intended Property Count</span>
                <span className="font-semibold text-[var(--foreground)]">{(host as any).propertyCount ?? 1}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Assigned Reviewer</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {(host as any).assignedReviewer?.name || (host as any).assignedReviewer?.email || "Unassigned"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
              Onboarding Stage Progress
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Stage: {host.onboardingStageLabel}</span>
                <span className="font-extrabold text-sky-600">{onboardingProgressValue}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, onboardingProgressValue))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: DOCUMENTS (Permission Gated) */}
      {activeTab === "documents" && canViewDocuments && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Document Type</th>
                <th className="py-3.5 px-4">File Name</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Uploaded At</th>
                <th className="py-3.5 px-4">Verified By</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--muted-foreground)]">
                    No documents uploaded by this host yet.
                  </td>
                </tr>
              ) : (
                data.documents.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[var(--foreground)]">{doc.documentType}</td>
                    <td className="py-3.5 px-4 font-mono text-[var(--muted-foreground)]">{doc.fileName}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        doc.status === "VERIFIED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : doc.status === "REJECTED"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                      {new Date(doc.uploadedAt).toLocaleDateString("en-US")}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)]">
                      {doc.verifiedBy?.name || doc.verifiedBy?.email || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right flex items-center justify-end gap-2">
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:underline font-bold mr-1"
                        >
                          View
                        </a>
                      )}
                      {doc.status !== "VERIFIED" && (
                        <button
                          type="button"
                          onClick={() => handleDocumentVerify(doc.id, "VERIFIED")}
                          disabled={loadingDocId !== null || pending}
                          className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingDocId === doc.id ? (
                            <>
                              <svg className="animate-spin h-3 w-3 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Verifying...
                            </>
                          ) : (
                            <>Verify ✓</>
                          )}
                        </button>
                      )}
                      {doc.status !== "REJECTED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setShowDocRejectModal(true);
                          }}
                          disabled={loadingDocId !== null || pending}
                          className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Reject ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

      {/* Tab 4: COMPLIANCE (Permission Gated) */}
      {activeTab === "compliance" && canViewCompliance && (
        <div className="space-y-6">
          {/* Compliance Overview Dashboard */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-[var(--foreground)]">Host Compliance Summary</h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                    data.compliance.complianceStatus === "COMPLIANT"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : data.compliance.complianceStatus === "NON_COMPLIANT"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}>
                    {data.compliance.complianceStatus}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Host-specific compliance checks, severity issue logs, and approval eligibility status.
                </p>
              </div>

              {canManageCompliance && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateIssueModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 text-xs font-bold transition-colors border border-rose-200 dark:border-rose-800"
                  >
                    + Log Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpdateCompModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 text-xs font-bold transition-colors border border-sky-200 dark:border-sky-800"
                  >
                    Set Status
                  </button>
                </div>
              )}
            </div>

            {/* Approval Eligibility Alert Banner */}
            <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
              data.compliance.eligibility?.eligible
                ? "bg-emerald-500/10 border-emerald-200 text-emerald-900 dark:border-emerald-800 dark:text-emerald-200"
                : "bg-amber-500/10 border-amber-200 text-amber-900 dark:border-amber-800 dark:text-amber-200"
            }`}>
              <div className="flex items-start gap-2.5">
                <span className="text-sm font-black">
                  {data.compliance.eligibility?.eligible ? "✓" : "⚠️"}
                </span>
                <div className="space-y-1">
                  <span className="font-extrabold block text-xs uppercase tracking-wider">
                    {data.compliance.eligibility?.eligible ? "Application Ready for Approval" : "Approval Currently Blocked"}
                  </span>
                  {data.compliance.eligibility?.eligible ? (
                    <p>All mandatory compliance checks, identity verifications, and document reviews are complete.</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-0.5 font-medium">
                      {(data.compliance.eligibility?.reasons || ["Compliance checks pending"]).map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] block">Checks Passed</span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {data.compliance.summary?.completedChecks || 0} / {data.compliance.summary?.totalChecks || 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] block">Checks Pending</span>
                <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                  {data.compliance.summary?.pendingChecks || 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] block">Open Issues</span>
                <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                  {data.compliance.summary?.openIssuesCount || 0}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]">
                <span className="text-[11px] font-semibold text-[var(--muted-foreground)] block">Last Reviewed</span>
                <span className="text-xs font-bold text-[var(--foreground)] block truncate" suppressHydrationWarning>
                  {data.compliance.lastReviewedAt ? new Date(data.compliance.lastReviewedAt).toLocaleDateString("en-US") : "Not Reviewed"}
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Checklist Table / Grid */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
              Standard Compliance Checklist
            </h3>
            {data.compliance.checks.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No compliance checks found for this host.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.compliance.checks.map((c: any) => (
                  <div key={c.id} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[var(--foreground)]">{c.checkName}</p>
                        <p className="text-[10px] font-mono text-[var(--muted-foreground)]">{c.checkKey}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        c.status === "PASSED" || c.status === "COMPLIANT"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : c.status === "FAILED"
                          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}>
                        {c.status}
                      </span>
                    </div>

                    {c.notes && (
                      <p className="text-[11px] text-[var(--muted-foreground)] italic bg-[var(--surface)] p-2 rounded-lg border border-[var(--border-subtle)]">
                        "{c.notes}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[10px] text-[var(--muted-foreground)]">
                      <span>Reviewer: {c.reviewer?.name || c.reviewer?.email || "System"}</span>
                      {canManageCompliance && (
                        <div className="flex items-center gap-1.5">
                          {c.status !== "PASSED" && (
                            <button
                              type="button"
                              onClick={() => handleComplianceCheckUpdate(c.id, "PASSED")}
                              disabled={loadingCheckId !== null || pending}
                              className="px-2.5 py-1 text-[10px] font-extrabold rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingCheckId === `${c.id}_PASSED` ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Passing...
                                </>
                              ) : (
                                <>Pass ✓</>
                              )}
                            </button>
                          )}
                          {c.status !== "FAILED" && (
                            <button
                              type="button"
                              onClick={() => handleComplianceCheckUpdate(c.id, "FAILED")}
                              disabled={loadingCheckId !== null || pending}
                              className="px-2.5 py-1 text-[10px] font-extrabold rounded-md bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all flex items-center gap-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingCheckId === `${c.id}_FAILED` ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Failing...
                                </>
                              ) : (
                                <>Fail ✕</>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compliance Issues Section */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
              Compliance Issue Log
            </h3>
            {data.compliance.issues.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--muted-foreground)] space-y-1">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Zero Active Compliance Issues</p>
                <p>No compliance violations or flags reported for this host account.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.compliance.issues.map((i: any) => (
                  <div key={i.id} className={`p-4 rounded-xl border text-xs space-y-2 ${
                    i.status === "RESOLVED"
                      ? "bg-[var(--surface-secondary)] border-[var(--border-subtle)]"
                      : i.severity === "HIGH" || i.severity === "CRITICAL"
                      ? "bg-rose-500/10 border-rose-200 dark:border-rose-900"
                      : "bg-amber-500/10 border-amber-200 dark:border-amber-900"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--foreground)]">{i.issueType}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          i.severity === "CRITICAL" ? "bg-rose-600 text-white" :
                          i.severity === "HIGH" ? "bg-rose-500 text-white" :
                          i.severity === "MEDIUM" ? "bg-amber-500 text-white" : "bg-zinc-500 text-white"
                        }`}>
                          {i.severity}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        i.status === "RESOLVED"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                      }`}>
                        {i.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--foreground)]">{i.description}</p>

                    {i.resolutionNotes && (
                      <p className="text-[11px] text-[var(--muted-foreground)] italic bg-[var(--surface)] p-2 rounded-lg border border-[var(--border-subtle)]">
                        Resolution: "{i.resolutionNotes}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border-subtle)]">
                      <span>Created by {i.createdBy?.name || i.createdBy?.email || "Admin"}</span>
                      {canManageCompliance && i.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIssueId(i.id);
                            setShowResolveIssueModal(true);
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold hover:bg-emerald-700 transition-colors"
                        >
                          Resolve Issue ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: LISTINGS */}
      {activeTab === "listings" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Listing Title</th>
                  <th className="py-3.5 px-4">Price / Night</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Bookings Count</th>
                  <th className="py-3.5 px-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.listings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--muted-foreground)]">
                      No listings published by this host.
                    </td>
                  </tr>
                ) : (
                  paginatedListings.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[var(--foreground)]">{item.title}</td>
                      <td className="py-3.5 px-4 text-[var(--foreground)] font-bold">${(item.price / 100).toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        {item.published ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--surface-secondary)] text-[var(--muted-foreground)] border border-[var(--border)]">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[var(--foreground)]">{item.bookingsCount}</td>
                      <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                        {new Date(item.createdAt).toLocaleDateString("en-US")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-[var(--border-subtle)]">
            <AdminPagination
              currentPage={listingsPage}
              totalPages={totalListingsPages}
              totalItems={data.listings.length}
              pageSize={listingsPageSize}
              onPageChange={setListingsPage}
              onPageSizeChange={(size) => {
                setListingsPageSize(size);
                setListingsPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Tab 6: BOOKINGS */}
      {activeTab === "bookings" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Booking ID</th>
                <th className="py-3.5 px-4">Listing Title</th>
                <th className="py-3.5 px-4">Guest Info</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {data.bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--muted-foreground)]">
                    No reservations recorded for this host.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">{b.id}</td>
                    <td className="py-3.5 px-4 font-bold text-[var(--foreground)]">{b.listingTitle}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--foreground)]">{b.guestName || "Guest"}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono">{b.guestEmail || "N/A"}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] font-mono" suppressHydrationWarning>
                      {new Date(b.startDate).toLocaleDateString("en-US")} - {new Date(b.endDate).toLocaleDateString("en-US")}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[var(--foreground)]">${(b.amount / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-[var(--border-subtle)]">
            <AdminPagination
              currentPage={bookingsPage}
              totalPages={totalBookingsPages}
              totalItems={data.bookings.length}
              pageSize={bookingsPageSize}
              onPageChange={setBookingsPage}
              onPageSizeChange={(size) => {
                setBookingsPageSize(size);
                setBookingsPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Tab 7: EARNINGS */}
      {activeTab === "earnings" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-[var(--foreground)] border-b border-[var(--border-subtle)] pb-3">
            Financial & Revenue Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-xs">
              <span className="text-[var(--muted-foreground)] block">Confirmed Earnings</span>
              <span className="text-xl font-extrabold text-emerald-600">${(metrics.totalEarnings / 100).toFixed(2)}</span>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-xs">
              <span className="text-[var(--muted-foreground)] block">Total Reservations</span>
              <span className="text-xl font-extrabold text-[var(--foreground)]">{metrics.totalBookings}</span>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-xs">
              <span className="text-[var(--muted-foreground)] block">Active Listings</span>
              <span className="text-xl font-extrabold text-[var(--foreground)]">{metrics.totalListings}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--foreground)]">Unified Host Activity & Audit Timeline</h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Centralized chronological audit log capturing registrations, documents, compliance checks, approvals, and admin actions.
              </p>
            </div>
            <div className="text-xs font-mono text-[var(--muted-foreground)]">
              Total Events: {filteredActivity.length}
            </div>
          </div>

          {/* Activity Category Filters & Search */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search input */}
            <input
              type="text"
              value={activitySearch}
              onChange={(e) => {
                setActivitySearch(e.target.value);
                setActivityPage(1);
              }}
              placeholder="Search activity by action, description, or actor..."
              className="px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-xs text-[var(--foreground)] outline-none focus:border-sky-500 w-full md:w-72"
            />

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
              {["ALL", "REGISTRATION", "APPLICATION", "DOCUMENTS", "COMPLIANCE", "APPROVAL", "ACCOUNT", "LISTINGS", "BOOKINGS", "ADMIN_ACTIONS", "SECURITY"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActivityCategory(cat);
                    setActivityPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border ${
                    activityCategory === cat
                      ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                      : "bg-[var(--surface-secondary)] text-[var(--muted-foreground)] border-[var(--border-subtle)] hover:border-[var(--border)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Activity List */}
          {filteredActivity.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
              No activity logs match the selected filter criteria.
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-[var(--border-subtle)] before:z-0">
              {paginatedActivity.map((a: any) => {
                const isExpanded = expandedActivityId === a.id;
                return (
                  <div
                    key={a.id}
                    className="relative z-10 p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:border-[var(--border)] transition-all space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          a.category === "APPROVAL" ? "bg-emerald-500" :
                          a.category === "COMPLIANCE" ? "bg-amber-500" :
                          a.category === "DOCUMENTS" ? "bg-sky-500" :
                          a.category === "SECURITY" ? "bg-rose-500" : "bg-indigo-500"
                        }`} />
                        <span className="font-extrabold text-[var(--foreground)]">{a.action}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--surface)] text-[var(--muted-foreground)] border border-[var(--border-subtle)]">
                          {a.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] font-mono">
                        <span className="font-semibold text-[var(--foreground)]">{a.actorDisplay}</span>
                        <span suppressHydrationWarning>{new Date(a.createdAt).toLocaleString("en-US")}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--muted-foreground)]">{a.description}</p>

                    {(a.before || a.after || a.reason || a.ip) && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedActivityId(isExpanded ? null : a.id)}
                          className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? "Hide Details ▲" : "View Details & Diffs ▼"}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1.5 font-mono text-[11px]">
                            {a.before && <div><span className="text-rose-500 font-bold">Before:</span> {JSON.stringify(a.before)}</div>}
                            {a.after && <div><span className="text-emerald-500 font-bold">After:</span> {JSON.stringify(a.after)}</div>}
                            {a.reason && <div><span className="text-amber-500 font-bold">Reason:</span> {a.reason}</div>}
                            {a.ip && <div><span className="text-[var(--muted-foreground)] font-bold">IP:</span> {a.ip}</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2">
            <AdminPagination
              currentPage={activityPage}
              totalPages={totalActivityPages}
              totalItems={filteredActivity.length}
              pageSize={activityPageSize}
              onPageChange={setActivityPage}
              onPageSizeChange={(size) => {
                setActivityPageSize(size);
                setActivityPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Tab 9: ACCESS & PERMISSIONS (Permission Gated) */}
      {activeTab === "permissions" && canManagePermissions && (
        <HostPermissionsTab
          hostId={host.id}
          hostName={host.name}
          hostEmail={host.email}
          hostStatus={host.status}
        />
      )}

      {/* Modals */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Edit Host Profile</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-amber-500 text-zinc-950 px-4 py-1.5 text-xs font-extrabold disabled:opacity-50"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">
              {host.status === "SUSPENDED" ? "Unsuspend Account" : "Suspend Account"}
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Are you sure you want to {host.status === "SUSPENDED" ? "unsuspend" : "suspend"} {host.name || host.email}?
            </p>
            {host.status !== "SUSPENDED" && (
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] font-medium mb-1">Reason for suspension</label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-xs text-[var(--foreground)] outline-none"
                  rows={3}
                  placeholder="Optional reason..."
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSuspendSubmit}
                disabled={pending}
                className={`rounded-full px-4 py-1.5 text-xs font-extrabold text-white ${
                  host.status === "SUSPENDED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Confirm {host.status === "SUSPENDED" ? "Unsuspend" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Approve Host Application</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Are you sure you want to approve the host application for <strong>{host.name || host.email}</strong>?
              This will set the user role to <strong>HOST</strong> and activate their account.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveApplication}
                disabled={pending}
                className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-extrabold hover:bg-emerald-700 disabled:opacity-50"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Reject Host Application</h3>
            <form onSubmit={handleRejectApplication} className="space-y-3 text-xs">
              <p className="text-xs text-[var(--muted-foreground)]">
                Provide a reason for rejecting this host application:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                rows={3}
                placeholder="State why the application is rejected..."
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-rose-600 text-white px-4 py-1.5 text-xs font-extrabold hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showActionReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Request Information / Action</h3>
            <form onSubmit={handleRequestAction} className="space-y-3 text-xs">
              <p className="text-xs text-[var(--muted-foreground)]">
                Specify what changes or missing documents the applicant needs to provide:
              </p>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                rows={3}
                placeholder="e.g. Please upload a clear photo of your Government ID and Business License."
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowActionReqModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-amber-500 text-zinc-950 px-4 py-1.5 text-xs font-extrabold hover:bg-amber-600 disabled:opacity-50"
                >
                  Send Action Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDocRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Reject Document</h3>
            <div className="space-y-3 text-xs">
              <p className="text-xs text-[var(--muted-foreground)]">
                Specify why this document is rejected:
              </p>
              <textarea
                value={docRejectReason}
                onChange={(e) => setDocRejectReason(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                rows={3}
                placeholder="e.g. Document image is blurry, expired, or unreadable."
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDocRejectModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => selectedDocId && handleDocumentVerify(selectedDocId, "REJECTED", docRejectReason)}
                  disabled={pending}
                  className="rounded-full bg-rose-600 text-white px-4 py-1.5 text-xs font-extrabold hover:bg-rose-700 disabled:opacity-50"
                >
                  Reject Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance Modal: Log Issue */}
      {showCreateIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Log Compliance Issue</h3>
            <form onSubmit={handleCreateComplianceIssue} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Issue Category</label>
                <input
                  type="text"
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  required
                  placeholder="e.g. IDENTITY_VERIFICATION, TAX_FORM_EXPIRED"
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Severity Level</label>
                <select
                  value={issueSeverity}
                  onChange={(e) => setIssueSeverity(e.target.value as any)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none font-bold"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Description / Violation Details</label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Detail the compliance violation or missing documentation requirement..."
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateIssueModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-rose-600 text-white px-4 py-1.5 text-xs font-extrabold hover:bg-rose-700 disabled:opacity-50"
                >
                  Log Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compliance Modal: Resolve Issue */}
      {showResolveIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Resolve Compliance Issue</h3>
            <form onSubmit={handleResolveComplianceIssue} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Resolution Decision</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none font-bold"
                >
                  <option value="RESOLVED">RESOLVED (Issue Closed)</option>
                  <option value="REJECTED">REJECTED (Invalid / Dismissed)</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Resolution Notes</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  placeholder="Provide resolution details or administrative audit notes..."
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveIssueModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-extrabold hover:bg-emerald-700 disabled:opacity-50"
                >
                  Save Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compliance Modal: Update Status */}
      {showUpdateCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[var(--foreground)]">Set Host Compliance Status</h3>
            <form onSubmit={handleUpdateComplianceStatus} className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Compliance Status</label>
                <select
                  value={newCompStatus}
                  onChange={(e) => setNewCompStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none font-bold"
                >
                  <option value="COMPLIANT">COMPLIANT</option>
                  <option value="NON_COMPLIANT">NON_COMPLIANT</option>
                  <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                </select>
              </div>
              <div>
                <label className="block text-[var(--muted-foreground)] font-medium mb-1">Audit Notes</label>
                <textarea
                  value={compNotes}
                  onChange={(e) => setCompNotes(e.target.value)}
                  rows={3}
                  placeholder="Reason for compliance status modification..."
                  className="w-full rounded-lg border border-[var(--border)] p-2 bg-[var(--surface)] text-[var(--foreground)] outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpdateCompModal(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-sky-600 text-white px-4 py-1.5 text-xs font-extrabold hover:bg-sky-700 disabled:opacity-50"
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
