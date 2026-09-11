"use client";

import { Container } from "@/components/ui";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface StepTitleProps {
  title: string;
  onChangeTitle: (title: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepTitle({
  title,
  onChangeTitle,
  onBack,
  onNext,
  isLoading = false,
}: StepTitleProps) {
  const maxChars = 50;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxChars) {
      onChangeTitle(val);
    }
  };

  return (
    <main className="step-title min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">

          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-187 mx-auto w-full flex flex-col items-start">
            {/* Main Title & Subtitle */}
            <h1 data-aos="fade-up" className="sm:mb-5 mb-3">
              Now, it’s time to give your house a title
            </h1>
            <p data-aos="fade-up" data-aos-delay="100" className="sm:mb-10 mb-8">
              Short title work best. Have fun with it - you can always change it later
            </p>

            {/* Title Input Card Container */}
            <div data-aos="fade-up" data-aos-delay="200" className="w-full max-w-2xl bg-[#F3F4F5] border border-white rounded-xl px-3 sm:py-6 py-3 flex flex-col shadow-[0px_2px_4px_rgba(0,0,0,0.25)]">
              <div className="flex sm:flex-col flex-row sm:items-start items-center sm:justify-start justify-between">
                <label htmlFor="property-title" className="text-lg font-medium text-[#1F1F1F] mb-2">
                  Your title
                </label>
                <span className="text-xs font-medium text-[#727272] mb-1">
                  {title.length}/{maxChars}
                </span>
              </div>

              <textarea
                id="property-title"
                rows={4}
                maxLength={maxChars}
                value={title}
                onChange={handleChange}
                className="w-full bg-white rounded-lg p-4 sm:text-base text-sm font-normal text-[#727272] focus:outline-none focus:ring-1 focus:ring-[#727272] resize-none shadow-2xs transition-shadow max-h-[126px]"
              />
            </div>
          </div>

          <StepProgressFooter
            currentStep={4}
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
