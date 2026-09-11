"use client";

import { Container } from "@/components/ui";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";


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
  const maxChars = 500;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxChars) {
      onChangeDescription(val);
    }
  };

  return (
    <main className="step-description min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-4xl mx-auto w-full flex flex-col items-start">
            {/* Main Title & Subtitle */}
            <h1 className="sm:mb-3 mb-10">
              Create your description
            </h1>
            <p className="sm:mb-10 mb-6">
              Tell us what makes your place special.
            </p>

            {/* Description Input Card Container */}
            <div className="w-full max-w-2xl bg-[#F3F4F5] border border-white rounded-xl px-3 sm:py-6 py-3 flex flex-col shadow-[0px_2px_4px_rgba(0,0,0,0.25)]">
              <div className="flex sm:flex-col flex-row sm:items-start items-center sm:justify-start justify-between">
                <label htmlFor="property-description" className="text-lg font-medium text-[#1F1F1F] mb-2">
                  Your description
                </label>
                <span className="text-xs font-semibold text-zinc-400 mb-3">
                  {description.length}/{maxChars}
                </span>
              </div>

              <textarea
                id="property-description"
                rows={5}
                maxLength={maxChars}
                value={description}
                onChange={handleChange}
                className="w-full bg-white rounded-lg p-4 sm:text-base text-sm font-normal text-[#727272] focus:outline-none focus:ring-1 focus:ring-[#727272] resize-none shadow-2xs transition-shadow max-h-[126px]"
              />
            </div>
          </div>

          <StepProgressFooter
            currentStep={6}
            totalSteps={6}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
        </div>
      </Container>
    </main>
  );
}
