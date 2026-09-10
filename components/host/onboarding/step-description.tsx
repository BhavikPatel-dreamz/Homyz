"use client";

import { Container } from "@/components/ui";
import React from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";

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
  const minChars = 10;
  const maxChars = 5000;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxChars) {
      onChangeDescription(val);
    }
  };

  return (
    <main className="py-10">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <div className="max-w-4xl mx-auto w-full flex flex-col items-start my-auto">
            {/* Main Title & Subtitle */}
            <h1 className="mb-2">
              Create your description
            </h1>
            <p className="text-sm font-medium text-zinc-500 mb-10">
              Tell us what makes your place special.
            </p>

            {/* Description Input Card Container */}
            <div className="w-full max-w-2xl bg-zinc-50/80 border border-zinc-200/90 rounded-3xl p-6 sm:p-8 flex flex-col shadow-2xs">
              <label htmlFor="property-description" className="text-sm font-semibold text-[#1F1F1F] mb-1">
                Your description
              </label>
              <span className="text-xs font-semibold text-zinc-400 mb-3">
                {description.length}/{maxChars} (minimum {minChars})
              </span>

              <textarea
                id="property-description"
                rows={5}
                maxLength={maxChars}
                value={description}
                onChange={handleChange}
                placeholder="Have fun with it! Describe your space, amenities, ambiance, and neighborhood highlights..."
                className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-base font-medium text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-zinc-900/80 resize-none shadow-2xs transition-shadow"
              />
            </div>
          </div>

          {/* Bottom Action Footer Bar */}
          <div className="max-w-7xl mx-auto w-full flex items-center justify-end gap-3 pt-8 border-t border-zinc-100 mt-12">
            <OnboardingBackButton
              onClick={onBack}
              disabled={isLoading}
            />
            <OnboardingPrimaryButton
              onClick={onNext}
              isLoading={isLoading}
              label="Next"
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
