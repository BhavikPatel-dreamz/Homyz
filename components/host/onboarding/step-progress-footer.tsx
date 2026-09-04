"use client";

import React from "react";

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
        <button
          type="button"
          onClick={onBack}
          className="px-7 py-2.5 rounded-full border border-zinc-300 hover:bg-zinc-100 text-sm font-bold text-zinc-800 transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || disableNext}
          className="px-8 py-2.5 rounded-full bg-[#FCDF9C] hover:bg-[#ebd08d] text-sm font-extrabold text-zinc-900 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? "Loading..." : nextLabel}
        </button>
      </div>
    </div>
  );
}
