"use client";

import { Container } from "@/components/ui";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";


export interface SafetyOption {
  id: string;
  label: string;
}

interface StepSafetyProps {
  selectedSafety: string[];
  onAnswerSafety: (id: string, answer: "YES" | "NO") => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepSafety({
  selectedSafety,
  onAnswerSafety,
  onBack,
  onNext,
  isLoading = false,
}: StepSafetyProps) {
  const safetyItems: SafetyOption[] = [
    {
      id: "SECURITY_CAMERA",
      label: "Exterior security camera present",
    },
    {
      id: "NOISE_MONITOR",
      label: "Noise decibel monitor present",
    },
    {
      id: "WEAPONS",
      label: "Weapon(s) on the property",
    },
  ];

  return (
    <main className="steps-safety min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">

          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="max-w-[491px] mx-auto w-full flex flex-col items-start my-auto">
            {/* Heading & Subtitle */}
            <h1 className="sm:mb-5 mb-3">
              Share safety details
            </h1>
            <p className="sm:mb-10 mb-6">
              Does your place have any of these?
            </p>

            {/* Safety Options List */}
            <div className="w-full space-y-3">
              {safetyItems.map((item) => {
                const answer = selectedSafety.find((value) => value.startsWith(`${item.id}:`))?.split(":")[1];
                return (
                  <fieldset
                    key={item.id}
                    className={`w-full border sm:rounded-lg rounded-md p-4 bg-white transition-all shadow-2xs ${answer ? "border-[#1f1f1f]" : "border-[#727272]"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-base font-normal text-[#727272]">
                        {item.label}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={answer === "YES"}
                        aria-label={`Toggle ${item.label}`}
                        onClick={() => onAnswerSafety(item.id, answer === "YES" ? "NO" : "YES")}
                        className={`relative h-4 w-8 shrink-0 rounded-full transition-colors ${answer === "YES" ? "bg-[#DF4557]" : "bg-[#DDDDDE]"}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute left-0.5 top-0.5 size-3 rounded-full bg-white shadow-xs transition-transform ${answer === "YES" ? "translate-x-4" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  </fieldset>
                );
              })}
            </div>

            {/* Paragraph Notice */}
            <p className="sm:mt-12 mt-6">
              Safety disclosures help guests make informed booking decisions. Your exact property location remains private until a reservation is confirmed.
            </p>
          </div>

          <StepProgressFooter
            currentStep={4}
            totalSteps={4}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
        </div>
      </Container>
    </main>
  );
}
