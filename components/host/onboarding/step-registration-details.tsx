"use client";

import { useEffect, useState } from "react";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { StepProgressFooter } from "./step-progress-footer";

export type SaudiRegistrationDetails = {
  accommodationType: string;
  licenseNumber: string;
  nationalId: string;
  complete?: boolean;
};

type Props = {
  draftId: string | null;
  initialDetails: SaudiRegistrationDetails | null;
  onBack: () => void;
  onContinue: (details: SaudiRegistrationDetails) => Promise<void>;
  isSaving?: boolean;
};

export const PRIVATE_ACCOMMODATION_TYPE = "PRIVATE_SHORT_TERM_RENTAL";
export const TRADITIONAL_ACCOMMODATION_TYPE = "TRADITIONAL_ACCOMMODATION";

export function resolveAccommodationType(type?: string | null): string {
  if (type === TRADITIONAL_ACCOMMODATION_TYPE) return TRADITIONAL_ACCOMMODATION_TYPE;
  return PRIVATE_ACCOMMODATION_TYPE;
}

export function StepRegistrationDetails({
  draftId,
  initialDetails,
  onBack,
  onContinue,
  isSaving = false,
}: Props) {

  const [details, setDetails] = useState<SaudiRegistrationDetails>(() => ({
    accommodationType: resolveAccommodationType(initialDetails?.accommodationType),
    licenseNumber: initialDetails?.licenseNumber || "",
    nationalId: initialDetails?.nationalId || "",
    complete: initialDetails?.complete,
  }));

  const [errors, setErrors] = useState<Partial<Record<keyof SaudiRegistrationDetails, string>>>({});

  // Sync state when initial details are loaded asynchronously from draft
  useEffect(() => {
    if (initialDetails) {
      setDetails((prev) => ({
        accommodationType: initialDetails.accommodationType
          ? resolveAccommodationType(initialDetails.accommodationType)
          : prev.accommodationType || PRIVATE_ACCOMMODATION_TYPE,
        licenseNumber: initialDetails.licenseNumber || prev.licenseNumber || "",
        nationalId: initialDetails.nationalId || prev.nationalId || "",
        complete: initialDetails.complete,
      }));
    }
  }, [initialDetails]);

  const submit = async () => {
    const next: Partial<Record<keyof SaudiRegistrationDetails, string>> = {};
    const effectiveType = resolveAccommodationType(details.accommodationType);
    const permit = details.licenseNumber.trim().toUpperCase().replace(/\s+/g, "");
    const nationalId = details.nationalId.replace(/[\s-]+/g, "");

    if (
      effectiveType !== PRIVATE_ACCOMMODATION_TYPE &&
      effectiveType !== TRADITIONAL_ACCOMMODATION_TYPE
    ) {
      next.accommodationType = "Select an accommodation type.";
    }
    if (!/^[A-Z0-9][A-Z0-9-]{2,119}$/.test(permit)) {
      next.licenseNumber = "Enter a valid property permit number.";
    }
    if (!/^[12]\d{9}$/.test(nationalId)) {
      next.nationalId = "Enter a valid 10-digit national identification number.";
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    await onContinue({
      accommodationType: effectiveType,
      licenseNumber: permit,
      nationalId,
    });
  };

  return (
    <OnboardingStepLayout
      isLoading={isSaving}
      mainClassName="min-h-dvh bg-white pb-8 sm:py-10 lg:pt-16 lg:pb-16"
      wrapperClassName="wrapper flex min-h-[calc(100dvh-10.25rem)] w-full flex-1 flex-col sm:justify-between"
    >
      <div className="mx-auto my-auto w-full max-w-2xl">
        <OnboardingStepHeading
          title="Add registration details"
          description="Enter your registration details to verify your property license before publishing your listing."
          titleClassName="mb-3"
          descriptionClassName="mb-8 max-w-xl"
        />
        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs sm:p-8">
          <div className="space-y-6">
            <div>
              <label
                htmlFor="accommodation-type"
                className="mb-2 block text-sm font-medium text-zinc-900"
              >
                Accommodation type
              </label>
              <select
                id="accommodation-type"
                value={details.accommodationType || PRIVATE_ACCOMMODATION_TYPE}
                onChange={(event) => {
                  const val = event.target.value;
                  setDetails((current) => ({
                    ...current,
                    accommodationType: val,
                  }));
                  if (errors.accommodationType) {
                    setErrors((prev) => ({ ...prev, accommodationType: undefined }));
                  }
                }}
                aria-invalid={Boolean(errors.accommodationType)}
                aria-describedby={
                  errors.accommodationType ? "accommodation-type-error" : undefined
                }
                className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-zinc-900"
              >
                <option value={PRIVATE_ACCOMMODATION_TYPE}>
                  I am hosting a private accommodation facility (Short-term rental)
                </option>
                <option value={TRADITIONAL_ACCOMMODATION_TYPE}>
                  I am hosting a traditional accommodation (Hotel, Hostel, Serviced Apartment)
                </option>
              </select>
              {errors.accommodationType && (
                <p
                  id="accommodation-type-error"
                  role="alert"
                  className="mt-2 text-sm text-rose-700"
                >
                  {errors.accommodationType}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="property-permit"
                className="mb-2 block text-sm font-medium text-zinc-900"
              >
                Private tourism accommodation activity License number
              </label>
              <input
                id="property-permit"
                value={details.licenseNumber}
                onChange={(event) => {
                  const val = event.target.value;
                  setDetails((current) => ({
                    ...current,
                    licenseNumber: val,
                  }));
                  if (errors.licenseNumber) {
                    setErrors((prev) => ({ ...prev, licenseNumber: undefined }));
                  }
                }}
                placeholder="Enter your property license number"
                maxLength={120}
                autoCapitalize="characters"
                aria-invalid={Boolean(errors.licenseNumber)}
                aria-describedby={errors.licenseNumber ? "property-permit-error" : undefined}
                className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 text-sm outline-none transition focus:border-zinc-900"
              />
              {errors.licenseNumber && (
                <p id="property-permit-error" role="alert" className="mt-2 text-sm text-rose-700">
                  {errors.licenseNumber}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="national-id"
                className="mb-2 block text-sm font-medium text-zinc-900"
              >
                National identification number
              </label>
              <input
                id="national-id"
                value={details.nationalId}
                onChange={(event) => {
                  const val = event.target.value.replace(/[^0-9\s-]/g, "");
                  setDetails((current) => ({
                    ...current,
                    nationalId: val,
                  }));
                  if (errors.nationalId) {
                    setErrors((prev) => ({ ...prev, nationalId: undefined }));
                  }
                }}
                placeholder="Enter your national identification number"
                inputMode="numeric"
                maxLength={12}
                autoComplete="off"
                aria-invalid={Boolean(errors.nationalId)}
                aria-describedby={errors.nationalId ? "national-id-error" : undefined}
                className="min-h-12 w-full rounded-xl border border-zinc-300 px-4 text-sm outline-none transition focus:border-zinc-900"
              />
              {errors.nationalId && (
                <p id="national-id-error" role="alert" className="mt-2 text-sm text-rose-700">
                  {errors.nationalId}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
      <StepProgressFooter
        currentStep={21}
        totalSteps={22}
        onBack={onBack}
        onNext={() => void submit()}
        isLoading={isSaving}
        disableNext={!draftId || isSaving}
        nextLabel="Continue"
      />
    </OnboardingStepLayout>
  );
}
