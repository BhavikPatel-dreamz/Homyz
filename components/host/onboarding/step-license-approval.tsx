"use client";

import { useEffect, useRef, useState } from "react";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { StepProgressFooter } from "./step-progress-footer";
import { isSaudiArabia } from "@/lib/location/address-countries";
import { useLanguage } from "@/lib/i18n/language-context";

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

export function StepLicenseApproval({
  draftId,
  country,
  title,
  city,
  price,
  photos,
  onBack,
  onVerify,
  onEditRegistration,
  onSubmit,
  onSaveDraft,
  isPublishing = false,
  isSavingDraft = false,
}: StepLicenseApprovalProps) {
  const { t } = useLanguage();
  const isSaudi = isSaudiArabia(country);

  const [verificationStatus, setVerificationStatus] =
    useState<LicenseVerificationStatus>(isSaudi ? "verifying" : "valid");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const verificationRequestRef = useRef(0);

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
    if (!isSaudi || !draftId) {
      verificationRequestRef.current += 1;
      setVerificationStatus(isSaudi ? "idle" : "valid");
      setInlineError(null);
      return;
    }

    void verify();
  }, [draftId, isSaudi]);

  const retry = () => {
    void verify();
  };

  // Select the cover photo from draft photos
  const displayPhoto =
    photos && photos.length > 0 && typeof photos[0] === "string" && photos[0].trim()
      ? photos[0]
      : null;

  // Headings mapping based strictly on current verification status
  let headingTitle = t("host_license_step_title", "Yay! It’s time to publish.");
  let headingDescription = t(
    "host_license_step_desc",
    "Here’s what we’ll show to guests. Review the details, then finish your listing."
  );

  if (isSaudi) {
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
        headingTitle = t("host_license_step_title", "Yay! It’s time to publish.");
        headingDescription = t(
          "host_license_step_desc",
          "Here’s what we’ll show to guests. Review the details, then finish your listing."
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
  const isLoadingVerification = isSaudi && (verificationStatus === "verifying" || verificationStatus === "idle");
  const isBusy = isPublishing || isSavingDraft;

  const handleNextAction = () => {
    if (canPublish) {
      void onSubmit(isSaudi ? "automatic" : "manual");
    } else if (onSaveDraft) {
      void onSaveDraft();
    }
  };

  const footerNextLabel = canPublish
    ? isSaudi
      ? t("host_license_btn_save_publish", "Save and publish")
      : t("host_license_btn_save_submit", "Save and submit for review")
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

        {/* 1. LOADING SCREEN (Saudi verifying / idle state) */}
        {isLoadingVerification && (
          <div className="w-full flex justify-center py-6 sm:py-8" aria-live="polite">
            {/* Centered Loading Indicator Card */}
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

        {/* 2. SUCCESS SCREEN (Valid License or Non-Saudi) */}
        {!isLoadingVerification && canPublish && (
          <section className="mb-10 grid w-full gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-center">
            {/* Left Column: Listing Preview Card */}
            <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
              <div className="relative aspect-[4/3] bg-zinc-100">
                {displayPhoto && !photoError ? (
                  <img
                    src={displayPhoto}
                    alt={t("host_license_preview_badge", "Listing preview")}
                    onError={() => setPhotoError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full flex-col items-center justify-center bg-zinc-50 text-zinc-400"
                    aria-hidden="true"
                  >
                    <span className="text-4xl">🏠</span>
                    <span className="mt-2 text-xs font-medium text-zinc-500">
                      {t("host_license_preview_placeholder", "Listing preview")}
                    </span>
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-xs">
                  {t("host_license_preview_badge", "Listing preview")}
                </span>
              </div>
              <div className="border-t border-zinc-100 p-4">
                <div className="truncate text-sm font-medium text-zinc-900">
                  {title?.trim() || t("host_license_preview_default_title", "Your new place")}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {city || t("host_license_preview_default_city", "Your property location")}
                </div>
                {price > 0 && (
                  <div className="mt-3 text-sm font-medium text-zinc-900">
                    {price.toLocaleString()} {t("host_license_per_night", "per night")}
                  </div>
                )}
              </div>
            </article>

            {/* Right Column: What's next? section */}
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
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.75"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">
                      {t("host_license_next_calendar_title", "Set up your calendar")}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      {t(
                        "host_license_next_calendar_desc",
                        "Choose which dates are available. Guests can start booking after your listing is published."
                      )}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                    aria-hidden="true"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.75"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">
                      {t("host_license_next_settings_title", "Adjust your settings")}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      {t(
                        "host_license_next_settings_desc",
                        "Update house rules, cancellation policy, and booking preferences whenever you need to."
                      )}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
                    aria-hidden="true"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900">
                      {t(
                        "host_license_next_prepare_title",
                        "Prepare for your first guest"
                      )}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      {t(
                        "host_license_next_prepare_desc",
                        "We’ll help you get ready with practical hosting guidance after publication."
                      )}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>
        )}

        {/* 3. NON-SAUDI REVIEW SECTION */}
        {!isSaudi && (
          <section className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700 sm:p-6 mb-8">
            <h2 className="text-base font-medium text-zinc-900">
              {t("host_license_manual_section_title", "Submit your listing for review")}
            </h2>
            <p className="mt-2 text-zinc-600">
              {t(
                "host_license_manual_section_desc",
                "Your listing details are ready to be submitted through the existing manual approval workflow. It will remain unpublished until an administrator reviews and approves it."
              )}
            </p>
          </section>
        )}

        {/* 4. INVALID LICENSE STATE */}
        {!isLoadingVerification && isSaudi && verificationStatus === "invalid" && (
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

        {/* 5. EXPIRED LICENSE STATE */}
        {!isLoadingVerification && isSaudi && verificationStatus === "expired" && (
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

        {/* 6. API FAILURE / ERROR STATE */}
        {!isLoadingVerification && isSaudi && verificationStatus === "error" && (
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
