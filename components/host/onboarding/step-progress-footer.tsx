"use client";

import React from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import { useLanguage } from "@/lib/i18n/language-context";

interface StepProgressFooterProps {
  currentStep: number;
  totalSteps?: number;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
  nextLabel?: React.ReactNode;
  disableNext?: boolean;
}

export function StepProgressFooter({
  currentStep,
  totalSteps = 6,
  onBack,
  onNext,
  isLoading = false,
  nextLabel,
  disableNext = false,
}: StepProgressFooterProps) {
  const { t } = useLanguage();
  const displayNextLabel = nextLabel ?? t("host_next");

  return (
    <div className="sm:mt-18 mt-auto pt-8">
      {/* Action Buttons */}
      <div className="flex items-center justify-end">
        <OnboardingBackButton
          onClick={onBack}
          disabled={isLoading}
        />
        <OnboardingPrimaryButton
          onClick={onNext}
          disabled={disableNext}
          isLoading={isLoading}
          loadingLabel={t("host_saving")}
          label={displayNextLabel}
        />

      </div>
      {/* Progress Dots Bar */}
      <div className="flex items-center justify-center gap-3 mt-11">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const isActive = currentStep === stepNum;
          return (
            <div
              key={idx}
              className={`w-2.5 rounded-full transition-all duration-200 ${isActive ? "h-7 bg-[#EBA900]" : "h-5 bg-[#DDDDDE]"
                }`}
            />
          );
        })}
      </div>

    </div>
  );
}
