"use client";

import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingCounterRow } from "./onboarding-counter-row";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";


interface StepBasicsCountersProps {
  guests: number;
  setGuests: (val: number) => void;
  bedrooms: number;
  setBedrooms: (val: number) => void;
  beds: number;
  setBeds: (val: number) => void;
  bathrooms: number;
  setBathrooms: (val: number) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepBasicsCounters({
  guests,
  setGuests,
  bedrooms,
  setBedrooms,
  beds,
  setBeds,
  bathrooms,
  setBathrooms,
  onBack,
  onNext,
  isLoading = false,
}: StepBasicsCountersProps) {
  const counters = [
    { label: "Guests", value: guests, minimum: 1, onChange: setGuests },
    { label: "Bedrooms", value: bedrooms, minimum: 0, onChange: setBedrooms },
    { label: "Beds", value: beds, minimum: 1, onChange: setBeds },
    { label: "Bathrooms", value: bathrooms, minimum: 1, onChange: setBathrooms, valueClassName: "font-medium" },
  ];

  return (
    <OnboardingStepLayout
      isLoading={isLoading}
      mainClassName="step-basic-counters min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16"
      wrapperClassName="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]"
    >

          <div className="max-w-[748px] mx-auto w-full flex flex-col items-start sm:my-auto">
            {/* Header & Subtitle */}
            <OnboardingStepHeading
              title="Share some basics about your place"
              description="You’ll add more details later, like bed types."
              titleClassName="mb-5"
              descriptionClassName="sm:mb-10 mb-8"
            />

            {/* Counters List Stack */}
            <div data-aos="fade-up" data-aos-delay="200" className="flex flex-col w-full divide-y divide-[#727272] mb-6">
              {counters.map((counter) => (
                <OnboardingCounterRow key={counter.label} {...counter} />
              ))}
            </div>
          </div>

          <StepProgressFooter
            currentStep={5}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
    </OnboardingStepLayout>
  );
}
