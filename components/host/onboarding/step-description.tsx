"use client";

import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { useLanguage } from "@/lib/i18n/language-context";


interface StepDescriptionProps {
  description: string;
  onChangeDescription: (description: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepDescription({
  description,
  onChangeDescription,
  onBack,
  onNext,
  isLoading = false,
}: StepDescriptionProps) {
  const { t } = useLanguage();
  const maxChars = 500;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxChars) {
      onChangeDescription(val);
    }
  };

  return (
    <OnboardingStepLayout
      isLoading={isLoading}
      mainClassName="step-description min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16"
      wrapperClassName="wrapper flex-1 w-full flex flex-col sm:justify-center animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]"
    >

      <div className="max-w-187 mx-auto w-full flex flex-col items-start">
        <OnboardingStepHeading
          title={t("host_description_title")}
          description={t("host_description_subtitle")}
          titleClassName="mb-3"
          descriptionClassName="sm:mb-10 mb-6"
        />

        {/* Description Input Card Container */}
        <div data-aos="fade-up" data-aos-delay="200" className="flex w-full max-w-2xl flex-col rounded-xl border border-white bg-[#F3F4F5] px-3 py-4 shadow-[0px_2px_4px_rgba(0,0,0,0.25)] sm:py-6">
          <div className="flex sm:flex-col flex-row sm:items-start items-center sm:justify-start justify-between">
            <label htmlFor="property-description" className="text-lg font-medium text-[#1F1F1F] mb-2">
              {t("host_your_description")}
            </label>
            <span className="text-xs font-semibold text-[#727272] mb-3">
              {description.length}/{maxChars}
            </span>
          </div>

          <textarea
            id="property-description"
            rows={9}
            maxLength={maxChars}
            value={description}
            onChange={handleChange}
            className="min-h-[220px] w-full resize-y rounded-lg bg-white p-4 text-sm font-normal text-[#727272] shadow-2xs transition-shadow focus:outline-none focus:ring-1 focus:ring-[#727272] sm:min-h-[280px] sm:text-base"
          />
        </div>
      </div>

      <StepProgressFooter currentStep={6} totalSteps={6} onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </OnboardingStepLayout>
  );
}
