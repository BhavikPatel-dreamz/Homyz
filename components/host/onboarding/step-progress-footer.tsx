"use client";

import React from "react";
import { OnboardingBackButton } from "./onboarding-back-button";

interface StepProgressFooterProps {
  currentStep: number;
  totalSteps?: number;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
  nextLabel?: string;
  disableNext?: boolean;
}

export function StepProgressFooter({
  currentStep,
  totalSteps = 6,
  onBack,
  onNext,
  isLoading = false,
  nextLabel = "Next",
  disableNext = false,
}: StepProgressFooterProps) {
  return (
    <div className="max-w-7xl mx-auto w-full grid grid-cols-3 items-center pt-8 border-t border-zinc-100 mt-12">
      <div />

      {/* Progress Dots Bar */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const isActive = currentStep === stepNum;
          return (
            <div
              key={idx}
              className={`h-2.5 rounded-full transition-all duration-200 ${
                isActive ? "w-6 bg-[#E6A838]" : "w-2.5 bg-zinc-200"
              }`}
            />
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <OnboardingBackButton
          onClick={onBack}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || disableNext}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-semibold text-[#1F1F1F] shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 min-w-[100px]"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-[#1F1F1F]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            nextLabel
          )}
        </button>
      </div>
    </div>
  );
}
