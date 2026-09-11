"use client";

import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
import { toast } from "@/components/ui/toast";
import {
  submitListingForReviewAction,
  resubmitListingForReviewAction,
  unpublishListingAction,
  publishListingAction,
} from "@/actions/host/listings";
import type { HostListingData } from "../host-listing-editor-client";

export interface MissingRequirement {
  key: string;
  label: string;
  description: string;
  section: string;
}

export function computeMissingRequirements(listing: Partial<HostListingData>): MissingRequirement[] {
  const missing: MissingRequirement[] = [];
  if (!listing) return missing;

  if (!listing.propertyType || !listing.listingType) {
    missing.push({
      key: "propertyType",
      label: "Property & place type",
      description: "Select property category and listing type (e.g. Entire home)",
      section: "basics",
    });
  }

  const hasAddress = Boolean(listing.address && listing.city && listing.country);
  const hasCoordinates =
    listing.latitude !== null &&
    listing.latitude !== undefined &&
    listing.longitude !== null &&
    listing.longitude !== undefined;
  if (!hasAddress || !hasCoordinates) {
    missing.push({
      key: "location",
      label: "Address & Map location",
      description: "Enter full street address and verify pin coordinates on the map",
      section: "location",
    });
  }

  const photoCount = Array.isArray(listing.photos) ? listing.photos.length : 0;
  if (photoCount < 5) {
    missing.push({
      key: "photos",
      label: "Property photos (min 5)",
      description: `Uploaded ${photoCount} of 5 required photos`,
      section: "photos",
    });
  }

  const titleLength = typeof listing.title === "string" ? listing.title.trim().length : 0;
  if (titleLength < 3 || titleLength > 50) {
    missing.push({
      key: "title",
      label: "Listing title",
      description: "Create a descriptive title between 3 and 50 characters",
      section: "title",
    });
  }

  const descLength = typeof listing.description === "string" ? listing.description.trim().length : 0;
  if (descLength < 10) {
    missing.push({
      key: "description",
      label: "Listing description",
      description: "Write at least 10 characters describing the space",
      section: "description",
    });
  }

  const price = Number(listing.price || 0);
  if (price <= 0) {
    missing.push({
      key: "price",
      label: "Base nightly price",
      description: "Specify a standard weekday base price",
      section: "pricing",
    });
  }

  const weekendPrice = Number(listing.weekendPrice || 0);
  if (weekendPrice <= 0) {
    missing.push({
      key: "weekendPrice",
      label: "Weekend nightly price",
      description: "Set a weekend price or premium for Friday/Saturday",
      section: "pricing",
    });
  }

  const rawDisclosures = Array.isArray(listing.safetyDisclosures) ? listing.safetyDisclosures : [];
  const safetyMap = new Map<string, string>();
  for (const item of rawDisclosures) {
    if (typeof item === "string") {
      const [k, v] = item.split(":");
      if (k && v) safetyMap.set(k, v);
    }
  }
  const requiredSafetyKeys = ["SECURITY_CAMERA", "NOISE_MONITOR", "WEAPONS"];
  const missingSafety = requiredSafetyKeys.filter(
    (k) => safetyMap.get(k) !== "YES" && safetyMap.get(k) !== "NO",
  );
  if (missingSafety.length > 0) {
    missing.push({
      key: "safetyDisclosures",
      label: "Safety disclosures",
      description: "Answer required disclosures (cameras, noise monitors, weapons)",
      section: "guest-safety",
    });
  }

  return missing;
}

export type ListingDisplayState =
  | "DRAFT"
  | "READY_TO_SUBMIT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

export function getListingDisplayState(
  status?: string | null,
  published?: boolean | null,
  missingCount: number = 0,
): ListingDisplayState {
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") {
    return "REJECTED";
  }
  if (status === "PENDING_REVIEW") {
    return "PENDING_APPROVAL";
  }
  if (status === "ACTIVE" && published) {
    return "PUBLISHED";
  }
  if (status === "APPROVED" || (status === "ACTIVE" && !published)) {
    return "APPROVED";
  }
  if (missingCount === 0) {
    return "READY_TO_SUBMIT";
  }
  return "DRAFT";
}

export interface ListingStatusViewProps {
  listing?: HostListingData;
  setActiveSection: (section: any) => void;
  onUpdateListing?: (updated: Partial<HostListingData>) => void;
  status?: "listed" | "unlisted";
  setStatus?: (status: "listed" | "unlisted") => void;
  isSaving?: boolean;
  handleSaveSection?: (key: any) => void;
}

export function ListingStatusView({
  listing,
  setActiveSection,
  onUpdateListing,
  status: propStatus,
  setStatus: propSetStatus,
  isSaving = false,
  handleSaveSection,
}: ListingStatusViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  const missing = computeMissingRequirements(listing || {});
  const displayState = getListingDisplayState(
    listing?.status,
    listing?.published,
    missing.length,
  );

  const isApproved = displayState === "APPROVED" || displayState === "PUBLISHED";

  const [localStatus, setLocalStatus] = useState<"listed" | "unlisted">(
    listing?.published ? "listed" : propStatus || "unlisted",
  );

  // If unapproved, effective status is ALWAYS unlisted
  const effectiveStatus: "listed" | "unlisted" = !isApproved
    ? "unlisted"
    : (propStatus ?? localStatus);

  useEffect(() => {
    if (listing?.submittedAt) {
      try {
        const d = new Date(listing.submittedAt);
        if (!isNaN(d.getTime())) {
          setFormattedDate(
            d.toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      } catch {
        setFormattedDate(null);
      }
    }
  }, [listing?.submittedAt]);

  // Stepper definition
  const steps = [
    { id: "created", label: "Listing Created" },
    { id: "completed", label: "Details Completed" },
    { id: "submitted", label: "Submitted" },
    { id: "review", label: "Admin Review" },
    { id: "approved", label: "Approved" },
    { id: "published", label: "Published" },
  ];

  const getStepStatus = (stepId: string): "completed" | "current" | "upcoming" | "warning" => {
    switch (displayState) {
      case "DRAFT":
        if (stepId === "created") return "completed";
        if (stepId === "completed") return "current";
        return "upcoming";
      case "READY_TO_SUBMIT":
        if (stepId === "created" || stepId === "completed") return "completed";
        if (stepId === "submitted") return "current";
        return "upcoming";
      case "PENDING_APPROVAL":
        if (stepId === "created" || stepId === "completed" || stepId === "submitted") return "completed";
        if (stepId === "review") return "current";
        return "upcoming";
      case "REJECTED":
        if (stepId === "created" || stepId === "completed" || stepId === "submitted") return "completed";
        if (stepId === "review") return "warning";
        return "upcoming";
      case "APPROVED":
        if (stepId === "published") return "upcoming";
        return "completed";
      case "PUBLISHED":
        return "completed";
    }
  };

  const handleSelectStatus = (target: "listed" | "unlisted") => {
    if (!isApproved && target === "listed") {
      toast.error(
        "Admin approval required: Your listing must be reviewed and approved by an administrator before it can be listed publicly.",
      );
      return;
    }
    if (propSetStatus) {
      propSetStatus(target);
    } else {
      setLocalStatus(target);
    }
  };

  const handleSubmitForReview = async () => {
    if (!listing) return;
    setIsSubmitting(true);
    try {
      const res = await submitListingForReviewAction(listing.id);
      setIsSubmitting(false);
      if (res.ok && res.data) {
        setJustSubmitted(true);
        onUpdateListing?.({
          status: "PENDING_REVIEW",
          published: false,
          submittedAt: new Date().toISOString(),
        });
        toast.success("Listing submitted successfully for Admin review!");
      } else {
        toast.error((res as any).error || "Failed to submit listing. Please ensure all required fields are complete.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error("Error submitting listing: " + err.message);
    }
  };

  const handleResubmitForReview = async () => {
    if (!listing) return;
    setIsSubmitting(true);
    try {
      const res = await resubmitListingForReviewAction(listing.id);
      setIsSubmitting(false);
      if (res.ok && res.data) {
        setJustSubmitted(true);
        onUpdateListing?.({
          status: "PENDING_REVIEW",
          published: false,
          resubmittedAt: new Date().toISOString(),
          requestedChanges: null,
          rejectionReason: null,
        });
        toast.success("Listing resubmitted successfully for Admin review!");
      } else {
        toast.error((res as any).error || "Failed to resubmit listing.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error("Error resubmitting listing: " + err.message);
    }
  };

  const handleSave = async () => {
    if (!isApproved) {
      toast.error("Admin approval required before changing to Listed status.");
      return;
    }
    if (handleSaveSection) {
      await handleSaveSection("listing-status");
      toast.success("Listing status updated successfully!");
    } else if (listing) {
      setIsSubmitting(true);
      try {
        if (effectiveStatus === "listed") {
          const res = await publishListingAction(listing.id);
          setIsSubmitting(false);
          if (res.ok && res.data) {
            onUpdateListing?.({ published: true, status: "ACTIVE" });
            toast.success("Listing published successfully!");
          } else {
            toast.error((res as any).error || "Failed to publish listing.");
          }
        } else {
          const res = await unpublishListingAction(listing.id);
          setIsSubmitting(false);
          if (res.ok && res.data) {
            onUpdateListing?.({ published: false, status: "DRAFT" });
            toast.success("Listing unpublished successfully.");
          } else {
            toast.error((res as any).error || "Failed to unpublish listing.");
          }
        }
      } catch (err: any) {
        setIsSubmitting(false);
        toast.error("Error updating listing status: " + err.message);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl pb-12 font-sans">
      {/* Header & Back Navigation */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <h1 className="tracking-tight text-2xl font-semibold text-[#1F1F1F]">Listing status</h1>
      </div>

      {/* Visual Approval Progress Stepper */}
      <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/60 p-4 sm:p-5 shadow-2xs">
        <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-3">
          Approval &amp; Publishing Progress
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {steps.map((step, idx) => {
            const stepStatus = getStepStatus(step.id);
            return (
              <div
                key={step.id}
                className={`relative flex flex-col p-2.5 rounded-xl border text-center transition-all ${
                  stepStatus === "completed"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : stepStatus === "current"
                    ? "bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-300/40 shadow-xs"
                    : stepStatus === "warning"
                    ? "bg-rose-50 border-rose-300 text-rose-950 ring-2 ring-rose-300/40"
                    : "bg-white border-zinc-200/80 text-zinc-400"
                }`}
              >
                <div className="text-[10px] font-semibold text-zinc-400 mb-1">
                  Step {idx + 1}
                </div>
                <div className="flex items-center justify-center mb-1">
                  {stepStatus === "completed" ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
                      ✓
                    </span>
                  ) : stepStatus === "current" ? (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold animate-pulse">
                      ●
                    </span>
                  ) : stepStatus === "warning" ? (
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[11px] font-bold">
                      !
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-500 flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-medium leading-tight line-clamp-2">
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* ADMIN APPROVAL REQUIRED MESSAGE & LIFECYCLE STATE NOTICE          */}
      {/* ================================================================= */}

      {/* 1. STATE: PENDING_APPROVAL (Under Admin Review) */}
      {(displayState === "PENDING_APPROVAL" || justSubmitted) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h2 className="font-semibold text-amber-950 text-base">
                Admin approval required
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
              Under Review
            </span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            Your listing has been submitted for review. Our team will review the property details before it becomes publicly available.
          </p>
          <div className="p-3 rounded-xl bg-white/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
            <span className="text-sm">🔒</span>
            <span className="leading-relaxed">
              <strong>Do not show the listing as fully published until the admin has actually approved it.</strong> The &quot;Listed&quot; option below is temporarily disabled until administrative review is complete.
            </span>
          </div>
          {formattedDate && (
            <p className="text-[11px] text-amber-800 pt-1">
              Submitted for review on: <span className="font-semibold">{formattedDate}</span>
            </p>
          )}
        </div>
      )}

      {/* 2. STATE: REJECTED (Changes Required) */}
      {displayState === "REJECTED" && !justSubmitted && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/80 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <h2 className="font-semibold text-rose-950 text-base">
                Changes Required
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase">
              Action Needed
            </span>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">
            The admin reviewed your listing and requested modifications before it can be approved:
          </p>
          <div className="p-3.5 rounded-xl bg-white/95 border border-rose-200 text-xs text-rose-900 font-medium leading-relaxed">
            {listing?.rejectionReason || listing?.requestedChanges || "Please review your listing details and resubmit."}
          </div>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleResubmitForReview}
              className="rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-6 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Resubmitting..." : "Resubmit for Approval"}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("description")}
              className="rounded-full bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 font-semibold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              Edit Listing Details
            </button>
          </div>
        </div>
      )}

      {/* 3. STATE: DRAFT (Incomplete Details) */}
      {displayState === "DRAFT" && !justSubmitted && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
              <h2 className="font-semibold text-zinc-900 text-base">
                Complete your listing
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-700 uppercase">
              Draft
            </span>
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Admin approval is required before your listing can be published. Please complete all required sections below to submit your property for review.
          </p>
          <div className="space-y-2 pt-1">
            {missing.map((req) => (
              <div
                key={req.key}
                className="flex items-center justify-between p-3 rounded-xl bg-white border border-zinc-200 text-xs"
              >
                <div>
                  <span className="font-semibold text-zinc-900">{req.label}</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{req.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection(req.section)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer shrink-0 ml-3"
                >
                  Complete →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. STATE: READY_TO_SUBMIT (All Fields Complete, Awaiting Host Submission) */}
      {displayState === "READY_TO_SUBMIT" && !justSubmitted && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="font-semibold text-indigo-950 text-base">
                Ready for review
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-900 uppercase">
              All Details Completed
            </span>
          </div>
          <p className="text-xs text-indigo-900 leading-relaxed">
            Your listing has all required details completed. Submit it now for admin review. Once approved, you will be able to publish it live to guests.
          </p>
          <div className="pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitForReview}
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Submitting for review..." : "Submit for Admin Approval"}
            </button>
          </div>
        </div>
      )}

      {/* 5. STATE: APPROVED (Approved by Admin, Ready to be made live) */}
      {displayState === "APPROVED" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="font-semibold text-emerald-950 text-base">
                Listing Approved
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 uppercase">
              Approved
            </span>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            Your listing has passed admin review! You can now select &quot;Listed&quot; below and click Save to publish your property live on Homyz.
          </p>
        </div>
      )}

      {/* 6. STATE: PUBLISHED (Live on Marketplace) */}
      {displayState === "PUBLISHED" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="font-semibold text-emerald-950 text-base">
                Your Listing is Live
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 uppercase">
              Live on Marketplace
            </span>
          </div>
          <p className="text-xs text-emerald-900 leading-relaxed">
            Guests can now find and book your property in search results. If you need to temporarily hide it, select &quot;Unlisted&quot; below and save.
          </p>
        </div>
      )}

      {/* ================================================================= */}
      {/* FIGMA HOUSE ILLUSTRATION (Matches Figma 100%)                      */}
      {/* ================================================================= */}
      <div className="flex justify-center py-4 sm:py-6">
        <svg className="w-56 h-44" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Main House Body */}
          <rect x="60" y="60" width="75" height="75" rx="3" fill="#F8FAFC" stroke="#1E293B" strokeWidth="2.5" />
          {/* Slanted Roof */}
          <polygon points="50,62 97.5,25 145,62" fill="#FDE047" stroke="#1E293B" strokeWidth="2.5" />
          {/* Windows */}
          <rect x="72" y="72" width="18" height="24" rx="2" fill="#93C5FD" stroke="#1E293B" strokeWidth="2" />
          <line x1="81" y1="72" x2="81" y2="96" stroke="#1E293B" strokeWidth="1.5" />
          <line x1="72" y1="84" x2="90" y2="84" stroke="#1E293B" strokeWidth="1.5" />
          {/* Door */}
          <rect x="102" y="95" width="20" height="40" rx="1" fill="#334155" stroke="#1E293B" strokeWidth="2" />
          <circle cx="106" cy="115" r="1.5" fill="#FDE047" />
          {/* Ground Line */}
          <path d="M40 135 H160" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
          {/* Tree Left */}
          <ellipse cx="46" cy="120" rx="10" ry="16" fill="#22C55E" stroke="#15803D" strokeWidth="2" />
          <line x1="46" y1="128" x2="46" y2="135" stroke="#15803D" strokeWidth="2.5" />
          {/* Tree Right */}
          <ellipse cx="152" cy="116" rx="12" ry="18" fill="#16A34A" stroke="#15803D" strokeWidth="2" />
          <line x1="152" y1="126" x2="152" y2="135" stroke="#15803D" strokeWidth="2.5" />
        </svg>
      </div>

      {/* ================================================================= */}
      {/* SELECTABLE STATUS CARDS (Listed vs Unlisted)                       */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Listed Card */}
        <div
          onClick={() => handleSelectStatus("listed")}
          className={`p-5 rounded-2xl border transition-all space-y-2 shadow-2xs relative ${
            !isApproved
              ? "opacity-60 cursor-not-allowed bg-zinc-50/70 border-zinc-200 select-none"
              : effectiveStatus === "listed"
              ? "bg-[#FEF9EC] border-amber-300 ring-1 ring-amber-300/60 shadow-2xs cursor-pointer"
              : "bg-white border-zinc-200 hover:border-zinc-300 cursor-pointer"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-[#1F1F1F]">Listed</h3>
            {!isApproved ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </span>
            ) : effectiveStatus === "listed" ? (
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
            Guests can find your listing in search results and book available dates.
          </p>
          {!isApproved && (
            <div className="pt-1 text-[10px] font-medium text-amber-800 flex items-center gap-1">
              <span>●</span>
              <span>Requires Admin Approval before publishing</span>
            </div>
          )}
        </div>

        {/* Unlisted Card */}
        <div
          onClick={() => handleSelectStatus("unlisted")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 shadow-2xs ${
            effectiveStatus === "unlisted"
              ? "bg-[#FEF9EC] border-amber-300 ring-1 ring-amber-300/60 shadow-2xs"
              : "bg-white border-zinc-200 hover:border-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-[#1F1F1F]">Unlisted</h3>
            {effectiveStatus === "unlisted" && (
              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {!isApproved ? "Unlisted (Awaiting Approval)" : "Hidden"}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
            Your listing is hidden from search results and guests cannot book dates.
          </p>
        </div>
      </div>

      {/* ================================================================= */}
      {/* ACTION BUTTONS (Save & Cancel)                                    */}
      {/* ================================================================= */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          disabled={isSaving || !isApproved}
          onClick={handleSave}
          className={`rounded-full font-semibold text-xs px-8 py-2.5 shadow-2xs transition-all ${
            !isApproved
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200"
              : "bg-[#FEE08B] hover:bg-[#FDE047] text-zinc-950 cursor-pointer"
          }`}
        >
          {isSaving ? "Saving..." : !isApproved ? "Save (Disabled: Admin approval required)" : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
