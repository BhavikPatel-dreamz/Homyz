"use client";

import { useEffect, useState } from "react";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { StepProgressFooter } from "./step-progress-footer";
import { isSaudiArabia } from "@/lib/location/address-countries";
import { useLanguage } from "@/lib/i18n/language-context";

type LicenseResult = {
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
  onVerify: (licenseNumber: string) => Promise<LicenseResult>;
  onSubmit: (method: "automatic" | "manual") => Promise<void>;
  isPublishing?: boolean;
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
  onSubmit,
  isPublishing = false,
}: StepLicenseApprovalProps) {
  const { t } = useLanguage();
  const isSaudi = isSaudiArabia(country);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [result, setResult] = useState<LicenseResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSaudi || !draftId) return;
    const controller = new AbortController();
    void fetch(`/api/v1/host/licenses/status?listingId=${encodeURIComponent(draftId)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => {
        const saved = body?.data;
        if (!saved) return;
        setLicenseNumber(saved.licenseNumber ?? "");
        setResult({
          licenseNumber: saved.licenseNumber,
          status: saved.status,
          expiryDate: saved.expiryDate,
          eligibilityStatus: saved.eligibilityStatus,
          automaticApprovalAvailable: Boolean(saved.automaticApprovalAvailable),
          simulated: Boolean(saved.simulated),
          error: null,
          lastVerifiedAt: saved.lastVerifiedAt,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [draftId, isSaudi]);

  const verify = async () => {
    if (!licenseNumber.trim()) {
      setMessage(t("host_license_err_enter_number", "Enter your Saudi Arabia license number to verify it."));
      return;
    }
    setIsVerifying(true);
    setMessage(null);
    try {
      const next = await onVerify(licenseNumber);
      setResult(next);
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : t("host_license_err_unavailable", "License verification is temporarily unavailable."));
    } finally {
      setIsVerifying(false);
    }
  };

  const canAutoApprove = Boolean(result?.automaticApprovalAvailable);
  const submitLabel = isSaudi
    ? t("host_license_btn_save_publish", "Save and publish")
    : t("host_license_btn_save_submit", "Save and submit for review");

  const updateLicenseNumber = (value: string) => {
    setLicenseNumber(value);
    // A verification is tied to the exact normalized number. Never allow a
    // host to publish using a result that belongs to a previous input value.
    if (result && value.trim().toUpperCase().replace(/\s+/g, "") !== result.licenseNumber.trim().toUpperCase().replace(/\s+/g, "")) {
      setResult(null);
      setMessage(t("host_license_err_number_changed", "License number changed. Verify the new number before publishing."));
    }
  };

  return (
    <OnboardingStepLayout
      isLoading={isPublishing}
      mainClassName="min-h-dvh bg-white pb-8 sm:py-10 lg:pt-16 lg:pb-16"
      wrapperClassName="wrapper flex min-h-[calc(100dvh-10.25rem)] w-full flex-1 flex-col sm:justify-between"
    >
      <div className="mx-auto my-auto flex w-full max-w-4xl flex-col items-start">
        <OnboardingStepHeading
          title={t("host_license_step_title", "Yay! It’s time to publish.")}
          description={t("host_license_step_desc", "Here’s what we’ll show to guests. Review the details, then finish your listing.")}
          titleClassName="mb-3"
          descriptionClassName="mb-8 max-w-2xl"
        />

        <section className="mb-10 grid w-full gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-center" data-aos="fade-up">
          <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
            <div className="relative aspect-[4/3] bg-zinc-100">
              {photos[0] ? (
                <img src={photos[0]} alt={t("host_license_preview_badge", "Listing preview")} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl" aria-hidden="true">🏠</div>
              )}
              <span className="absolute left-3 top-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm">
                {t("host_license_preview_badge", "Listing preview")}
              </span>
            </div>
            <div className="border-t border-zinc-100 p-4">
              <div className="truncate text-sm font-semibold text-zinc-900">
                {title.trim() || t("host_license_preview_default_title", "Your new place")}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {city || t("host_license_preview_default_city", "Your property location")}
              </div>
              {price > 0 && (
                <div className="mt-3 text-sm font-semibold text-zinc-900">
                  {price.toLocaleString()} {t("host_license_per_night", "per night")}
                </div>
              )}
            </div>
          </article>

          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#1F1F1F]">
              {t("host_license_whats_next_title", "What’s next?")}
            </h2>
            <ul className="mt-5 space-y-5">
              <li className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg" aria-hidden="true">▣</span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {t("host_license_next_calendar_title", "Set up your calendar")}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    {t("host_license_next_calendar_desc", "Choose which dates are available. Guests can start booking after your listing is published.")}
                  </p>
                </div>
              </li>
              <li className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg" aria-hidden="true">✎</span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {t("host_license_next_settings_title", "Adjust your settings")}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    {t("host_license_next_settings_desc", "Update house rules, cancellation policy, and booking preferences whenever you need to.")}
                  </p>
                </div>
              </li>
              <li className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-lg" aria-hidden="true">✦</span>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {t("host_license_next_prepare_title", "Prepare for your first guest")}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    {t("host_license_next_prepare_desc", "We’ll help you get ready with practical hosting guidance after publication.")}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {isSaudi ? (
          <div className="w-full space-y-5" data-aos="fade-up">
            <div>
              <h2 className="text-xl font-semibold text-[#1F1F1F]">
                {t("host_license_verify_section_title", "Verify your property license")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {t("host_license_verify_section_desc", "Verify your Saudi Arabia property license to check whether your listing can be published automatically.")}
              </p>
            </div>
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:p-6">
              <label htmlFor="saudi-license-number" className="mb-2 block text-sm font-semibold text-[#1F1F1F]">
                {t("host_license_saudi_number_label", "Saudi Arabia license number")}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="saudi-license-number"
                  value={licenseNumber}
                  onChange={(event) => updateLicenseNumber(event.target.value)}
                  placeholder={t("host_license_saudi_placeholder", "Enter your license number")}
                  maxLength={120}
                  className="min-h-12 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-[#1F1F1F]"
                />
                <button
                  type="button"
                  onClick={verify}
                  disabled={isVerifying || isPublishing}
                  className="min-h-12 rounded-xl bg-[#1F1F1F] px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifying
                    ? t("host_license_btn_verifying", "Verifying…")
                    : t("host_license_btn_verify", "Verify license")}
                </button>
              </div>
            </section>

            {message && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</p>}

            {result && (
              <section className={`rounded-2xl border p-5 sm:p-6 ${result.status === "ACTIVE" && result.eligibilityStatus === "ELIGIBLE" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <h2 className="text-base font-semibold text-[#1F1F1F]">
                  {result.status === "ACTIVE" && result.eligibilityStatus === "ELIGIBLE"
                    ? t("host_license_status_verified", "License verified successfully")
                    : t("host_license_status_result", "License verification result")}
                </h2>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-500">{t("host_license_field_number", "License number")}</dt>
                    <dd className="font-medium text-zinc-900">{result.licenseNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">{t("host_license_field_status", "Status")}</dt>
                    <dd className="font-medium text-zinc-900">{result.status}</dd>
                  </div>
                  {result.expiryDate && (
                    <div>
                      <dt className="text-zinc-500">{t("host_license_field_expires", "Expires")}</dt>
                      <dd className="font-medium text-zinc-900">{new Date(result.expiryDate).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {result.lastVerifiedAt && (
                    <div>
                      <dt className="text-zinc-500">{t("host_license_field_last_verified", "Last verified")}</dt>
                      <dd className="font-medium text-zinc-900">{new Date(result.lastVerifiedAt).toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
                {result.error && <p className="mt-4 text-sm text-rose-800">{result.error}</p>}
                {result.simulated && (
                  <p className="mt-4 text-xs font-medium text-amber-800">
                    {t("host_license_sandbox_note", "Sandbox result — this can demonstrate the flow locally but can never publish a production listing.")}
                  </p>
                )}
              </section>
            )}
          </div>
        ) : (
          <section className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-6 text-zinc-700 sm:p-6" data-aos="fade-up">
            <h2 className="text-base font-semibold text-zinc-900">
              {t("host_license_manual_section_title", "Submit your listing for review")}
            </h2>
            <p className="mt-2">
              {t("host_license_manual_section_desc", "Your listing details are ready to be submitted through the existing manual approval workflow. It will remain unpublished until an administrator reviews and approves it.")}
            </p>
          </section>
        )}
      </div>

      <StepProgressFooter
        currentStep={21}
        totalSteps={21}
        onBack={onBack}
        onNext={() => void onSubmit(isSaudi ? "automatic" : "manual")}
        isLoading={isPublishing}
        disableNext={isSaudi && !canAutoApprove}
        nextLabel={submitLabel}
      />
    </OnboardingStepLayout>
  );
}
