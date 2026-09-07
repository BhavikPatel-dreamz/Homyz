"use client";

import { ModalOverlay } from "@/components/ui/modal-overlay";
import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Alert } from "../ui";
import type {
  HostRegistrationDetailsData,
  HostDocumentItem,
  HostComplianceCheckItem,
  HostComplianceIssueItem,
  HostInfoRequestItem,
  ApprovalEligibilityResult,
} from "@/services/host-registration.service";

const STANDARD_REJECTION_REASONS = [
  "Invalid document",
  "Unreadable document",
  "Information mismatch",
  "Expired document",
  "Wrong document type",
];

const STANDARD_APPLICATION_REJECTION_REASONS = [
  "Failed identity verification",
  "Invalid/incomplete information",
  "Compliance failure",
  "Required documents not provided",
  "Policy violation",
  "Other",
];

interface HostRegistrationWorkspaceProps {
  requestId: string;
  onClose?: () => void;
  isDrawer?: boolean;
}

export function HostRegistrationWorkspace({
  requestId,
  onClose,
  isDrawer = false,
}: HostRegistrationWorkspaceProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = (searchParams.get("tab") || "").toLowerCase();
  const VALID_WORKSPACE_TABS = ["overview", "applicant", "property", "documents", "notes", "activity"];

  const activeTab = VALID_WORKSPACE_TABS.includes(tabParam) ? tabParam : "overview";

  function getTabHref(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const [data, setData] = useState<HostRegistrationDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Phase 4: Onboarding Progress State
  const [onboardingData, setOnboardingData] = useState<any | null>(null);

  // Modals & Action States
  const [previewDoc, setPreviewDoc] = useState<HostDocumentItem | null>(null);
  const [securePreviewUrl, setSecurePreviewUrl] = useState<string | null>(null);

  // Document Reject Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetDoc, setTargetDoc] = useState<HostDocumentItem | null>(null);
  const [rejectionReasonSelect, setRejectionReasonSelect] = useState<string>(STANDARD_REJECTION_REASONS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState("");

  // Request Resubmission Modal State
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitInstructions, setResubmitInstructions] = useState("");

  // Reviewer Note Input State
  const [newNoteContent, setNewNoteContent] = useState("");

  // Phase 3: Compliance State
  const [complianceData, setComplianceData] = useState<any | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Phase 3: Modals
  const [createIssueModalOpen, setCreateIssueModalOpen] = useState(false);
  const [newIssueType, setNewIssueType] = useState("");
  const [newIssueDesc, setNewIssueDesc] = useState("");
  const [newIssueSeverity, setNewIssueSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");

  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false);
  const [infoRequiredText, setInfoRequiredText] = useState("");
  const [infoReasonText, setInfoReasonText] = useState("");
  const [infoDeadlineDate, setInfoDeadlineDate] = useState("");

  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<ApprovalEligibilityResult | null>(null);

  const [appRejectModalOpen, setAppRejectModalOpen] = useState(false);
  const [appRejectReason, setAppRejectReason] = useState(STANDARD_APPLICATION_REJECTION_REASONS[0]);
  const [appRejectExplanation, setAppRejectExplanation] = useState("");

  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReasonText, setReopenReasonText] = useState("");

  // Fetch Application Details
  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/hosts/registration-requests/${requestId}`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to load application details");
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to server");
    } fontally: {
      setLoading(false);
    }
  }, [requestId]);

  // Fetch Compliance Details
  const fetchCompliance = useCallback(async () => {
    setComplianceLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/hosts/registration-requests/${requestId}/compliance`);
      const json = await res.json();
      if (json.success) {
        setComplianceData(json.data);
      }
    } catch (err) {
      console.error("Error fetching compliance details:", err);
    } finally {
      setComplianceLoading(false);
    }
  }, [requestId]);

  // Fetch Onboarding Progress (Phase 4)
  const fetchOnboarding = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/hosts/onboarding/${requestId}`);
      const json = await res.json();
      if (json.success) {
        setOnboardingData(json.data);
      }
    } catch (err) {
      console.error("Error fetching onboarding progress:", err);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetails();
    fetchCompliance();
    fetchOnboarding();
  }, [fetchDetails, fetchCompliance, fetchOnboarding]);

  // Action: Verify Document
  const handleVerifyDocument = async (doc: HostDocumentItem) => {
    if (!confirm(`Are you sure you want to verify ${doc.documentType} (${doc.fileName})?`)) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/documents/${doc.id}/verify`,
          { method: "POST" }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to verify document" });
          return;
        }

        setFeedback({ tone: "success", msg: `Verified document: ${doc.fileName}` });
        fetchDetails();
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error verifying document" });
      }
    });
  };

  // Action: Open Document Reject Modal
  const handleOpenRejectModal = (doc: HostDocumentItem) => {
    setTargetDoc(doc);
    setRejectionReasonSelect(STANDARD_REJECTION_REASONS[0]);
    setCustomRejectionReason("");
    setRejectModalOpen(true);
  };

  // Action: Submit Reject Document
  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDoc) return;

    const finalReason =
      rejectionReasonSelect === "Other" && customRejectionReason.trim()
        ? customRejectionReason.trim()
        : rejectionReasonSelect;

    if (!finalReason) {
      setFeedback({ tone: "error", msg: "Rejection reason is required" });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/documents/${targetDoc.id}/reject`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: finalReason }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to reject document" });
          return;
        }

        setFeedback({ tone: "success", msg: `Rejected document ${targetDoc.fileName}. Host notified by email.` });
        setRejectModalOpen(false);
        fetchDetails();
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error rejecting document" });
      }
    });
  };

  // Action: Open Resubmit Modal
  const handleOpenResubmitModal = (doc: HostDocumentItem) => {
    setTargetDoc(doc);
    setRejectionReasonSelect(STANDARD_REJECTION_REASONS[1]);
    setCustomRejectionReason("");
    setResubmitInstructions("");
    setResubmitModalOpen(true);
  };

  // Action: Submit Resubmission Request
  const handleResubmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDoc) return;

    const finalReason =
      rejectionReasonSelect === "Other" && customRejectionReason.trim()
        ? customRejectionReason.trim()
        : rejectionReasonSelect;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/documents/${targetDoc.id}/request-resubmission`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: finalReason,
              instructions: resubmitInstructions,
            }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to request re-submission" });
          return;
        }

        setFeedback({
          tone: "success",
          msg: `Requested re-submission for ${targetDoc.fileName}. Host notification sent.`,
        });
        setResubmitModalOpen(false);
        fetchDetails();
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error requesting document re-submission" });
      }
    });
  };

  // Action: Secure Document Preview
  const handlePreviewDocument = async (doc: HostDocumentItem) => {
    setPreviewDoc(doc);
    setSecurePreviewUrl(null);
    try {
      const res = await fetch(
        `/api/v1/admin/hosts/registration-requests/documents/${doc.id}/preview`
      );
      const json = await res.json();
      if (json.success && json.data?.url) {
        setSecurePreviewUrl(json.data.url);
      } else {
        setSecurePreviewUrl(doc.fileUrl || "#");
      }
    } catch (err) {
      setSecurePreviewUrl(doc.fileUrl || "#");
    }
  };

  // Action: Add Internal Reviewer Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/notes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: newNoteContent.trim() }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to add review note" });
          return;
        }

        setFeedback({ tone: "success", msg: "Added internal review note" });
        setNewNoteContent("");
        fetchDetails();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error adding review note" });
      }
    });
  };

  // Phase 3 Action: Toggle Compliance Check
  const handleToggleCheck = async (checkId: string, currentStatus: string) => {
    const newStatus = currentStatus === "PASSED" ? "FAILED" : "PASSED";
    const notes = prompt("Enter optional notes for this compliance check update:", "");

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/compliance/checks/${checkId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus, notes: notes || undefined }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to update check" });
          return;
        }

        setFeedback({ tone: "success", msg: `Updated check status to ${newStatus}` });
        fetchCompliance();
        fetchDetails();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error updating compliance check" });
      }
    });
  };

  // Phase 3 Action: Create Compliance Issue
  const handleCreateIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueType.trim() || !newIssueDesc.trim()) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/compliance/issues`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issueType: newIssueType.trim(),
              description: newIssueDesc.trim(),
              severity: newIssueSeverity,
            }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to record issue" });
          return;
        }

        setFeedback({ tone: "success", msg: `Recorded compliance issue: ${newIssueType}` });
        setCreateIssueModalOpen(false);
        setNewIssueType("");
        setNewIssueDesc("");
        fetchCompliance();
        fetchDetails();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error creating compliance issue" });
      }
    });
  };

  // Phase 3 Action: Resolve Compliance Issue
  const handleResolveIssue = async (issueId: string, status: "RESOLVED" | "REJECTED") => {
    const notes = prompt(`Enter resolution details for marking as ${status}:`, "");

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/compliance/issues/${issueId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, resolutionNotes: notes || undefined }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to update issue" });
          return;
        }

        setFeedback({ tone: "success", msg: `Compliance issue marked as ${status}` });
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error resolving compliance issue" });
      }
    });
  };

  // Phase 3 Action: Request Additional Information
  const handleRequestInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoRequiredText.trim() || !infoReasonText.trim()) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/request-info`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              informationRequired: infoRequiredText.trim(),
              reason: infoReasonText.trim(),
              deadline: infoDeadlineDate || undefined,
            }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Failed to request info" });
          return;
        }

        setFeedback({ tone: "success", msg: "Requested additional information and notified host by email" });
        setRequestInfoModalOpen(false);
        setInfoRequiredText("");
        setInfoReasonText("");
        setInfoDeadlineDate("");
        fetchCompliance();
        fetchDetails();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error sending info request" });
      }
    });
  };

  // Phase 3 Action: Open Approval Modal & Check Eligibility
  const handleOpenApprovalModal = async () => {
    try {
      const res = await fetch(
        `/api/v1/admin/hosts/registration-requests/${requestId}/approval-eligibility`
      );
      const json = await res.json();
      if (json.success) {
        setEligibilityResult(json.data);
        setApprovalModalOpen(true);
      }
    } catch (err) {
      setFeedback({ tone: "error", msg: "Error checking approval eligibility" });
    }
  };

  // Phase 3 Action: Confirm Application Approval
  const handleConfirmApproval = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/approve`,
          { method: "POST" }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Approval failed" });
          return;
        }

        setFeedback({ tone: "success", msg: "🎉 Host application APPROVED & Host account ACTIVATED!" });
        setApprovalModalOpen(false);
        fetchDetails();
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error approving application" });
      }
    });
  };

  // Phase 3 Action: Confirm Application Rejection
  const handleConfirmApplicationRejection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appRejectReason.trim()) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/reject`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: appRejectReason,
              explanation: appRejectExplanation.trim() || undefined,
            }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Rejection failed" });
          return;
        }

        setFeedback({ tone: "success", msg: "Application REJECTED and notification sent to applicant" });
        setAppRejectModalOpen(false);
        fetchDetails();
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error rejecting application" });
      }
    });
  };

  // Phase 3 Action: Reopen Application
  const handleConfirmReopen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReasonText.trim()) return;

    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/hosts/registration-requests/${requestId}/reopen`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: reopenReasonText.trim() }),
          }
        );
        const json = await res.json();

        if (!json.success) {
          setFeedback({ tone: "error", msg: json.error?.message || "Reopen failed" });
          return;
        }

        setFeedback({ tone: "success", msg: "Application REOPENED for review" });
        setReopenModalOpen(false);
        setReopenReasonText("");
        fetchDetails();
        fetchCompliance();
      } catch (err) {
        setFeedback({ tone: "error", msg: "Error reopening application" });
      }
    });
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Pending Intake
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/50">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            In Review
          </span>
        );
      case "WAITING_FOR_DOCUMENTS":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping" />
            Waiting for Documents
          </span>
        );
      case "DOCUMENTS_UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900/50">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Documents Under Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/50">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
            {status}
          </span>
        );
    }
  };

  const renderComplianceBadge = (status: string) => {
    switch (status) {
      case "COMPLIANT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
            ✓ Compliant
          </span>
        );
      case "NON_COMPLIANT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300">
            ✕ Non-Compliant
          </span>
        );
      case "ACTION_REQUIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300">
            ⚠️ Action Required
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300">
            ⏳ Under Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-300">
            Pending Intake
          </span>
        );
    }
  };

  const renderDocStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300">
            ✓ Verified
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300">
            ✕ Rejected
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-300">
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300">
            ⏳ Pending Review
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[var(--muted-foreground)] space-y-3">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="font-semibold">Loading application review workspace...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-xs text-rose-600 space-y-3">
        <p className="font-semibold text-sm">{error || "Application not found"}</p>
        <button onClick={fetchDetails} className="underline font-semibold cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  const { documentSummary } = data;
  const actionRequiredCount = documentSummary.pending + documentSummary.rejected;

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

      {/* TOP REVIEW DASHBOARD SUMMARY BARNER & DECISION ACTIONS */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1>
                {data.applicationId}
              </h1>
              {renderStatusBadge(data.status)}
              {complianceData && renderComplianceBadge(complianceData.complianceStatus)}
              <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                Submitted {new Date(data.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Host: <strong className="text-muted-foreground">{data.applicantName}</strong> ({data.applicantEmail})
            </p>
          </div>

          {/* PHASE 3 DECISION WORKFLOW ACTION BUTTONS */}
          <div className="flex items-center gap-2 flex-wrap">
            {data.status !== "APPROVED" && (
              <button
                type="button"
                onClick={handleOpenApprovalModal}
                disabled={pendingTransition}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                ✓ Approve Application
              </button>
            )}

            {data.status !== "REJECTED" && (
              <button
                type="button"
                onClick={() => setAppRejectModalOpen(true)}
                disabled={pendingTransition}
                className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                ✕ Reject Application
              </button>
            )}

            <button
              type="button"
              onClick={() => setRequestInfoModalOpen(true)}
              disabled={pendingTransition}
              className="rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              📩 Request Additional Info
            </button>

            {(data.status === "APPROVED" || data.status === "REJECTED") && (
              <button
                type="button"
                onClick={() => setReopenModalOpen(true)}
                disabled={pendingTransition}
                className="rounded-full border border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800 px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                🔄 Reopen Application
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
              >
                Close Workspace
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Metric Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Application Status
            </span>
            <div className="pt-0.5">{renderStatusBadge(data.status)}</div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Compliance State
            </span>
            <div className="pt-0.5 font-semibold">
              {complianceData ? renderComplianceBadge(complianceData.complianceStatus) : "Loading..."}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Assigned Reviewer
            </span>
            <div className="font-semibold text-muted-foreground pt-0.5">
              {data.assignedReviewer ? (data.assignedReviewer.name || data.assignedReviewer.email) : "Unassigned"}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Verification Progress
            </span>
            <div className="pt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {documentSummary.verified} of {documentSummary.required} Verified
            </div>
          </div>
        </div>
      </div>

      {/* WORKSPACE NAVIGATION TABS */}
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] overflow-x-auto text-xs font-semibold">
        <Link
          href={getTabHref("overview")}
          className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "overview"
              ? "border-[var(--accent)] text-muted-foreground"
              : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
          }`}
        >
          Overview
        </Link>
        <Link
          href={getTabHref("applicant")}
          className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "applicant"
              ? "border-[var(--accent)] text-muted-foreground"
              : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
          }`}
        >
          Applicant Info
        </Link>
        <Link
          href={getTabHref("property")}
          className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "property"
              ? "border-[var(--accent)] text-muted-foreground"
              : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
          }`}
        >
          Property & Business
        </Link>
        <Link
          href={getTabHref("documents")}
          className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === "documents"
              ? "border-[var(--accent)] text-muted-foreground"
              : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
          }`}
        >
          <span>Documents</span>
          <span className="rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-2 py-0.2 text-[10px]">
            {data.documents.length}
          </span>
        </Link>

        <Link
          href={getTabHref("notes")}
          className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === "notes"
              ? "border-[var(--accent)] text-muted-foreground"
              : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
          }`}
        >
          <span>Review Notes</span>
          <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 text-muted-foreground px-2 py-0.2 text-[10px]">
            {data.reviewNotes.length}
          </span>
        </Link>
        <Link
          href={getTabHref("activity")}
          className={`px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === "activity"
              ? "border-[var(--accent)] text-muted-foreground"
              : "border-transparent text-[var(--muted-foreground)] hover:text-muted-foreground"
          }`}
        >
          Review Activity ({data.activityLogs.length})
        </Link>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b border-[var(--border-subtle)] pb-2">
              Application Overview
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Application ID</span>
                <span className="font-semibold font-mono text-muted-foreground">{data.applicationId}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Onboarding Stage</span>
                <span className="font-semibold text-muted-foreground">{data.onboardingStage}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Submitted Date</span>
                <span className="font-mono text-muted-foreground">{new Date(data.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Last Updated</span>
                <span className="font-mono text-muted-foreground">{new Date(data.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b border-[var(--border-subtle)] pb-2">
              Reviewer Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Assigned Reviewer</span>
                <span className="font-semibold text-muted-foreground">
                  {data.assignedReviewer ? (data.assignedReviewer.name || data.assignedReviewer.email) : "Unassigned"}
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Assigned At</span>
                <span className="font-mono text-muted-foreground">
                  {data.assignedAt ? new Date(data.assignedAt).toLocaleString() : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Review Started By</span>
                <span className="font-semibold text-muted-foreground">
                  {data.reviewedBy ? (data.reviewedBy.name || data.reviewedBy.email) : "Not started"}
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] block font-medium">Review Started At</span>
                <span className="font-mono text-muted-foreground">
                  {data.reviewStartedAt ? new Date(data.reviewStartedAt).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: APPLICANT INFORMATION */}
      {activeTab === "applicant" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-muted-foreground border-b border-[var(--border-subtle)] pb-3">
            Applicant Profile Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Full Name</span>
              <span className="font-semibold text-muted-foreground text-sm">{data.applicantName}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Email Address</span>
              <span className="font-semibold font-mono text-muted-foreground">{data.applicantEmail}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Phone Number</span>
              <span className="font-semibold text-muted-foreground">{data.applicantPhone || "Not provided"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Linked Host Account</span>
              <span className="font-semibold text-muted-foreground">{data.hostUser ? "Registered User" : "Pending Registration"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Account Creation Date</span>
              <span className="font-mono text-muted-foreground">
                {data.hostUser ? new Date(data.hostUser.createdAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PROPERTY & BUSINESS INFORMATION */}
      {activeTab === "property" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-muted-foreground border-b border-[var(--border-subtle)] pb-3">
            Property & Business Profile (Read-Only Intake)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Registration Category</span>
              <span className="font-semibold text-muted-foreground text-sm">{data.registrationType}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Business / Entity Name</span>
              <span className="font-semibold text-muted-foreground">{data.businessName || "Not provided"}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Estimated Property Count</span>
              <span className="font-semibold text-muted-foreground">{data.propertyCount}</span>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)] block font-medium">Property Location / Address</span>
              <span className="font-semibold text-muted-foreground">{data.location || "Not specified"}</span>
            </div>
          </div>
          {data.notes && (
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1">
              <span className="text-[var(--muted-foreground)] block font-medium">Intake Description / Notes</span>
              <p className="p-4 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] text-xs text-muted-foreground">
                {data.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: DOCUMENTS VERIFICATION WORKSPACE */}
      {activeTab === "documents" && (
        <div className="space-y-6 text-xs">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Document Verification Summary</h4>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Verify individual submitted files or request host re-submissions.
                </p>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] font-semibold text-muted-foreground">
                  Required: {documentSummary.required}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                  Verified: {documentSummary.verified}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">
                  Pending: {documentSummary.pending}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 font-semibold">
                  Rejected: {documentSummary.rejected}
                </span>
              </div>
            </div>
          </div>

          {data.documents.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              No documents submitted yet for this application.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 shadow-2xs hover:border-[var(--border-subtle)] transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] font-mono text-[11px] font-black text-muted-foreground uppercase">
                        {doc.documentType.replace(/_/g, " ")}
                      </span>
                      {renderDocStatusBadge(doc.status)}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewDocument(doc)}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors cursor-pointer"
                      >
                        👁️ Preview
                      </button>

                      {doc.status !== "VERIFIED" && (
                        <button
                          type="button"
                          onClick={() => handleVerifyDocument(doc)}
                          disabled={pendingTransition}
                          className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          ✓ Verify
                        </button>
                      )}

                      {doc.status !== "REJECTED" && (
                        <button
                          type="button"
                          onClick={() => handleOpenRejectModal(doc)}
                          disabled={pendingTransition}
                          className="rounded-full border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenResubmitModal(doc)}
                        disabled={pendingTransition}
                        className="rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50 px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        🔄 Request Re-submission
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-[var(--muted-foreground)] block font-medium">File Name</span>
                      <span className="font-semibold text-muted-foreground truncate block">{doc.fileName}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block font-medium">Uploaded At</span>
                      <span className="font-mono text-muted-foreground">{new Date(doc.uploadedAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block font-medium">Expiry Date</span>
                      <span className="font-mono text-muted-foreground">
                        {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] block font-medium">File Size</span>
                      <span className="font-mono text-muted-foreground">
                        {doc.fileSize ? `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 7: INTERNAL REVIEWER NOTES */}
      {activeTab === "notes" && (
        <div className="space-y-6 text-xs">
          <form onSubmit={handleAddNote} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 shadow-2xs">
            <h4 className="font-semibold text-sm text-muted-foreground">Add Internal Reviewer Note</h4>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Internal notes are visible strictly to authorized administrators and reviewers.
            </p>
            <textarea
              rows={3}
              placeholder="Record information mismatch, compliance notes, or clarification required..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-3 outline-none"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pendingTransition || !newNoteContent.trim()}
                className="rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-5 py-2 font-semibold text-[var(--accent-foreground)] shadow-2xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                Post Review Note
              </button>
            </div>
          </form>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Internal Review Notes History</h4>
            {data.reviewNotes.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted-foreground)] bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
                No internal review notes posted yet.
              </div>
            ) : (
              data.reviewNotes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-muted-foreground">{note.authorName || note.authorEmail}</span>
                    <span className="font-mono text-[var(--muted-foreground)]">{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 7: REVIEW ACTIVITY & AUDIT LOG */}
      {activeTab === "activity" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4 text-xs">
          <h3 className="text-sm font-semibold text-muted-foreground border-b border-[var(--border-subtle)] pb-3">
            Application Review Activity Trail (Audit Logs)
          </h3>
          {data.activityLogs.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)] py-4 text-center">No recorded activity history yet.</p>
          ) : (
            <div className="space-y-3">
              {data.activityLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground text-xs">{log.action}</span>
                    <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                      {new Date(log.createdAt).toLocaleString("en-US")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{log.description}</p>
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Performed By: {log.actorEmail || "System"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PREVIEW DOCUMENT MODAL */}
      {previewDoc && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-base font-semibold">{previewDoc.fileName}</h3>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">{previewDoc.documentType}</span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-full border border-[var(--border)] hover:bg-[var(--surface-secondary)]"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-zinc-950/80 rounded-xl p-4 flex items-center justify-center min-h-[300px]">
              {securePreviewUrl ? (
                previewDoc.mimeType?.includes("image") ? (
                  <img src={securePreviewUrl} alt={previewDoc.fileName} className="max-h-[500px] object-contain rounded-lg" />
                ) : (
                  <div className="text-center space-y-3 text-white">
                    <p className="text-sm font-semibold">Document File Ready for Preview</p>
                    <a
                      href={securePreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-full bg-amber-400 text-black px-5 py-2 font-semibold text-xs"
                    >
                      Open Secure Document Link
                    </a>
                  </div>
                )
              ) : (
                <span className="text-white text-xs animate-pulse">Loading secure preview token...</span>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* REJECT DOCUMENT MODAL */}
      {rejectModalOpen && targetDoc && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-semibold text-rose-600">Reject Document</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Rejecting <strong className="text-muted-foreground">{targetDoc.fileName}</strong> ({targetDoc.documentType}). The host will be notified by email.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Standard Rejection Reason</label>
                <select
                  value={rejectionReasonSelect}
                  onChange={(e) => setRejectionReasonSelect(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                >
                  {STANDARD_REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Other">Other Custom Reason...</option>
                </select>
              </div>

              {rejectionReasonSelect === "Other" && (
                <div>
                  <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Specify Custom Reason</label>
                  <textarea
                    rows={3}
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* REQUEST RESUBMISSION MODAL */}
      {resubmitModalOpen && targetDoc && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-semibold text-amber-600">Request Document Re-submission</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Specify what is required for <strong className="text-muted-foreground">{targetDoc.documentType}</strong>.
            </p>

            <form onSubmit={handleResubmitSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Rejection / Defect Reason</label>
                <select
                  value={rejectionReasonSelect}
                  onChange={(e) => setRejectionReasonSelect(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                >
                  {STANDARD_REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Other">Other Custom Reason...</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Re-submission Instructions</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Please upload a clear copy of the identity document with all 4 corners visible."
                  value={resubmitInstructions}
                  onChange={(e) => setResubmitInstructions(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResubmitModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Send Re-submission Request
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* CREATE COMPLIANCE ISSUE MODAL */}
      {createIssueModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-semibold text-rose-600">Log Compliance Issue</h3>

            <form onSubmit={handleCreateIssueSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Issue Category / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Identity Name Mismatch, Sanctions Alert, Invalid Tax ID"
                  value={newIssueType}
                  onChange={(e) => setNewIssueType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Severity Level</label>
                <select
                  value={newIssueSeverity}
                  onChange={(e) => setNewIssueSeverity(e.target.value as any)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none font-semibold"
                >
                  <option value="LOW">Low Severity</option>
                  <option value="MEDIUM">Medium Severity</option>
                  <option value="HIGH">High Severity (Blocks Approval)</option>
                  <option value="CRITICAL">Critical Severity (Blocks Approval)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the discrepancy or compliance violation..."
                  value={newIssueDesc}
                  onChange={(e) => setNewIssueDesc(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateIssueModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Record Issue
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* REQUEST ADDITIONAL INFO MODAL */}
      {requestInfoModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-semibold text-amber-600">Request Additional Information from Host</h3>

            <form onSubmit={handleRequestInfoSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Information Required</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Updated Business Registration Certificate or Proof of Address..."
                  value={infoRequiredText}
                  onChange={(e) => setInfoRequiredText(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Reason for Request</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Current document submitted is blurry and expired."
                  value={infoReasonText}
                  onChange={(e) => setInfoReasonText(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Response Deadline (Optional)</label>
                <input
                  type="date"
                  value={infoDeadlineDate}
                  onChange={(e) => setInfoDeadlineDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestInfoModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Send Request & Email Host
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* APPLICATION APPROVAL MODAL */}
      {approvalModalOpen && eligibilityResult && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-5">
            <h3 className="text-xl font-black text-emerald-600">Final Application Approval Decision</h3>

            {eligibilityResult.eligible ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-xl border border-emerald-300 space-y-2">
                  <p className="font-semibold text-sm">✓ All Approval & Compliance Requirements Met!</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Applicant profile complete</li>
                    <li>Required documents verified</li>
                    <li>Mandatory compliance checks passed</li>
                    <li>No unresolved High/Critical compliance issues</li>
                  </ul>
                </div>

                <p className="text-[var(--muted-foreground)]">
                  Approving will automatically activate <strong>{data.applicantName}</strong>'s host user account, enabling full listing management access on Homyz.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setApprovalModalOpen(false)}
                    disabled={pendingTransition}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmApproval}
                    disabled={pendingTransition}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 font-black shadow-md cursor-pointer"
                  >
                    Confirm Approval & Activate Host
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 rounded-xl border border-rose-300 space-y-2">
                  <p className="font-semibold text-sm">✕ Approval Blocked: Missing Requirements</p>
                  <p>The following requirements must be resolved before this application can be approved:</p>
                  <ul className="list-disc pl-5 space-y-1 font-semibold text-rose-800 dark:text-rose-300">
                    {eligibilityResult.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setApprovalModalOpen(false)}
                    className="rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] px-5 py-2 font-semibold text-muted-foreground cursor-pointer"
                  >
                    Close & Fix Issues
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* APPLICATION REJECTION MODAL */}
      {appRejectModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-semibold text-rose-600">Reject Host Application</h3>

            <form onSubmit={handleConfirmApplicationRejection} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Primary Rejection Reason</label>
                <select
                  value={appRejectReason}
                  onChange={(e) => setAppRejectReason(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none font-semibold"
                >
                  {STANDARD_APPLICATION_REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Additional Explanation (Included in Host Email)</label>
                <textarea
                  rows={3}
                  placeholder="Provide specific explanation for the rejection..."
                  value={appRejectExplanation}
                  onChange={(e) => setAppRejectExplanation(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAppRejectModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 font-semibold shadow-2xs cursor-pointer"
                >
                  Confirm Rejection & Notify Host
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* REOPEN APPLICATION MODAL */}
      {reopenModalOpen && (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] text-muted-foreground p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-lg font-semibold text-indigo-600">Reopen Application</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Reopening will restore this application's status to <strong>In Review</strong> for further compliance investigation.
            </p>

            <form onSubmit={handleConfirmReopen} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--muted-foreground)] mb-1">Reason for Reopening</label>
                <textarea
                  rows={3}
                  placeholder="State the operational or compliance reason for reopening..."
                  value={reopenReasonText}
                  onChange={(e) => setReopenReasonText(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] text-muted-foreground p-2.5 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReopenModalOpen(false)}
                  disabled={pendingTransition}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-semibold text-muted-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pendingTransition}
                  className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 font-semibold shadow-2xs cursor-pointer"
                >
                  Confirm Reopen Application
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
