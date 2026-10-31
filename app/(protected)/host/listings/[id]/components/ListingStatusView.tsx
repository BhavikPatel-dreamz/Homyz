"use client";

import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
import { toast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  submitListingForReviewAction,
  resubmitListingForReviewAction,
  unpublishListingAction,
  publishListingAction,
} from "@/actions/host/listings";
import { isSaudiArabia } from "@/lib/location/address-countries";
import type { HostListingData } from "../section-helpers";

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
  isSaving: parentIsSaving = false,
  handleSaveSection,
}: ListingStatusViewProps) {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Determine actual backend visibility
  const isPublished = Boolean(listing?.published);
  const isLive = isPublished && listing?.status === "ACTIVE" && !listing?.isPaused;
  const currentSavedVisibility: "listed" | "unlisted" = isLive ? "listed" : "unlisted";

  // Local state for interactive visibility radio selection
  const [selectedVisibility, setSelectedVisibility] = useState<"listed" | "unlisted">(
    propStatus ?? currentSavedVisibility,
  );

  useEffect(() => {
    setSelectedVisibility(propStatus ?? currentSavedVisibility);
  }, [propStatus, currentSavedVisibility]);

  useEffect(() => {
    if (listing?.submittedAt) {
      try {
        const d = new Date(listing.submittedAt);
        if (!isNaN(d.getTime())) {
          setFormattedDate(
            d.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          );
        }
      } catch {
        setFormattedDate(null);
      }
    }
  }, [listing?.submittedAt]);

  const hasVisibilityChange = selectedVisibility !== currentSavedVisibility;
  const isWorking = isSubmitting || parentIsSaving;

  // Saudi license verification guard
  const isSaudiLicenseRestricted =
    isSaudi &&
    listing?.licenseEligibilityStatus &&
    listing.licenseEligibilityStatus !== "ELIGIBLE";

  // Setup progress steps (only shown during incomplete onboarding)
  const setupSteps = [
    { id: "created", label: t("host_step_listing_created", "Created") },
    { id: "details", label: t("host_step_details_completed", "Details") },
    {
      id: "ready",
      label: isSaudi
        ? t("host_status_ready_to_publish", "Ready to publish")
        : t("host_step_admin_review", "Review"),
    },
    { id: "live", label: t("host_status_published_live", "Live") },
  ];

  const getProgressIndex = (): number => {
    if (isLive) return 3;
    if (displayState === "APPROVED" || displayState === "PENDING_APPROVAL") return 2;
    if (missing.length <= 2) return 1;
    return 0;
  };
  const currentStepIndex = getProgressIndex();

  // Handlers
  const handleCancelVisibilityChange = () => {
    setSelectedVisibility(currentSavedVisibility);
    propSetStatus?.(currentSavedVisibility);
  };

  const handleSaveVisibility = async () => {
    if (!listing) return;
    setIsSubmitting(true);
    try {
      if (selectedVisibility === "listed") {
        const res = await publishListingAction(listing.id);
        setIsSubmitting(false);
        if (res.ok && res.data) {
          if (res.data.published || isSaudi) {
            onUpdateListing?.({ published: true, status: "ACTIVE", isPaused: false });
            propSetStatus?.("listed");
            toast.success("Your listing is now listed and visible to guests.");
          } else {
            onUpdateListing?.({ published: false, status: "PENDING_REVIEW", isPaused: false });
            propSetStatus?.("unlisted");
            toast.success("Listing submitted for review.");
          }
        } else {
          toast.error((res as any).error || "Failed to publish listing.");
        }
      } else {
        const res = await unpublishListingAction(listing.id);
        setIsSubmitting(false);
        if (res.ok && res.data) {
          onUpdateListing?.({ published: false, status: "DRAFT" });
          propSetStatus?.("unlisted");
          toast.success("Your listing is now unlisted and hidden from search.");
        } else {
          toast.error((res as any).error || "Failed to unpublish listing.");
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error("Error updating visibility: " + (err?.message || "Unknown error"));
    }
  };

  const handlePublishListing = async () => {
    if (!listing) return;
    if (isSaudiLicenseRestricted) {
      toast.error("Your Saudi property license must be verified before publishing.");
      setActiveSection("regulations");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await publishListingAction(listing.id);
      setIsSubmitting(false);
      if (res.ok && res.data) {
        onUpdateListing?.({ published: true, status: "ACTIVE", isPaused: false });
        propSetStatus?.("listed");
        toast.success("Congratulations! Your listing is now published and live.");
      } else {
        toast.error((res as any).error || "Failed to publish listing.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error("Error publishing listing: " + (err?.message || "Unknown error"));
    }
  };

  const handleSubmitForReview = async () => {
    if (!listing) return;
    setIsSubmitting(true);
    try {
      const res = await submitListingForReviewAction(listing.id);
      setIsSubmitting(false);
      if (res.ok && res.data) {
        onUpdateListing?.({
          status: "PENDING_REVIEW",
          published: false,
          submittedAt: new Date().toISOString(),
        });
        toast.success("Listing submitted for review.");
      } else {
        toast.error((res as any).error || "Failed to submit listing.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error("Error submitting listing: " + (err?.message || "Unknown error"));
    }
  };

  const handleResubmit = async () => {
    if (!listing) return;
    setIsSubmitting(true);
    try {
      const res = await resubmitListingForReviewAction(listing.id);
      setIsSubmitting(false);
      if (res.ok && res.data) {
        onUpdateListing?.({
          status: "PENDING_REVIEW",
          published: false,
          resubmittedAt: new Date().toISOString(),
          requestedChanges: null,
          rejectionReason: null,
        });
        toast.success("Listing resubmitted successfully for review.");
      } else {
        toast.error((res as any).error || "Failed to resubmit listing.");
      }
    } catch (err: any) {
      setIsSubmitting(false);
      toast.error("Error resubmitting listing: " + (err?.message || "Unknown error"));
    }
  };

  const handleContinueSetup = () => {
    const firstMissing = missing[0];
    if (firstMissing?.section) {
      setActiveSection(firstMissing.section);
    } else {
      setActiveSection("basics");
    }
  };

  // Determine single current status attributes
  const getCurrentStatusConfig = () => {
    if (isLive) {
      return {
        label: t("host_status_listed_active", "Listed — Active"),
        badge: t("host_active", "Active"),
        dotColor: "bg-emerald-500",
        description: t("host_status_visible_desc", "Your listing is visible to guests."),
      };
    }
    if (isPublished && !isLive) {
      return {
        label: t("host_unlisted_title", "Unlisted"),
        badge: t("host_hidden", "Hidden"),
        dotColor: "bg-zinc-400",
        description: t("host_status_hidden_desc", "Your listing is hidden from search."),
      };
    }
    if (displayState === "APPROVED") {
      return {
        label: t("host_status_ready_to_publish", "Ready to publish"),
        badge: t("host_ready_badge", "Ready"),
        dotColor: "bg-emerald-500",
        description: t("host_status_ready_desc", "Your listing is ready to go live."),
      };
    }
    if (displayState === "PENDING_APPROVAL") {
      return {
        label: t("host_status_pending_review", "Pending review"),
        badge: t("host_under_review", "Under review"),
        dotColor: "bg-amber-500",
        description: t("host_status_pending_desc", "Your listing is being reviewed."),
      };
    }
    if (displayState === "REJECTED") {
      return {
        label: t("host_status_changes_requested", "Changes requested"),
        badge: t("host_status_action_needed", "Action needed"),
        dotColor: "bg-rose-500",
        description: t("host_status_changes_desc", "Update your listing to continue."),
      };
    }
    return {
      label: t("host_draft_badge", "Draft"),
      badge: t("host_incomplete", "Incomplete"),
      dotColor: "bg-zinc-400",
      description: t("host_status_draft_desc", "Complete your listing to publish."),
    };
  };

  const currentStatus = getCurrentStatusConfig();

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl pb-12 font-sans">
      {/* Page Header */}
      <div className="flex items-center gap-5">
        <BackButton onClick={() => setActiveSection("arrival-guide")} />
        <div>
          <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100">
            {t("host_status_view_title", "Listing status")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your listing's visibility.
          </p>
        </div>
      </div>

      {/* Optional Compact Setup Progress (Only for incomplete setup listings) */}
      {!isLive && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {t("host_status_listing_progress", "Listing progress")}
            </span>
            <span>
              {t("host_status_step_count", { current: currentStepIndex + 1, total: setupSteps.length }, `Step ${currentStepIndex + 1} of ${setupSteps.length}`)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {setupSteps.map((step, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.id} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isDone
                        ? "bg-zinc-900 dark:bg-zinc-100"
                        : isCurrent
                        ? "bg-amber-400"
                        : "bg-zinc-100 dark:bg-zinc-700"
                    }`}
                  />
                  <p
                    className={`text-[11px] truncate ${
                      isCurrent
                        ? "font-medium text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Status Card */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-700 dark:bg-zinc-800 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className={`size-2.5 rounded-full ${currentStatus.dotColor}`} />
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {currentStatus.label}
              </h2>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 pl-5">
              {currentStatus.description}
            </p>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0">
            {currentStatus.badge}
          </span>
        </div>

        {/* Date indication when pending review */}
        {displayState === "PENDING_APPROVAL" && formattedDate && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 pl-5">
            {t("host_submitted_on", "Submitted on")} {formattedDate}
          </p>
        )}

        {/* Rejection notice / feedback */}
        {displayState === "REJECTED" && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-4 text-xs text-rose-900 dark:text-rose-200 leading-relaxed font-normal">
            <p className="font-medium mb-1">
              {t("host_status_feedback_title", "Feedback from review team:")}
            </p>
            <p>{listing?.rejectionReason || listing?.requestedChanges || "Please review your listing details and resubmit."}</p>
          </div>
        )}

        {/* Saudi license warning if incomplete */}
        {isSaudi && displayState === "APPROVED" && isSaudiLicenseRestricted && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {t("host_status_saudi_license_required", "License verification required")}
              </p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                {t("host_status_saudi_license_desc", "Your Saudi tourism license must be verified and eligible before publishing.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection("regulations")}
              className="rounded-full bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 px-4 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
            >
              {t("host_status_verify_license_btn", "Review license")}
            </button>
          </div>
        )}

        {/* Missing requirements summary if draft */}
        {displayState === "DRAFT" && missing.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {t("host_status_remaining_steps", { count: missing.length }, `${missing.length} step${missing.length > 1 ? "s" : ""} remaining:`)}
            </p>
            <div className="space-y-1.5">
              {missing.map((req) => (
                <div
                  key={req.key}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 block">
                      {req.label}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 block truncate">
                      {req.description}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection(req.section)}
                    className="text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:underline shrink-0 cursor-pointer ml-2"
                  >
                    {t("host_complete_btn", "Add")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* LISTED / UNLISTED CONTROLS (Only for published listings)          */}
      {/* ================================================================= */}
      {isPublished && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              {t("host_status_visibility_title", "Listing visibility")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("host_status_visibility_subtitle", "Choose whether guests can find and book your place.")}
            </p>
          </div>

          <div className="space-y-3">
            {/* Option 1: Listed */}
            <div
              onClick={() => {
                setSelectedVisibility("listed");
                propSetStatus?.("listed");
              }}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                selectedVisibility === "listed"
                  ? "border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50/50 dark:border-zinc-100 dark:ring-zinc-100 dark:bg-zinc-800/80"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
              }`}
            >
              <div className="pt-0.5">
                <div
                  className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedVisibility === "listed"
                      ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
                      : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                  }`}
                >
                  {selectedVisibility === "listed" && (
                    <div className="size-2 rounded-full bg-white dark:bg-zinc-900" />
                  )}
                </div>
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                    {t("host_listed_title", "Listed")}
                  </span>
                  {isLive && selectedVisibility === "listed" && (
                    <span className="size-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed">
                  {t("host_listed_card_desc", "Guests can find and book your place.")}
                </p>
              </div>
            </div>

            {/* Option 2: Unlisted */}
            <div
              onClick={() => {
                setSelectedVisibility("unlisted");
                propSetStatus?.("unlisted");
              }}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                selectedVisibility === "unlisted"
                  ? "border-zinc-900 ring-1 ring-zinc-900 bg-zinc-50/50 dark:border-zinc-100 dark:ring-zinc-100 dark:bg-zinc-800/80"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600"
              }`}
            >
              <div className="pt-0.5">
                <div
                  className={`size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedVisibility === "unlisted"
                      ? "border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100"
                      : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                  }`}
                >
                  {selectedVisibility === "unlisted" && (
                    <div className="size-2 rounded-full bg-white dark:bg-zinc-900" />
                  )}
                </div>
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <span className="text-base font-medium text-zinc-900 dark:text-zinc-100 block">
                  {t("host_unlisted_title", "Unlisted")}
                </span>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed">
                  {t("host_unlisted_card_desc", "Hide your place from guests.")}
                </p>
              </div>
            </div>
          </div>

          {/* Visibility Action Buttons (Save / Cancel) */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={!hasVisibilityChange || isWorking}
              onClick={handleSaveVisibility}
              className="rounded-full bg-[#1F1F1F] dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium hover:bg-black dark:hover:bg-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              {isWorking ? t("host_saving_btn", "Saving…") : t("host_save_changes", "Save changes")}
            </button>
            <button
              type="button"
              disabled={!hasVisibilityChange || isWorking}
              onClick={handleCancelVisibilityChange}
              className="rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("host_cancel_btn", "Cancel")}
            </button>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* ACTIONS FOR UNPUBLISHED LISTINGS                                  */}
      {/* ================================================================= */}
      {!isPublished && (
        <div className="pt-2">
          {/* Case A: Ready to publish */}
          {displayState === "APPROVED" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isWorking}
                onClick={handlePublishListing}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] hover:text-white text-[#1F1F1F] px-6 py-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              >
                {isWorking
                  ? t("host_publishing_btn", "Publishing…")
                  : t("host_publish_listing_btn", "Publish listing")}
              </button>
            </div>
          )}

          {/* Case B: Ready to submit for admin review (Non-Saudi complete listings) */}
          {displayState === "READY_TO_SUBMIT" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isWorking}
                onClick={handleSubmitForReview}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] hover:text-white text-[#1F1F1F] px-6 py-2.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              >
                {isWorking
                  ? t("host_submitting_btn", "Submitting…")
                  : t("host_submit_for_review_btn", "Submit for review")}
              </button>
            </div>
          )}

          {/* Case C: Draft (Incomplete setup) */}
          {displayState === "DRAFT" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleContinueSetup}
                className="rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] hover:text-white text-[#1F1F1F] px-6 py-2.5 text-sm font-medium transition-colors cursor-pointer shadow-2xs"
              >
                {t("host_continue_setup_btn", "Continue setup")}
              </button>
            </div>
          )}

          {/* Case D: Changes requested (Rejected) */}
          {displayState === "REJECTED" && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isWorking}
                onClick={handleResubmit}
                className="rounded-full bg-[#1F1F1F] dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 text-sm font-medium hover:bg-black dark:hover:bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
              >
                {isWorking
                  ? t("host_resubmitting", "Resubmitting…")
                  : t("host_resubmit_approval", "Resubmit for review")}
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("description")}
                className="rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                {t("host_edit_listing_details", "Edit details")}
              </button>
            </div>
          )}

          {/* Case E: Pending review */}
          {displayState === "PENDING_APPROVAL" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection("basics")}
                className="rounded-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                {t("host_view_details_btn", "View listing details")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
