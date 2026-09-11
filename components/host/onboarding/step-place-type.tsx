"use client";

import React from "react";
import { PlaceTypeOption } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingPlaceTypeOption } from "./onboarding-place-type-option";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";

interface StepPlaceTypeProps {
  placeTypes: PlaceTypeOption[];
  selectedPlaceType: string;
  onSelectPlaceType: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepPlaceType({
  placeTypes,
  selectedPlaceType,
  onSelectPlaceType,
  onBack,
  onNext,
  isLoading = false,
}: StepPlaceTypeProps) {

  return (
    <OnboardingStepLayout
      isLoading={isLoading}
      mainClassName="step-photos min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16"
      wrapperClassName="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]"
    >
          <div className="max-w-187 mx-auto w-full flex flex-col items-start sm:my-auto text-left">
            <OnboardingStepHeading title="What type of place will guests have?" titleClassName="mb-10" />

            <div data-aos="fade-up" data-aos-delay="100" className="flex flex-col sm:gap-3.25 gap-3 w-full">
              {placeTypes.map((pt) => {
                return (
                  <OnboardingPlaceTypeOption
                    key={pt.id}
                    option={pt}
                    isSelected={selectedPlaceType === pt.id}
                    onSelect={onSelectPlaceType}
                  />
                );
              })}
            </div>
          </div>

          <StepProgressFooter currentStep={2} onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </OnboardingStepLayout>
  );
}
