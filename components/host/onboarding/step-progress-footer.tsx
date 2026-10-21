"use client";

import React from "react";
import { OnboardingStickyFooter } from "./onboarding-sticky-footer";

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
  return (
    <OnboardingStickyFooter
      currentStep={currentStep}
      totalSteps={totalSteps}
      onBack={onBack}
      onNext={onNext}
      isLoading={isLoading}
      nextLabel={nextLabel}
      disableNext={disableNext}
    />
  );
}
