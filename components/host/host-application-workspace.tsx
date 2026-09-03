"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";

export interface HostDocItem {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  uploadedAt: string;
  rejectionReason: string | null;
  resubmissionRequested: boolean;
  resubmissionInstructions: string | null;
  version: number;
}

export interface HostApplicationData {
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
  status: string;
  onboardingStage: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason: string | null;
  documents: HostDocItem[];
  infoRequests: Array<{
    id: string;
    informationRequired: string;
    reason: string;
    deadline: string | null;
    status: string;
  }>;
}

export interface HostApplicationWorkspaceProps {
  initialData: {
    application: HostApplicationData;
    progress: {
      completedSections: number;
      totalSections: number;
      percent: number;
    };
    accountState: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED";
    message: string;
  };
}

const DOCUMENT_TYPES_CONFIG = [
  { value: "GOVERNMENT_ID", label: "Government Issued ID (Passport / Driver's License)", required: true },
  { value: "PROOF_OF_ADDRESS", label: "Proof of Address (Utility Bill / Bank Statement)", required: true },
  { value: "BUSINESS_LICENSE", label: "Business License / Registration", required: false },
  { value: "PROPERTY_DEED", label: "Property Deed / Lease Agreement", required: false },
  { value: "TAX_CERTIFICATE", label: "Tax Registration Certificate", required: false },
];

export function HostApplicationWorkspace({ initialData }: HostApplicationWorkspaceProps) {
  const router = useRouter();
  const [appState, setAppState] = useState(initialData);

  const { application, progress, accountState, message } = appState;

  // Active step for multi-step application form (1 to 6)
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form input state
  const [formData, setFormData] = useState({
    applicantName: application.applicantName || "",
    applicantEmail: application.applicantEmail || "",
    applicantPhone: application.applicantPhone || "",
    registrationType: application.registrationType || "INDIVIDUAL",
    businessName: application.businessName || "",
    propertyCount: application.propertyCount || 1,
    location: application.location || "",
    notes: application.notes || "",
  });

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertToHost = async () => {
    setIsConverting(true);
    try {
      const res = await fetch("/api/v1/host/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error?.message || "Failed to convert account to Host.");
      }
      toast.success("Congratulations! Your account has been converted to a Host account.");
      window.location.href = "/host/listings";
    } catch (err: any) {
      toast.error(err.message || "Failed to convert account.");
      setIsConverting(false);
    }
  };

  const [selectedDocType, setSelectedDocType] = useState<string>("GOVERNMENT_ID");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(accountState === "SUBMITTED");

  const showToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else toast.info(msg);
  };

  // Dynamic Real-time Application Completion Progress
  const liveCompletedSections = [
    Boolean(formData.applicantName.trim() && formData.applicantEmail.trim() && formData.applicantPhone.trim()),
    Boolean(formData.registrationType),
    Boolean(formData.location.trim() && formData.propertyCount >= 1),
    Boolean(
      application.documents &&
        application.documents.some((d) => d.documentType === "GOVERNMENT_ID") &&
        application.documents.some((d) => d.documentType === "PROOF_OF_ADDRESS")
    ),
    true, // Notes (Optional)
    accountState !== "DRAFT", // Application Submitted
  ].filter(Boolean).length;

  const liveProgressPercent = Math.round((liveCompletedSections / 6) * 100);

  // Re-fetch application data from API
  const refreshApplication = async () => {
    try {
      const res = await fetch("/api/v1/host/application");
      if (res.ok) {
        const payload = await res.json();
        if (payload.data) {
          setAppState(payload.data);
          const app = payload.data.application;
          setFormData({
            applicantName: app.applicantName || "",
            applicantEmail: app.applicantEmail || "",
            applicantPhone: app.applicantPhone || "",
            registrationType: app.registrationType || "INDIVIDUAL",
            businessName: app.businessName || "",
            propertyCount: app.propertyCount || 1,
            location: app.location || "",
            notes: app.notes || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to refresh application data:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/host/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draft",
          ...formData,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error?.message || "Failed to save draft.");
      }

      showToast("Draft saved successfully!", "success");
      await refreshApplication();
    } catch (err: any) {
      showToast(err.message || "Failed to save draft.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Step Validation Helpers
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.applicantName.trim()) errs.applicantName = "Full legal name is required.";
    if (!formData.applicantEmail.trim() || !formData.applicantEmail.includes("@")) errs.applicantEmail = "Valid email address is required.";
    if (!formData.applicantPhone.trim()) errs.applicantPhone = "Phone number is required.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      showToast("Please fill in all required personal info fields.", "error");
      return false;
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.location.trim()) errs.location = "Primary operating address/location is required.";
    if (formData.propertyCount < 1) errs.propertyCount = "Property count must be at least 1.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      showToast("Please enter operating address/location.", "error");
      return false;
    }
    return true;
  };

  const validateStep4 = (): boolean => {
    const docs = application.documents || [];
    const hasGovId = docs.some((d) => d.documentType === "GOVERNMENT_ID");
    const hasAddress = docs.some((d) => d.documentType === "PROOF_OF_ADDRESS");

    const errs: Record<string, string> = {};
    if (!hasGovId) errs.governmentId = "Government Issued ID is required.";
    if (!hasAddress) errs.proofOfAddress = "Proof of Address document is required.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      showToast("Please upload mandatory Government ID & Proof of Address documents.", "error");
      return false;
    }
    return true;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) setActiveStep(2);
  };

  const handleNextFromStep3 = () => {
    if (validateStep3()) setActiveStep(4);
  };

  const handleNextFromStep4 = () => {
    if (validateStep4()) setActiveStep(5);
  };

  // Document Upload
  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast("Please select a file to upload.", "error");
      return;
    }

    // Max file size: 10MB
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast("File size exceeds maximum allowed limit of 10MB.", "error");
      return;
    }

    // Allowed file types: PDF, PNG, JPG, JPEG, WEBP
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (selectedFile.type && !allowedTypes.includes(selectedFile.type)) {
      showToast("Invalid file type. Allowed formats: PDF, PNG, JPG, WEBP.", "error");
      return;
    }

    setIsUploading(true);
    try {
      const bodyData = new FormData();
      bodyData.append("file", selectedFile);
      bodyData.append("documentType", selectedDocType);

      const res = await fetch("/api/v1/host/application/documents", {
        method: "POST",
        body: bodyData,
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error?.message || "Upload failed.");
      }

      showToast(`Document uploaded successfully!`, "success");
      setSelectedFile(null);
      // clear doc field errors if resolved
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.governmentId;
        delete next.proofOfAddress;
        return next;
      });
      await refreshApplication();
    } catch (err: any) {
      showToast(err.message || "Upload failed.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Document
  const handleRemoveDocument = async (documentId: string) => {
    if (!confirm("Are you sure you want to remove this document?")) return;

    try {
      const res = await fetch(`/api/v1/host/application/documents?documentId=${encodeURIComponent(documentId)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error?.message || "Failed to remove document.");
      }

      showToast("Document removed.", "info");
      await refreshApplication();
    } catch (err: any) {
      showToast(err.message || "Failed to remove document.", "error");
    }
  };

  // Submit Application
  const handleSubmitApplication = async () => {
    const errs: Record<string, string> = {};

    if (!formData.applicantName.trim()) errs.applicantName = "Full name is required.";
    if (!formData.applicantEmail.trim()) errs.applicantEmail = "Valid email is required.";
    if (!formData.applicantPhone.trim()) errs.applicantPhone = "Phone number is required.";
    if (!formData.location.trim()) errs.location = "Location/address is required.";
    if (formData.propertyCount < 1) errs.propertyCount = "Property count must be at least 1.";

    const docs = application.documents || [];
    const hasGovId = docs.some((d) => d.documentType === "GOVERNMENT_ID");
    const hasAddress = docs.some((d) => d.documentType === "PROOF_OF_ADDRESS");

    if (!hasGovId) errs.governmentId = "Government ID document is required.";
    if (!hasAddress) errs.proofOfAddress = "Proof of Address document is required.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      showToast("Please correct the missing required fields before submitting.", "error");
      setActiveStep(6); // Stay on step 6 to show prominent error summary & fix buttons
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/host/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          ...formData,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error?.message || "Submission failed.");
      }

      showToast("Application submitted successfully!", "success");
      setSubmittedSuccess(true);
      await refreshApplication();
    } catch (err: any) {
      showToast(err.message || "Submission failed.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resubmit Application (after action required)
  const handleResubmit = async () => {
    setIsResubmitting(true);
    try {
      const res = await fetch("/api/v1/host/application/resubmit", {
        method: "POST",
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error?.message || "Resubmission failed.");
      }

      showToast("Application resubmitted for review!", "success");
      await refreshApplication();
    } catch (err: any) {
      showToast(err.message || "Resubmission failed.", "error");
    } finally {
      setIsResubmitting(false);
    }
  };

  // Visual Onboarding Timeline stages
  const onboardingStepsTimeline = [
    { key: "REGISTRATION", label: "Registration" },
    { key: "SUBMITTED", label: "Application Submitted" },
    { key: "DOCUMENTS", label: "Documents Verification" },
    { key: "ADMIN_REVIEW", label: "Admin Review" },
    { key: "COMPLIANCE", label: "Compliance Review" },
    { key: "APPROVAL", label: "Approval Decision" },
    { key: "COMPLETE", label: "Onboarding Complete" },
  ];

  const getTimelineStatus = (stepKey: string) => {
    const stage = application.onboardingStage || "DRAFT";
    const status = application.status || accountState;
    const isDraft = stage === "DRAFT" || accountState === "DRAFT";

    if (status === "APPROVED" || stage === "ONBOARDING_COMPLETE") {
      return "completed";
    }

    if (status === "REJECTED") {
      if (stepKey === "APPROVAL") return "failed";
      return "completed";
    }

    if (status === "ACTION_REQUIRED" || accountState === "ACTION_REQUIRED") {
      if (stepKey === "DOCUMENTS" || stepKey === "COMPLIANCE") return "action_required";
    }

    switch (stepKey) {
      case "REGISTRATION":
        return "completed";

      case "SUBMITTED":
        return !isDraft ? "completed" : "pending";

      case "DOCUMENTS": {
        const docs = application.documents || [];
        const hasRejected = docs.some((d) => d.status === "REJECTED");
        const allVerified = docs.length >= 2 && docs.every((d) => d.status === "VERIFIED");
        if (hasRejected) return "action_required";
        if (allVerified) return "completed";
        if (!isDraft || docs.length > 0) return "in_progress";
        return "pending";
      }

      case "ADMIN_REVIEW":
        if (isDraft) return "pending";
        if (["COMPLIANCE_REVIEW", "READY_FOR_APPROVAL", "ONBOARDING_COMPLETE"].includes(stage) || status === "APPROVED") {
          return "completed";
        }
        if (["APPLICATION_REVIEW", "DOCUMENT_VERIFICATION", "REGISTRATION_SUBMITTED"].includes(stage) || status === "IN_REVIEW" || status === "SUBMITTED") {
          return "in_progress";
        }
        return "pending";

      case "COMPLIANCE":
        if (isDraft) return "pending";
        if (["READY_FOR_APPROVAL", "ONBOARDING_COMPLETE"].includes(stage) || status === "APPROVED") {
          return "completed";
        }
        if (stage === "COMPLIANCE_REVIEW") {
          return "in_progress";
        }
        return "pending";

      case "APPROVAL":
        if (isDraft) return "pending";
        if (status === "APPROVED" || stage === "ONBOARDING_COMPLETE") {
          return "completed";
        }
        if (["READY_FOR_APPROVAL", "APPROVAL_REVIEW"].includes(stage)) {
          return "in_progress";
        }
        return "pending";

      case "COMPLETE":
        if (isDraft) return "pending";
        if (status === "APPROVED" || stage === "ONBOARDING_COMPLETE") {
          return "completed";
        }
        return "pending";

      default:
        return "pending";
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 sm:p-8 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#FBDE9B] px-3 py-1 text-xs font-extrabold text-[#291E05] shadow-xs dark:bg-amber-500 dark:text-zinc-950">
                Host Onboarding Portal
              </span>
              <span className="text-xs font-medium text-[var(--muted-foreground)]">
                Application ID: {application.applicationId}
              </span>
            </div>
            <h1 className="mt-2">
              Become a Homyz Host
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Register your properties, complete verification, and join our global hosting community.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {accountState === "DRAFT" && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving || isConverting}
                  className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-muted-foreground shadow-xs transition-all hover:bg-[var(--muted)] disabled:opacity-50"
                >
                  {isSaving ? "Saving Draft..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleConvertToHost}
                  disabled={isSaving || isConverting}
                  className="inline-flex items-center rounded-full bg-[#FBDE9B] hover:bg-amber-400 px-5 py-2 text-xs font-extrabold text-[#291E05] shadow-sm transition-all disabled:opacity-50"
                >
                  {isConverting ? "Converting Account..." : "⚡ Become a Host Now"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar (Only for Draft or Submission flow) */}
        {accountState === "DRAFT" && (
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>Application Completion</span>
              <span>
                {liveCompletedSections} / 6 sections completed ({liveProgressPercent}%)
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full bg-gradient-to-r from-[#FBDE9B] to-amber-500 transition-all duration-500"
                style={{ width: `${liveProgressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Onboarding Stage Tracker (Visible on all states) */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Onboarding Workflow Progress
          </h2>
          <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            Stage: {(application.onboardingStage || accountState).replace(/_/g, " ")}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {onboardingStepsTimeline.map((st, idx) => {
            const status = getTimelineStatus(st.key);

            return (
              <div
                key={st.key}
                onClick={() => {
                  if (st.key === "REGISTRATION") setActiveStep(1);
                  else if (st.key === "SUBMITTED") setActiveStep(6);
                  else if (st.key === "DOCUMENTS" || st.key === "COMPLIANCE") setActiveStep(4);
                  else setActiveStep(6);
                }}
                className={`relative flex flex-col items-center justify-between min-h-[115px] rounded-2xl border p-3 text-center transition-all cursor-pointer select-none hover:shadow-md ${
                  status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : status === "action_required"
                    ? "border-rose-500/50 bg-rose-500/10 animate-pulse"
                    : status === "in_progress"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : status === "failed"
                    ? "border-rose-500/50 bg-rose-500/10"
                    : "border-[var(--border)] bg-[var(--surface-secondary)]/50"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold border shadow-2xs ${
                    status === "completed"
                      ? "bg-emerald-500 text-white border-emerald-600"
                      : status === "action_required"
                      ? "bg-rose-500 text-white border-rose-600"
                      : status === "in_progress"
                      ? "bg-amber-500 text-white border-amber-600"
                      : "bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]"
                  }`}
                >
                  {status === "completed" ? "✓" : status === "action_required" ? "!" : status === "in_progress" ? "●" : idx + 1}
                </div>

                <span className="mt-1.5 text-[11px] font-bold leading-tight text-muted-foreground">
                  {st.label}
                </span>

                <span
                  className={`mt-1.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                    status === "completed"
                      ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                      : status === "action_required"
                      ? "bg-rose-500/20 text-rose-800 dark:text-rose-300 font-black"
                      : status === "in_progress"
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                      : status === "failed"
                      ? "bg-rose-500/20 text-rose-800 dark:text-rose-300"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {status === "completed"
                    ? "Done"
                    : status === "action_required"
                    ? "Action Needed"
                    : status === "in_progress"
                    ? "In Review"
                    : status === "failed"
                    ? "Rejected"
                    : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Required Banner (If Admin requested changes or rejected docs) */}
      {accountState === "ACTION_REQUIRED" && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-6 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white font-black">
              !
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-rose-700 dark:text-rose-400">
                Action Required on Your Application
              </h3>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                Our verification team has requested updates or document re-submissions before your application can proceed.
              </p>

              {/* Show rejected documents */}
              {application.documents.filter((d) => d.status === "REJECTED" || d.resubmissionRequested).map((doc) => (
                <div key={doc.id} className="mt-3 rounded-2xl border border-rose-500/30 bg-[var(--surface)] p-3 text-xs">
                  <p className="font-bold text-muted-foreground">
                    Document: <span className="text-rose-600 dark:text-rose-400">{doc.documentType.replace(/_/g, " ")}</span>
                  </p>
                  <p className="mt-0.5 text-[var(--muted-foreground)]">
                    Reason: <span className="font-semibold text-rose-600 dark:text-rose-400">{doc.rejectionReason || "Re-submission requested"}</span>
                  </p>
                  {doc.resubmissionInstructions && (
                    <p className="mt-0.5 text-[var(--muted-foreground)]">
                      Instructions: <span className="italic">{doc.resubmissionInstructions}</span>
                    </p>
                  )}
                </div>
              ))}

              {/* Show info requests */}
              {application.infoRequests.filter((i) => i.status === "PENDING").map((info) => (
                <div key={info.id} className="mt-3 rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-3 text-xs">
                  <p className="font-bold text-amber-600 dark:text-amber-400">Information Required: {info.informationRequired}</p>
                  <p className="mt-0.5 text-[var(--muted-foreground)]">Reason: {info.reason}</p>
                </div>
              ))}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
                >
                  Upload New Document
                </button>

                <button
                  type="button"
                  onClick={handleResubmit}
                  disabled={isResubmitting}
                  className="rounded-full bg-[#FBDE9B] px-4 py-2 text-xs font-extrabold text-[#291E05] shadow-xs hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950"
                >
                  {isResubmitting ? "Resubmitting..." : "Resubmit Application"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Screen After Submission */}
      {(accountState === "SUBMITTED" || submittedSuccess) && accountState !== "APPROVED" && accountState !== "ACTION_REQUIRED" && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center backdrop-blur-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white shadow-lg">
            ✓
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-muted-foreground">Application Submitted Successfully!</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
            Your host registration application <strong className="text-muted-foreground">{application.applicationId}</strong> has been received.
          </p>

          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-2xs">
            <div className="flex justify-between border-b border-[var(--border)] pb-2 text-xs">
              <span className="text-[var(--muted-foreground)]">Application ID:</span>
              <span className="font-bold text-muted-foreground">{application.applicationId}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] py-2 text-xs">
              <span className="text-[var(--muted-foreground)]">Status:</span>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                {application.status || "Submitted / In Review"}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-xs">
              <span className="text-[var(--muted-foreground)]">Next Step:</span>
              <span className="font-semibold text-muted-foreground">Admin Review & Compliance</span>
            </div>
          </div>

          <p className="mt-6 text-xs text-[var(--muted-foreground)]">
            Our verification team will inspect your submitted documents. You will receive an email update as soon as review is completed.
          </p>
        </div>
      )}

      {/* Approved Host Card */}
      {accountState === "APPROVED" && (
        <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white shadow-lg">
            🎉
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">Host Application Approved!</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
            Your host account is fully activated. You can now start creating and publishing listings on Homyz.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/host/listings"
              className="rounded-full bg-[#FBDE9B] px-6 py-2.5 text-xs font-extrabold text-[#291E05] shadow-md transition-all hover:scale-102 dark:bg-amber-500 dark:text-zinc-950"
            >
              Go to Host Portal & Listings
            </Link>
          </div>
        </div>
      )}

      {/* Rejected Application Card */}
      {accountState === "REJECTED" && (
        <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-2xl font-bold text-white shadow-lg">
            ✕
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-rose-700 dark:text-rose-400">Application Not Approved</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
            We are unable to approve your application at this time.
          </p>
          {application.rejectionReason && (
            <div className="mx-auto mt-4 max-w-md rounded-2xl border border-rose-500/30 bg-[var(--surface)] p-4 text-xs font-medium text-rose-600 dark:text-rose-400">
              Reason: {application.rejectionReason}
            </div>
          )}
        </div>
      )}

      {/* Multi-Step Application Form */}
      {(accountState === "DRAFT" || accountState === "ACTION_REQUIRED" || accountState === "SUBMITTED" || accountState === "IN_REVIEW") && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          {/* Stepper Tabs */}
          <div className="mb-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-4">
            {[
              { num: 1, title: "1. Personal" },
              { num: 2, title: "2. Business" },
              { num: 3, title: "3. Address & Property" },
              { num: 4, title: "4. Documents Upload" },
              { num: 5, title: "5. Notes" },
              { num: 6, title: "6. Review & Submit" },
            ].map((st) => (
              <button
                key={st.num}
                type="button"
                onClick={() => setActiveStep(st.num)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                  activeStep === st.num
                    ? "bg-[#FBDE9B] text-[#291E05] shadow-xs dark:bg-amber-500 dark:text-zinc-950"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {st.title}
              </button>
            ))}
          </div>

          {/* STEP 1: Personal Information */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold text-muted-foreground">Step 1: Personal Information</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground">Full Legal Name *</label>
                  <input
                    type="text"
                    name="applicantName"
                    value={formData.applicantName}
                    onChange={handleInputChange}
                    placeholder="e.g. John Smith"
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                  {fieldErrors.applicantName && <p className="mt-1 text-[11px] text-rose-500">{fieldErrors.applicantName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground">Email Address *</label>
                  <input
                    type="email"
                    name="applicantEmail"
                    value={formData.applicantEmail}
                    onChange={handleInputChange}
                    placeholder="e.g. john@example.com"
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                  {fieldErrors.applicantEmail && <p className="mt-1 text-[11px] text-rose-500">{fieldErrors.applicantEmail}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground">Phone Number *</label>
                  <input
                    type="tel"
                    name="applicantPhone"
                    value={formData.applicantPhone}
                    onChange={handleInputChange}
                    placeholder="e.g. +1 (555) 019-2834"
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                  {fieldErrors.applicantPhone && <p className="mt-1 text-[11px] text-rose-500">{fieldErrors.applicantPhone}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleNextFromStep1}
                  className="rounded-full bg-[#FBDE9B] px-6 py-2 text-xs font-extrabold text-[#291E05] hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Next: Business Info →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Business Information */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold text-muted-foreground">Step 2: Business & Host Type</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground">Host Registration Type *</label>
                  <select
                    name="registrationType"
                    value={formData.registrationType}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  >
                    <option value="INDIVIDUAL">Individual Owner</option>
                    <option value="BUSINESS">Registered Business / LLC</option>
                    <option value="PROPERTY_MANAGER">Property Management Agency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground">Business Name (Optional)</label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    placeholder="e.g. Apex Hospitality Group"
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="rounded-full border border-[var(--border)] px-6 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--muted)]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="rounded-full bg-[#FBDE9B] px-6 py-2 text-xs font-extrabold text-[#291E05] hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Next: Address & Property →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Address & Property Details */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold text-muted-foreground">Step 3: Address & Property Information</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-muted-foreground">Primary Property / Operating Address *</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. 100 Ocean Drive, Miami Beach, FL 33139"
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                  {fieldErrors.location && <p className="mt-1 text-[11px] text-rose-500">{fieldErrors.location}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground">Number of Properties to List *</label>
                  <input
                    type="number"
                    name="propertyCount"
                    min={1}
                    max={500}
                    value={formData.propertyCount}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2.5 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                  />
                  {fieldErrors.propertyCount && <p className="mt-1 text-[11px] text-rose-500">{fieldErrors.propertyCount}</p>}
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="rounded-full border border-[var(--border)] px-6 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--muted)]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNextFromStep3}
                  className="rounded-full bg-[#FBDE9B] px-6 py-2 text-xs font-extrabold text-[#291E05] hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Next: Documents Upload →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Document Verification Upload */}
          {activeStep === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold text-muted-foreground">Step 4: Upload Verification Documents</h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Upload clear digital copies of your identity and property ownership documents (Accepted: PDF, PNG, JPG, WEBP. Max: 10MB per file).
              </p>

              {/* Upload Form Box */}
              <form onSubmit={handleDocumentUpload} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground">Select Document Type *</label>
                    <select
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                    >
                      {DOCUMENT_TYPES_CONFIG.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label} {d.required ? "(Required)" : "(Optional)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground">Select File *</label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-muted-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-[#FBDE9B] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[#291E05]"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUploading || !selectedFile}
                    className="rounded-full bg-[#FBDE9B] px-5 py-2 text-xs font-extrabold text-[#291E05] shadow-xs hover:bg-amber-400 disabled:opacity-50 dark:bg-amber-500 dark:text-zinc-950"
                  >
                    {isUploading ? "Uploading..." : "Upload Document"}
                  </button>
                </div>
              </form>

              {fieldErrors.governmentId && <p className="text-xs text-rose-500">{fieldErrors.governmentId}</p>}
              {fieldErrors.proofOfAddress && <p className="text-xs text-rose-500">{fieldErrors.proofOfAddress}</p>}

              {/* Uploaded Documents List */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Uploaded Documents ({application.documents?.length || 0})
                </h4>

                {(!application.documents || application.documents.length === 0) ? (
                  <p className="text-xs text-[var(--muted-foreground)] italic">No documents uploaded yet.</p>
                ) : (
                  application.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-muted-foreground">{doc.documentType.replace(/_/g, " ")}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              doc.status === "VERIFIED"
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : doc.status === "REJECTED"
                                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {doc.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                          File: {doc.fileName} • {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                        {doc.rejectionReason && (
                          <p className="mt-0.5 text-[11px] text-rose-500 font-semibold">
                            Rejection Note: {doc.rejectionReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-[var(--muted)]"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(doc.id)}
                          className="rounded-xl border border-rose-500/30 px-3 py-1 text-[11px] font-semibold text-rose-500 hover:bg-rose-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="rounded-full border border-[var(--border)] px-6 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--muted)]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNextFromStep4}
                  className="rounded-full bg-[#FBDE9B] px-6 py-2 text-xs font-extrabold text-[#291E05] hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Next: Notes →
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Notes & Additional Info */}
          {activeStep === 5 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold text-muted-foreground">Step 5: Additional Information / Notes</h3>

              <div>
                <label className="block text-xs font-bold text-muted-foreground">Notes for Review Team (Optional)</label>
                <textarea
                  name="notes"
                  rows={4}
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Mention any special details about your properties, hosting experience, or questions..."
                  className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-xs text-muted-foreground focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="rounded-full border border-[var(--border)] px-6 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--muted)]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep(6)}
                  className="rounded-full bg-[#FBDE9B] px-6 py-2 text-xs font-extrabold text-[#291E05] hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950"
                >
                  Review & Submit →
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Review & Submit */}
          {activeStep === 6 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h3 className="text-lg font-bold text-muted-foreground">Step 6: Review Application Summary</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Review all information before submitting your application to the administrative team.
                </p>
              </div>

              {/* Validation Warning Alert Banner if any required fields are missing */}
              {Object.keys(fieldErrors).length > 0 && (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400 text-sm">
                    <span>⚠️ Cannot Submit Application — Missing Required Fields</span>
                  </div>
                  <p className="mt-1 text-rose-600 dark:text-rose-300">
                    Please complete all required fields highlighted below before submitting:
                  </p>
                  <ul className="mt-3 space-y-1.5 border-t border-rose-500/20 pt-3">
                    {fieldErrors.applicantName && (
                      <li className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                        <span>• Full Legal Name is required</span>
                        <button type="button" onClick={() => setActiveStep(1)} className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700">
                          Edit Step 1 →
                        </button>
                      </li>
                    )}
                    {fieldErrors.applicantEmail && (
                      <li className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                        <span>• Valid Email Address is required</span>
                        <button type="button" onClick={() => setActiveStep(1)} className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700">
                          Edit Step 1 →
                        </button>
                      </li>
                    )}
                    {fieldErrors.applicantPhone && (
                      <li className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                        <span>• Phone Number is required</span>
                        <button type="button" onClick={() => setActiveStep(1)} className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700">
                          Edit Step 1 →
                        </button>
                      </li>
                    )}
                    {fieldErrors.location && (
                      <li className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                        <span>• Operating Address / Location is required</span>
                        <button type="button" onClick={() => setActiveStep(3)} className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700">
                          Edit Step 3 →
                        </button>
                      </li>
                    )}
                    {fieldErrors.governmentId && (
                      <li className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                        <span>• Government Issued ID document is required</span>
                        <button type="button" onClick={() => setActiveStep(4)} className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700">
                          Upload in Step 4 →
                        </button>
                      </li>
                    )}
                    {fieldErrors.proofOfAddress && (
                      <li className="flex items-center justify-between font-semibold text-rose-700 dark:text-rose-300">
                        <span>• Proof of Address document is required</span>
                        <button type="button" onClick={() => setActiveStep(4)} className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-rose-700">
                          Upload in Step 4 →
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Summary Box 1: Personal & Contact */}
                <div className={`rounded-2xl border p-4 ${!formData.applicantName || !formData.applicantPhone ? "border-rose-500/40 bg-rose-500/5" : "border-[var(--border)] bg-[var(--surface-secondary)]/30"}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase text-muted-foreground">Personal & Contact</h4>
                    <button onClick={() => setActiveStep(1)} className="text-[11px] font-bold text-amber-600 hover:underline">
                      Edit
                    </button>
                  </div>
                  <div className="mt-2 text-xs space-y-1.5 text-[var(--muted-foreground)]">
                    <p className="flex items-center justify-between">
                      <strong className="text-muted-foreground">Name:</strong>
                      {formData.applicantName.trim() ? (
                        <span>{formData.applicantName}</span>
                      ) : (
                        <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                          Missing (Required)
                        </span>
                      )}
                    </p>
                    <p className="flex items-center justify-between">
                      <strong className="text-muted-foreground">Email:</strong>
                      {formData.applicantEmail.trim() ? (
                        <span>{formData.applicantEmail}</span>
                      ) : (
                        <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                          Missing (Required)
                        </span>
                      )}
                    </p>
                    <p className="flex items-center justify-between">
                      <strong className="text-muted-foreground">Phone:</strong>
                      {formData.applicantPhone.trim() ? (
                        <span>{formData.applicantPhone}</span>
                      ) : (
                        <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                          Missing (Required)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Summary Box 2: Business & Properties */}
                <div className={`rounded-2xl border p-4 ${!formData.location ? "border-rose-500/40 bg-rose-500/5" : "border-[var(--border)] bg-[var(--surface-secondary)]/30"}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase text-muted-foreground">Business & Properties</h4>
                    <button onClick={() => setActiveStep(2)} className="text-[11px] font-bold text-amber-600 hover:underline">
                      Edit
                    </button>
                  </div>
                  <div className="mt-2 text-xs space-y-1.5 text-[var(--muted-foreground)]">
                    <p className="flex items-center justify-between"><strong className="text-muted-foreground">Host Type:</strong> <span>{formData.registrationType}</span></p>
                    <p className="flex items-center justify-between"><strong className="text-muted-foreground">Business:</strong> <span>{formData.businessName || "Individual"}</span></p>
                    <p className="flex items-center justify-between"><strong className="text-muted-foreground">Property Count:</strong> <span>{formData.propertyCount}</span></p>
                    <p className="flex items-center justify-between">
                      <strong className="text-muted-foreground">Location:</strong>
                      {formData.location.trim() ? (
                        <span>{formData.location}</span>
                      ) : (
                        <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                          Missing (Required)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Summary Box 3: Uploaded Documents */}
                <div className="sm:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/30 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase text-muted-foreground">
                      Uploaded Documents ({application.documents?.length || 0})
                    </h4>
                    <button onClick={() => setActiveStep(4)} className="text-[11px] font-bold text-amber-600 hover:underline">
                      Manage Documents
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {application.documents?.map((d) => (
                      <span key={d.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        ✓ {d.documentType.replace(/_/g, " ")} ({d.fileName})
                      </span>
                    ))}
                    {(!application.documents || !application.documents.some((d) => d.documentType === "GOVERNMENT_ID")) && (
                      <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-500">
                        ✕ Missing: Government ID (Required)
                      </span>
                    )}
                    {(!application.documents || !application.documents.some((d) => d.documentType === "PROOF_OF_ADDRESS")) && (
                      <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-500">
                        ✕ Missing: Proof of Address (Required)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  className="rounded-full border border-[var(--border)] px-6 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--muted)]"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={isSubmitting}
                  className="rounded-full bg-[#FBDE9B] px-8 py-3 text-xs font-extrabold text-[#291E05] shadow-md transition-all hover:scale-102 disabled:opacity-50 dark:bg-amber-500 dark:text-zinc-950"
                >
                  {isSubmitting ? "Submitting Application..." : "Submit Application"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
