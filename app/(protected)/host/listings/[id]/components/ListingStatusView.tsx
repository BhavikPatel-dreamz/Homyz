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
import { isSaudiArabia } from "@/lib/location/address-countries";
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
      label: "Base price",
      description: "Specify a standard weekday base price",
      section: "pricing",
    });
  }

  const weekendPrice = Number(listing.weekendPrice || 0);
  if (weekendPrice <= 0) {
    missing.push({
      key: "weekendPrice",
      label: "Weekend price",
      description: "Set a weekend price or premium for Friday/Saturday",
      section: "pricing",
    });
  }

  const rawDisclosures = Array.isArray(listing.safetyDisclosures) ? listing.safetyDisclosures : [];
  // Safety disclosures are now optional - no validation required here
  
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
  country?: string | null,
): ListingDisplayState {
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") {
    return "REJECTED";
  }
  if (status === "ACTIVE" && published) {
    return "PUBLISHED";
  }
  if (status === "APPROVED" || (status === "ACTIVE" && !published)) {
    return "APPROVED";
  }
  const isSaudi = isSaudiArabia(country);
  if (isSaudi) {
    // Saudi Arabia listings do not require admin approval
    if (missingCount === 0) {
      return "APPROVED";
    }
    return "DRAFT";
  }
  if (status === "PENDING_REVIEW") {
    return "PENDING_APPROVAL";
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

  const isSaudi = isSaudiArabia(listing?.country);
  const missing = computeMissingRequirements(listing || {});
  const displayState = getListingDisplayState(
    listing?.status,
    listing?.published,
    missing.length,
    listing?.country,
  );

  const isApproved = isSaudi
    ? (missing.length === 0 || Boolean(listing?.published))
    : (displayState === "APPROVED" || displayState === "PUBLISHED" || Boolean(listing?.approvedAt));

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

  // Stepper definition: Saudi listings skip Admin Review & Approval
  const steps = isSaudi
    ? [
        { id: "created", label: "Listing Created" },
        { id: "completed", label: "Details Completed" },
        { id: "ready", label: "Ready to Publish" },
        { id: "published", label: "Published" },
      ]
    : [
        { id: "created", label: "Listing Created" },
        { id: "completed", label: "Details Completed" },
        { id: "submitted", label: "Submitted" },
        { id: "review", label: "Admin Review" },
        { id: "approved", label: "Approved" },
        { id: "published", label: "Published" },
      ];

  const getStepStatus = (stepId: string): "completed" | "current" | "upcoming" | "warning" => {
    if (isSaudi) {
      switch (displayState) {
        case "DRAFT":
          if (stepId === "created") return "completed";
          if (stepId === "completed") return "current";
          return "upcoming";
        case "APPROVED":
        case "READY_TO_SUBMIT":
          if (stepId === "created" || stepId === "completed") return "completed";
          if (stepId === "ready") return "current";
          return "upcoming";
        case "PUBLISHED":
          return "completed";
        case "REJECTED":
          if (stepId === "created") return "completed";
          return "warning";
      }
    }
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
    if (target === "listed") {
      if (isSaudi && missing.length > 0) {
        toast.error("Please complete all required sections before changing to Listed status.");
        return;
      }
      if (!isSaudi && !isApproved) {
        toast.error(
          "Admin approval required: Your listing must be reviewed and approved by an administrator before it can be listed publicly.",
        );
        return;
      }
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
      toast.error(
        isSaudi
          ? "Please complete all required sections before changing to Listed status."
          : "Admin approval required before changing to Listed status."
      );
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
        <BackButton onClick={() => setActiveSection("propertyType")} />
        <h1 className="tracking-[-0.02em] text-2xl font-semibold text-[#1F1F1F] dark:text-zinc-100">Listing status</h1>
      </div>

      {/* Visual Approval Progress Timeline */}
      <section aria-label="Approval and publishing progress" className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-2xs">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Listing journey</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Approval &amp; publishing progress</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
            displayState === "PUBLISHED" ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" :
            displayState === "REJECTED" ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300" :
            "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
          }`}>
            {displayState === "PUBLISHED" ? "Live" : displayState === "REJECTED" ? "Action needed" : "In progress"}
          </span>
        </div>
        <div className="overflow-x-auto px-5 py-6 sm:px-6">
          <div className={`relative flex min-w-[560px] ${isSaudi ? "sm:min-w-0" : "lg:min-w-0"}`}>
            <div className="absolute left-[8%] right-[8%] top-4 h-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
            {steps.map((step, idx) => {
              const stepStatus = getStepStatus(step.id);
              const isComplete = stepStatus === "completed";
              const isCurrent = stepStatus === "current";
              const isWarning = stepStatus === "warning";
              return (
                <div key={step.id} className="relative z-10 flex min-w-[112px] flex-1 flex-col items-center text-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    isComplete ? "border-emerald-500 bg-emerald-500 text-white" :
                    isCurrent ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-4 ring-amber-100 dark:ring-amber-900/40" :
                    isWarning ? "border-rose-500 bg-rose-500 text-white" :
                    "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                  }`}>
                    {isComplete ? "✓" : isWarning ? "!" : idx + 1}
                  </span>
                  <span className={`mt-3 max-w-[108px] text-[11px] font-semibold leading-snug ${
                    isComplete ? "text-emerald-800 dark:text-emerald-400" : isCurrent ? "text-zinc-950 dark:text-zinc-100" : isWarning ? "text-rose-800 dark:text-rose-400" : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    {step.label}
                  </span>
                  {isCurrent && <span className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">Current step</span>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* ADMIN APPROVAL REQUIRED MESSAGE & LIFECYCLE STATE NOTICE          */}
      {/* ================================================================= */}

      {/* 1. STATE: PENDING_APPROVAL (Under Admin Review for non-Saudi) */}
      {!isSaudi && (displayState === "PENDING_APPROVAL" || justSubmitted) && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h2 className="font-semibold text-amber-950 dark:text-amber-200 text-base">
                Admin approval required
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 uppercase">
              Under Review
            </span>
          </div>
          <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
            Your listing has been submitted for review. Our team will review the property details before it becomes publicly available.
          </p>
          <div className="p-3 rounded-xl bg-white/90 dark:bg-zinc-900/80 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
            <span className="text-sm">🔒</span>
            <span className="leading-relaxed">
              <strong>Do not show the listing as fully published until the admin has actually approved it.</strong> The &quot;Listed&quot; option below is temporarily disabled until administrative review is complete.
            </span>
          </div>
          {formattedDate && (
            <p className="text-[11px] text-amber-800 dark:text-amber-400 pt-1">
              Submitted for review on: <span className="font-semibold">{formattedDate}</span>
            </p>
          )}
        </div>
      )}

      {/* 2. STATE: REJECTED (Changes Required) */}
      {displayState === "REJECTED" && !justSubmitted && (
        <div className="rounded-2xl border border-rose-300 dark:border-rose-700 bg-rose-50/80 dark:bg-rose-950/40 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <h2 className="font-semibold text-rose-950 dark:text-rose-200 text-base">
                Changes Required
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 uppercase">
              Action Needed
            </span>
          </div>
          <p className="text-xs text-rose-900 dark:text-rose-300 leading-relaxed">
            The admin reviewed your listing and requested modifications before it can be approved:
          </p>
          <div className="p-3.5 rounded-xl bg-white/95 dark:bg-zinc-900/80 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-200 font-medium leading-relaxed">
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
              className="rounded-full bg-white dark:bg-zinc-800 border border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-900 dark:text-rose-200 font-semibold text-xs px-5 py-2.5 shadow-2xs transition-all cursor-pointer"
            >
              Edit Listing Details
            </button>
          </div>
        </div>
      )}

      {/* 3. STATE: DRAFT (Incomplete Details) */}
      {displayState === "DRAFT" && !justSubmitted && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/60 p-5 space-y-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                Complete your listing
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 uppercase">
              Draft
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {isSaudi
              ? "Complete all required sections below to publish your property live on Homyz. Admin approval is not required for Saudi listings."
              : "Admin approval is required before your listing can be published. Please complete all required sections below to submit your property for review."}
          </p>
          <div className="space-y-2 pt-1">
            {missing.map((req) => (
              <div
                key={req.key}
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs"
              >
                <div>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{req.label}</span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{req.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection(req.section)}
                  className="text-xs font-semibold text-indigo-600 dark:text-amber-400 hover:text-indigo-800 dark:hover:text-amber-300 hover:underline cursor-pointer shrink-0 ml-3"
                >
                  Complete →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. STATE: APPROVED (ready for the host to publish) */}
      {displayState === "APPROVED" && !justSubmitted && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-5 space-y-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="font-semibold text-emerald-950 dark:text-emerald-200 text-base">
                {isSaudi ? "Ready to Publish" : "Listing Approved"}
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 uppercase">
              {isSaudi ? "Ready" : "Approved"}
            </span>
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
            {isSaudi
              ? "No admin approval is required for Saudi listings. Your listing is complete and ready to publish."
              : "Your listing has been approved. Select Listed below and save to publish it to guests."}
          </p>
        </div>
      )}

      {/* 5. STATE: PUBLISHED (Live on Marketplace) */}
      {displayState === "PUBLISHED" && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 p-5 space-y-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="font-semibold text-emerald-950 dark:text-emerald-200 text-base">
                Your Listing is Live
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 uppercase">
              Live on Marketplace
            </span>
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
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
          <rect x="60" y="60" width="75" height="75" rx="3" className="fill-slate-50 dark:fill-zinc-800 stroke-slate-800 dark:stroke-zinc-300" strokeWidth="2.5" />
          {/* Slanted Roof */}
          <polygon points="50,62 97.5,25 145,62" className="fill-yellow-300 dark:fill-amber-400 stroke-slate-800 dark:stroke-zinc-300" strokeWidth="2.5" />
          {/* Windows */}
          <rect x="72" y="72" width="18" height="24" rx="2" className="fill-blue-300 dark:fill-blue-900/80 stroke-slate-800 dark:stroke-zinc-300" strokeWidth="2" />
          <line x1="81" y1="72" x2="81" y2="96" className="stroke-slate-800 dark:stroke-zinc-300" strokeWidth="1.5" />
          <line x1="72" y1="84" x2="90" y2="84" className="stroke-slate-800 dark:stroke-zinc-300" strokeWidth="1.5" />
          {/* Door */}
          <rect x="102" y="95" width="20" height="40" rx="1" className="fill-slate-700 dark:fill-zinc-700 stroke-slate-800 dark:stroke-zinc-300" strokeWidth="2" />
          <circle cx="106" cy="115" r="1.5" className="fill-yellow-300 dark:fill-amber-400" />
          {/* Ground Line */}
          <path d="M40 135 H160" className="stroke-green-700 dark:stroke-emerald-500" strokeWidth="4" strokeLinecap="round" />
          {/* Tree Left */}
          <ellipse cx="46" cy="120" rx="10" ry="16" className="fill-green-500 dark:fill-emerald-600 stroke-green-700 dark:stroke-emerald-500" strokeWidth="2" />
          <line x1="46" y1="128" x2="46" y2="135" className="stroke-green-700 dark:stroke-emerald-500" strokeWidth="2.5" />
          {/* Tree Right */}
          <ellipse cx="152" cy="116" rx="12" ry="18" className="fill-green-600 dark:fill-emerald-700 stroke-green-700 dark:stroke-emerald-500" strokeWidth="2" />
          <line x1="152" y1="126" x2="152" y2="135" className="stroke-green-700 dark:stroke-emerald-500" strokeWidth="2.5" />
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
              ? "opacity-60 cursor-not-allowed bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 select-none"
              : effectiveStatus === "listed"
              ? "bg-[#FEF9EC] dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/80 ring-1 ring-amber-300/60 dark:ring-amber-500/40 shadow-2xs cursor-pointer"
              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 cursor-pointer"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-[#1F1F1F] dark:text-zinc-100">Listed</h3>
            {!isApproved ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {isSaudi ? "Incomplete" : "Locked"}
              </span>
            ) : effectiveStatus === "listed" ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : null}
          </div>
          <p className="text-base text-[#727272] dark:text-zinc-400 font-normal leading-relaxed">
            Guests can find your listing in search results and book available dates.
          </p>
          {!isApproved && (
            <div className="pt-1 text-[10px] font-medium text-amber-800 dark:text-amber-400 flex items-center gap-1">
              <span>●</span>
              <span>
                {isSaudi
                  ? "Complete all required sections before publishing"
                  : "Requires Admin Approval before publishing"}
              </span>
            </div>
          )}
        </div>

        {/* Unlisted Card */}
        <div
          onClick={() => handleSelectStatus("unlisted")}
          className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-2 shadow-2xs ${
            effectiveStatus === "unlisted"
              ? "bg-[#FEF9EC] dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/80 ring-1 ring-amber-300/60 dark:ring-amber-500/40 shadow-2xs"
              : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-[#1F1F1F] dark:text-zinc-100">Unlisted</h3>
            {effectiveStatus === "unlisted" && (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {!isApproved ? (isSaudi ? "Draft (Incomplete)" : "Unlisted (Awaiting Approval)") : "Hidden"}
              </span>
            )}
          </div>
          <p className="text-base text-[#727272] dark:text-zinc-400 font-normal leading-relaxed">
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
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-700"
              : "bg-[#FEE08B] dark:bg-amber-400 hover:bg-[#FDE047] dark:hover:bg-amber-300 text-zinc-950 cursor-pointer"
          }`}
        >
          {isSaving
            ? "Saving..."
            : !isApproved
            ? isSaudi
              ? "Save (Complete required sections)"
              : "Save (Disabled: Admin approval required)"
            : "Save"}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection("arrival-guide")}
          className="rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs px-7 py-2.5 shadow-2xs transition-all cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
