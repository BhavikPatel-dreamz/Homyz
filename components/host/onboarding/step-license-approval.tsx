"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { StepProgressFooter } from "./step-progress-footer";
import { isSaudiArabia } from "@/lib/location/address-countries";
import { useLanguage } from "@/lib/i18n/language-context";
import { getCurrencySymbol, getCurrencyForCountry } from "@/lib/currency";

export type LicenseVerificationStatus =
  | "idle"
  | "verifying"
  | "valid"
  | "invalid"
  | "expired"
  | "error";

export type LicenseResult = {
  licenseNumber: string;
  status: string;
  expiryDate: string | null;
  eligibilityStatus: string;
  automaticApprovalAvailable: boolean;
  simulated: boolean;
  error: string | null;
  lastVerifiedAt: string | null;
};

interface StepLicenseApprovalProps {
  draftId: string | null;
  country: string;
  title: string;
  city: string;
  price: number;
  photos: string[];
  category?: string;
  placeType?: string;
  guests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  currency?: string;
  listingStatus?: string;
  onBack: () => void;
  onVerify: () => Promise<LicenseResult>;
  onEditRegistration: () => void;
  onSubmit: (method: "automatic" | "manual") => Promise<void>;
  onSaveDraft?: () => Promise<void>;
  isPublishing?: boolean;
  isSavingDraft?: boolean;
}

export function getVerificationState(result: LicenseResult | null): {
  status: LicenseVerificationStatus;
  errorMessage: string | null;
  canPublish: boolean;
} {
  if (!result) {
    return { status: "idle", errorMessage: null, canPublish: false };
  }

  const normalizedStatus = (result.status || "").toUpperCase();
  const normalizedEligibility = (result.eligibilityStatus || "").toUpperCase();

  if (normalizedStatus === "EXPIRED" || normalizedEligibility === "EXPIRED") {
    return {
      status: "expired",
      errorMessage:
        result.error ||
        "Your property license has expired. Please update your registration details.",
      canPublish: false,
    };
  }

  if (
    normalizedStatus === "UNAVAILABLE" ||
    normalizedEligibility === "PROVIDER_UNAVAILABLE"
  ) {
    return {
      status: "error",
      errorMessage:
        result.error ||
        "Unable to verify your license right now. Please try again.",
      canPublish: false,
    };
  }

  if (
    normalizedStatus === "ACTIVE" &&
    normalizedEligibility === "ELIGIBLE" &&
    result.automaticApprovalAvailable
  ) {
    return { status: "valid", errorMessage: null, canPublish: true };
  }

  return {
    status: "invalid",
    errorMessage:
      result.error ||
      "License is not valid. Please check your registration details.",
    canPublish: false,
  };
}

function formatLocationDisplay(city?: string | null, country?: string | null): string {
  const cleanCity = city?.trim() || "";
  const cleanCountry = country?.split(" - ")[0].trim() || "";
  return [cleanCity, cleanCountry].filter(Boolean).join(", ");
}

function formatPreviewPrice(amount: number, currencyCode: string = "SAR"): string {
  if (!amount || amount <= 0) return "";
  const symbol = getCurrencySymbol(currencyCode);
  const formattedNum = new Intl.NumberFormat("en").format(amount);
  if (["$", "€", "£", "₹", "¥"].includes(symbol)) {
    return `${symbol}${formattedNum}`;
  }
  return `${symbol} ${formattedNum}`;
}

export function StepLicenseApproval({
  draftId,
  country,
  title,
  city,
  price,
  photos,
  category,
  placeType,
  guests = 4,
  bedrooms = 1,
  beds = 1,
  bathrooms = 1,
  currency,
  listingStatus = "DRAFT",
  onBack,
  onVerify,
  onEditRegistration,
  onSubmit,
  onSaveDraft,
  isPublishing = false,
  isSavingDraft = false,
}: StepLicenseApprovalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const isSaudi = isSaudiArabia(country);
  const resolvedCurrency = currency || getCurrencyForCountry(country) || "SAR";

  const [verificationStatus, setVerificationStatus] =
    useState<LicenseVerificationStatus>(isSaudi ? "verifying" : "valid");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const verificationRequestRef = useRef(0);
  const isSubmittingRef = useRef(false);

  // Check if listing has already been submitted or published
  const isPendingReview = listingStatus === "PENDING_REVIEW";
  const isApprovedOrPublished = listingStatus === "APPROVED" || listingStatus === "ACTIVE";

  const verify = async () => {
    const requestId = ++verificationRequestRef.current;
    setVerificationStatus("verifying");
    setInlineError(null);
    try {
      const next = await onVerify();
      if (requestId !== verificationRequestRef.current) return;
      const state = getVerificationState(next);
      setVerificationStatus(state.status);
      setInlineError(state.errorMessage);
    } catch (error) {
      if (requestId !== verificationRequestRef.current) return;
      setVerificationStatus("error");
      setInlineError(
        error instanceof Error
          ? error.message
          : t(
              "host_license_err_unavailable",
              "License verification is temporarily unavailable. Please try again or save your listing as a draft."
            )
      );
    }
  };

  useEffect(() => {
    if (!isSaudi || !draftId || isPendingReview || isApprovedOrPublished) {
      verificationRequestRef.current += 1;
      setVerificationStatus(isSaudi ? "idle" : "valid");
      setInlineError(null);
      return;
    }

    void verify();
  }, [draftId, isSaudi, isPendingReview, isApprovedOrPublished]);

  const retry = () => {
    void verify();
  };

  // Select the cover photo from draft photos
  const displayPhoto =
    photos && photos.length > 0 && typeof photos[0] === "string" && photos[0].trim()
      ? photos[0]
      : null;

  // Headings mapping based strictly on country and current status
  let headingTitle = t("host_review_ready_title", "You're ready to submit your listing");
  let headingDescription = t(
    "host_review_ready_desc",
    "Review your listing details before sending them for approval. Once approved, your property will be ready to welcome guests."
  );

  if (isPendingReview) {
    headingTitle = t("host_submitted_success_title", "Your listing has been submitted!");
    headingDescription = t(
      "host_submitted_success_desc",
      "Your listing is now under review. We'll notify you once a decision has been made."
    );
  } else if (isApprovedOrPublished) {
    headingTitle = t("host_published_success_title", "Yay! Your listing is published.");
    headingDescription = t(
      "host_published_success_desc",
      "Guests can now find and book your property."
    );
  } else if (isSaudi) {
    switch (verificationStatus) {
      case "idle":
      case "verifying":
        headingTitle = t(
          "host_license_verifying_title",
          "Verifying your property license"
        );
        headingDescription = t(
          "host_license_verifying_desc",
          "We’re checking your registration details. Please wait while we verify your license."
        );
        break;
      case "valid":
        headingTitle =
          t("host_license_step_title_saudi", "You're ready to publish!") ||
          t("host_license_step_title", "Yay! It’s time to publish.");
        headingDescription = t(
          "host_license_step_desc_saudi",
          "Take one last look at your listing before making it available to guests."
        );
        break;
      case "invalid":
        headingTitle = t(
          "host_license_invalid_title",
          "Your property license is not valid"
        );
        headingDescription = t(
          "host_license_invalid_desc",
          "We couldn't validate your property license using the registration details provided. Please review your information before publishing."
        );
        break;
      case "expired":
        headingTitle = t(
          "host_license_expired_title",
          "Your property license has expired"
        );
        headingDescription = t(
          "host_license_expired_desc",
          "Your property license is no longer valid. Please update your registration details before publishing your listing."
        );
        break;
      case "error":
        headingTitle = t(
          "host_license_error_title",
          "We couldn't verify your property license"
        );
        headingDescription = t(
          "host_license_error_desc",
          "License verification is temporarily unavailable. Please try again or save your listing as a draft."
        );
        break;
    }
  }

  // Footer button configuration
  const canPublish = !isSaudi || verificationStatus === "valid";
  const isLoadingVerification = isSaudi && (verificationStatus === "verifying" || verificationStatus === "idle") && !isPendingReview && !isApprovedOrPublished;
  const isBusy = isPublishing || isSavingDraft;

  const handleNextAction = async () => {
    if (isSubmittingRef.current || isBusy) return;

    if (isPendingReview || isApprovedOrPublished) {
      router.push("/host/listings");
      return;
    }

    if (canPublish) {
      isSubmittingRef.current = true;
      setSubmitError(null);
      try {
        await onSubmit(isSaudi ? "automatic" : "manual");
      } catch (err) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : t("host_submit_failed", "Couldn't submit your listing. Please try again.")
        );
      } finally {
        isSubmittingRef.current = false;
      }
    } else if (onSaveDraft) {
      await onSaveDraft();
    }
  };

  const footerNextLabel = isPendingReview || isApprovedOrPublished
    ? t("host_btn_go_to_listings", "Go to your listings")
    : canPublish
    ? isPublishing
      ? isSaudi
        ? t("host_license_btn_publishing", "Publishing listing...")
        : t("host_review_btn_submitting", "Submitting for review...")
      : isSaudi
      ? t("host_license_btn_publish", "Publish listing") || t("host_license_btn_save_publish", "Save and publish")
      : t("host_review_btn_submit", "Submit for review")
    : t("host_license_btn_save_draft", "Save draft");

  return (
    <OnboardingStepLayout
      isLoading={isBusy}
      mainClassName="min-h-dvh bg-white pb-8 sm:py-10 lg:pt-16 lg:pb-16"
      wrapperClassName="wrapper flex min-h-[calc(100dvh-10.25rem)] w-full flex-1 flex-col sm:justify-between"
    >
      <div className="mx-auto my-auto flex w-full max-w-4xl flex-col items-start">
        <OnboardingStepHeading
          title={headingTitle}
          description={headingDescription}
          titleClassName="mb-3"
          descriptionClassName="mb-8 max-w-2xl"
        />

        {/* Global Submission Error Alert */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 flex w-full items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs sm:text-sm font-medium text-rose-800 shadow-xs animate-in fade-in"
          >
            <div className="flex items-start gap-2.5">
              <svg className="size-4 sm:size-5 shrink-0 text-rose-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
              </svg>
              <span>{submitError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="shrink-0 text-rose-600 hover:text-rose-800 p-0.5 rounded-full hover:bg-rose-100 transition-colors cursor-pointer"
              aria-label={t("common_dismiss", "Dismiss")}
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* 1. LOADING SCREEN (Saudi verifying / idle state) */}
        {isLoadingVerification && (
          <div className="w-full flex justify-center py-6 sm:py-8" aria-live="polite">
            <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-zinc-50/50 p-8 text-center shadow-xs sm:p-12">
              <div className="flex flex-col items-center justify-center">
                <div className="relative mb-5 flex h-14 w-14 items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-3 border-zinc-200 border-t-zinc-900" />
                  <span className="sr-only">Checking license status…</span>
                </div>
                <h2 className="text-base font-medium text-zinc-900">
                  {t(
                    "host_license_loading_status",
                    "Checking your registration with the portal"
                  )}
                </h2>
                <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                  {t(
                    "host_license_loading_hint",
                    "This usually takes just a few seconds. We'll update the screen as soon as verification completes."
                  )}
                </p>
              </div>
            </section>
          </div>
        )}

        {/* 2. SUCCESS POST-SUBMISSION VIEW (International Pending Review) */}
        {isPendingReview && (
          <div className="w-full mb-10 space-y-8 animate-in fade-in duration-300">
            <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
              {/* Left Column: Property Preview Card */}
              <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xs">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  {displayPhoto && !photoError ? (
                    <img
                      src={displayPhoto}
                      alt={title?.trim() || t("host_license_preview_badge", "Listing preview")}
                      onError={() => setPhotoError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center bg-zinc-50 text-zinc-400 gap-2"
                      aria-hidden="true"
                    >
                      <span className="text-4xl">🏠</span>
                      <span className="text-xs font-medium text-zinc-500">
                        {t("host_license_preview_placeholder", "Listing preview")}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-3.5 top-3.5 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-zinc-900 shadow-xs">
                    {t("host_license_preview_badge", "Listing preview")}
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {placeType ? `${placeType} · ${category || "Home"}` : (category || "Home")}
                  </div>
                  <h3 className="truncate text-base font-medium text-zinc-900">
                    {title?.trim() || t("host_license_preview_default_title", "Your new place")}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <svg className="size-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span className="truncate">{formatLocationDisplay(city, country)}</span>
                  </div>
                  <div className="pt-2 text-xs text-zinc-600 border-t border-zinc-100">
                    {guests} {guests === 1 ? "guest" : "guests"} · {bedrooms} {bedrooms === 1 ? "bedroom" : "bedrooms"} · {beds} {beds === 1 ? "bed" : "beds"}
                  </div>
                  {price > 0 && (
                    <div className="pt-1 text-sm font-medium text-zinc-900">
                      {formatPreviewPrice(price, resolvedCurrency)}{" "}
                      <span className="text-xs font-normal text-zinc-500">{t("host_license_per_night", "per night")}</span>
                    </div>
                  )}
                </div>
              </article>

              {/* Right Column: Review Status & Milestones */}
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-medium text-zinc-900">
                      {t("host_review_status_heading", "Listing Review Progress")}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {t("host_review_status_sub", "Your listing was queued for Administrator verification")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 shrink-0">
                    <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                    {t("host_status_pending_review", "Pending review")}
                  </span>
                </div>

                <ul className="space-y-4 pt-2">
                  <li className="flex items-start gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0 text-xs">
                      ✓
                    </span>
                    <div className="text-xs sm:text-sm">
                      <p className="font-medium text-zinc-900">{t("host_timeline_submitted", "Listing details submitted")}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{t("host_timeline_submitted_desc", "We’ve safely received all your property information and photos.")}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex size-7 items-center justify-center rounded-full bg-amber-100 text-amber-800 shrink-0 text-xs">
                      ⏳
                    </span>
                    <div className="text-xs sm:text-sm">
                      <p className="font-medium text-zinc-900">{t("host_timeline_reviewing", "Administrator review in progress")}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{t("host_timeline_reviewing_desc", "Our team verifies all international property details. You'll receive notification once approved.")}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 opacity-60">
                    <span className="flex size-7 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 shrink-0 text-xs">
                      3
                    </span>
                    <div className="text-xs sm:text-sm">
                      <p className="font-medium text-zinc-800">{t("host_timeline_publish", "Ready for guest bookings")}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{t("host_timeline_publish_desc", "Once approved, your listing becomes active and bookable.")}</p>
                    </div>
                  </li>
                </ul>

                <div className="pt-4 border-t border-zinc-200/80 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/host/listings")}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-medium text-white transition hover:bg-black cursor-pointer shadow-xs"
                  >
                    {t("host_btn_go_to_listings", "Go to your listings")}
                  </button>
                  {draftId && (
                    <button
                      type="button"
                      onClick={() => router.push(`/host/listings/${draftId}`)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 cursor-pointer shadow-2xs"
                    >
                      {t("host_btn_view_listing_details", "View listing details")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. SUCCESS POST-PUBLISHING VIEW (Saudi Published live) */}
        {isApprovedOrPublished && !isPendingReview && (
          <div className="w-full mb-10 space-y-8 animate-in fade-in duration-300">
            <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
              <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xs">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  {displayPhoto && !photoError ? (
                    <img
                      src={displayPhoto}
                      alt={title?.trim() || t("host_license_preview_badge", "Listing preview")}
                      onError={() => setPhotoError(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center bg-zinc-50 text-zinc-400 gap-2"
                      aria-hidden="true"
                    >
                      <span className="text-4xl">🏠</span>
                      <span className="text-xs font-medium text-zinc-500">
                        {t("host_license_preview_placeholder", "Listing preview")}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-3.5 top-3.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-xs">
                    {t("host_status_published", "Published")}
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {placeType ? `${placeType} · ${category || "Home"}` : (category || "Home")}
                  </div>
                  <h3 className="truncate text-base font-medium text-zinc-900">
                    {title?.trim() || t("host_license_preview_default_title", "Your new place")}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <svg className="size-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span className="truncate">{formatLocationDisplay(city, country)}</span>
                  </div>
                  <div className="pt-2 text-xs text-zinc-600 border-t border-zinc-100">
                    {guests} guests · {bedrooms} bedrooms · {beds} beds
                  </div>
                  {price > 0 && (
                    <div className="pt-1 text-sm font-medium text-zinc-900">
                      {formatPreviewPrice(price, resolvedCurrency)}{" "}
                      <span className="text-xs font-normal text-zinc-500">{t("host_license_per_night", "per night")}</span>
                    </div>
                  )}
                </div>
              </article>

              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-medium text-emerald-950">
                      {t("host_published_congrats", "Congratulations! Your listing is live.")}
                    </h2>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {t("host_published_congrats_desc", "Guests can now view your property and request bookings.")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900 shrink-0">
                    <span className="size-2 rounded-full bg-emerald-600" />
                    {t("host_status_published", "Published")}
                  </span>
                </div>

                <div className="pt-4 border-t border-emerald-200/80 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/host/listings")}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1F1F1F] px-5 text-sm font-medium text-white transition hover:bg-black cursor-pointer shadow-xs"
                  >
                    {t("host_btn_go_to_listings", "Go to your listings")}
                  </button>
                  {draftId && (
                    <button
                      type="button"
                      onClick={() => router.push(`/host/listings/${draftId}`)}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 cursor-pointer shadow-2xs"
                    >
                      {t("host_btn_view_listing_details", "View listing details")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. PRE-SUBMISSION VIEW (Scenario A: International OR Scenario B: Saudi Eligible) */}
        {!isLoadingVerification && !isPendingReview && !isApprovedOrPublished && canPublish && (
          <div className="w-full space-y-6">
            <section className="grid w-full gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
              {/* Left Column: Clean, Professional Listing Preview Card */}
              <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xs transition hover:shadow-md">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  {displayPhoto && !photoError ? (
                    <img
                      src={displayPhoto}
                      alt={title?.trim() || t("host_license_preview_badge", "Listing preview")}
                      onError={() => setPhotoError(true)}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center bg-zinc-50 text-zinc-400 gap-2"
                      aria-hidden="true"
                    >
                      <span className="text-4xl">🏠</span>
                      <span className="text-xs font-medium text-zinc-500">
                        {t("host_license_preview_placeholder", "No photo uploaded")}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-3.5 top-3.5 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-zinc-900 shadow-xs">
                    {t("host_license_preview_badge", "Listing preview")}
                  </span>
                  {draftId && (
                    <a
                      href={`/listings/${draftId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3.5 top-3.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 shadow-xs transition flex items-center gap-1"
                      aria-label={t("host_preview_listing_action", "Preview listing in new tab")}
                    >
                      <span>{t("host_preview_badge_preview", "Preview")}</span>
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  )}
                </div>

                <div className="p-5 space-y-2.5">
                  <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {placeType ? `${placeType} · ${category || "Home"}` : (category || "Home")}
                  </div>

                  <h3 className="truncate text-base font-medium text-zinc-900">
                    {title?.trim() || t("host_license_preview_default_title", "Your new place")}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <svg className="size-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span className="truncate">{formatLocationDisplay(city, country) || t("host_license_preview_default_city", "Your property location")}</span>
                  </div>

                  <div className="pt-2 text-xs text-zinc-600 border-t border-zinc-100 flex items-center gap-1.5">
                    <span>{guests} {guests === 1 ? t("host_guest_singular", "guest") : t("host_guests_plural", "guests")}</span>
                    <span>·</span>
                    <span>{bedrooms} {bedrooms === 1 ? t("host_bedroom_singular", "bedroom") : t("host_bedrooms_plural", "bedrooms")}</span>
                    <span>·</span>
                    <span>{beds} {beds === 1 ? t("host_bed_singular", "bed") : t("host_beds_plural", "beds")}</span>
                  </div>

                  {price > 0 && (
                    <div className="pt-1 text-sm font-medium text-zinc-900">
                      {formatPreviewPrice(price, resolvedCurrency)}{" "}
                      <span className="text-xs font-normal text-zinc-500">{t("host_license_per_night", "per night")}</span>
                    </div>
                  )}
                </div>
              </article>

              {/* Right Column: Workflow Steps */}
              <div>
                {!isSaudi ? (
                  // Scenario A: International Property Workflow
                  <div>
                    <h2 className="text-xl font-medium tracking-tight text-[#1F1F1F]">
                      {t("host_review_whats_next_title", "What happens next?")}
                    </h2>
                    <ul className="mt-5 space-y-5">
                      <li className="flex gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                          aria-hidden="true"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">
                            {t("host_review_step1_title", "Submit for review")}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {t("host_review_step1_desc", "Send your listing to our team for review.")}
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                          aria-hidden="true"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                          </svg>
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">
                            {t("host_review_step2_title", "We review your listing")}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {t("host_review_step2_desc", "Our team will check your property details and information.")}
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                          aria-hidden="true"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.458m8.26-8.243l-4.706 4.707" />
                          </svg>
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">
                            {t("host_review_step3_title", "Your listing goes live")}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {t("host_review_step3_desc", "Once approved, your listing will be published and ready for bookings.")}
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>
                ) : (
                  // Scenario B: Saudi Property Eligible Workflow
                  <div>
                    <h2 className="text-xl font-medium tracking-tight text-[#1F1F1F]">
                      {t("host_license_whats_next_title", "What’s next?")}
                    </h2>
                    <ul className="mt-5 space-y-5">
                      <li className="flex gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                          aria-hidden="true"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                          </svg>
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">
                            {t("host_license_next_calendar_title", "Set up your calendar")}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {t("host_license_next_calendar_desc", "Choose which dates are available. Guests can start booking after your listing is published.")}
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                          aria-hidden="true"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">
                            {t("host_license_next_settings_title", "Review your booking preferences")}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {t("host_license_next_settings_desc", "Update house rules, cancellation policy, and booking preferences whenever you need to.")}
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-3.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                          aria-hidden="true"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </span>
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900">
                            {t("host_license_next_prepare_title", "Get ready for your first guest")}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-zinc-600">
                            {t("host_license_next_prepare_desc", "We’ll help you get ready with practical hosting guidance after publication.")}
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* Subtle bottom informational section */}
            {!isSaudi ? (
              <div className="w-full rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 sm:p-5 flex items-start gap-3.5 text-xs sm:text-sm text-zinc-600">
                <svg className="size-5 shrink-0 text-zinc-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="leading-relaxed">
                  {t("host_review_info_notice", "Your listing will remain unpublished until it has been reviewed and approved.")}
                </p>
              </div>
            ) : (
              <div className="w-full rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 sm:p-5 flex items-start gap-3.5 text-xs sm:text-sm text-emerald-800">
                <svg className="size-5 shrink-0 text-emerald-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="leading-relaxed">
                  {t("host_saudi_instant_notice", "Your property license is verified. Your listing will be published immediately upon completion.")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 5. INVALID LICENSE STATE (Saudi Only) */}
        {!isLoadingVerification && isSaudi && verificationStatus === "invalid" && !isPendingReview && !isApprovedOrPublished && (
          <section
            className="w-full rounded-3xl border border-rose-200 bg-rose-50/60 p-6 sm:p-8 mb-8"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-medium text-rose-900">
                  {t("host_license_invalid_banner_title", "License validation unsuccessful")}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-rose-800">
                  {inlineError ||
                    t(
                      "host_license_invalid_banner_desc",
                      "We couldn't validate your property license using the registration details provided. Please review your information before publishing."
                    )}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onEditRegistration}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-zinc-900 border border-zinc-300 shadow-xs transition hover:bg-zinc-50 cursor-pointer"
                  >
                    {t("host_license_btn_edit_details", "Edit registration details")}
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-transparent px-4 text-sm font-medium text-zinc-700 transition hover:text-zinc-900 underline cursor-pointer"
                  >
                    {t("host_license_btn_try_again", "Try again")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 6. EXPIRED LICENSE STATE (Saudi Only) */}
        {!isLoadingVerification && isSaudi && verificationStatus === "expired" && !isPendingReview && !isApprovedOrPublished && (
          <section
            className="w-full rounded-3xl border border-amber-200 bg-amber-50/60 p-6 sm:p-8 mb-8"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-medium text-amber-900">
                  {t("host_license_expired_banner_title", "License has expired")}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
                  {inlineError ||
                    t(
                      "host_license_expired_banner_desc",
                      "Your property license is no longer valid. Please renew your permit and update your registration details before publishing your listing."
                    )}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onEditRegistration}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-zinc-900 border border-zinc-300 shadow-xs transition hover:bg-zinc-50 cursor-pointer"
                  >
                    {t("host_license_btn_edit_details", "Edit registration details")}
                  </button>
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-transparent px-4 text-sm font-medium text-zinc-700 transition hover:text-zinc-900 underline cursor-pointer"
                  >
                    {t("host_license_btn_try_again", "Try again")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 7. API FAILURE / ERROR STATE (Saudi Only) */}
        {!isLoadingVerification && isSaudi && verificationStatus === "error" && !isPendingReview && !isApprovedOrPublished && (
          <section
            className="w-full rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8 mb-8"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-200 text-zinc-700">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0-10.5a9 9 0 110 18 9 9 0 010-18zm0 14.25h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-medium text-zinc-900">
                  {t(
                    "host_license_error_banner_title",
                    "Verification temporarily unavailable"
                  )}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                  {inlineError ||
                    t(
                      "host_license_error_banner_desc",
                      "License verification is temporarily unavailable. Please try again or save your listing as a draft."
                    )}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 cursor-pointer"
                  >
                    {t("host_license_btn_try_again", "Try again")}
                  </button>
                  <button
                    type="button"
                    onClick={onEditRegistration}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-medium text-zinc-900 border border-zinc-300 shadow-xs transition hover:bg-zinc-50 cursor-pointer"
                  >
                    {t("host_license_btn_edit_details", "Edit registration details")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <StepProgressFooter
        currentStep={22}
        totalSteps={22}
        onBack={onBack}
        onNext={handleNextAction}
        isLoading={isBusy}
        disableNext={isBusy || isLoadingVerification}
        nextLabel={footerNextLabel}
      />
    </OnboardingStepLayout>
  );
}
