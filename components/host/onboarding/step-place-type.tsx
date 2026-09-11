"use client";

import React from "react";
import { PlaceTypeOption } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

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
    <main className="step-photos min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />


          <div className="max-w-187 mx-auto w-full flex flex-col items-start sm:my-auto text-left">
            <h1 data-aos="fade-up" className="mb-10">
              What type of place will guests have?
            </h1>

            <div className="flex flex-col sm:gap-3.25 gap-3 w-full">
              {placeTypes.map((pt, index) => {
                const isSelected = selectedPlaceType === pt.id;
                return (
                  <button
                    key={pt.id}
                    data-aos="fade-up"
                    data-aos-delay={String((index + 1) * 100)}
                    type="button"
                    onClick={() => onSelectPlaceType(pt.id)}
                    className={`flex items-start justify-between px-5 py-4 rounded-lg border transition-all text-left cursor-pointer group ${isSelected
                      ? "border-[#1F1F1F] bg-[#E9EBFF] ring-1 ring-[#1F1F1F] shadow-sm"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/60"
                      }`}
                  >
                    <div className="flex items-start gap-4 pr-4">
                      <div
                        className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected
                          ? "border-[#1F1F1F] text-[#1F1F1F]"
                          : "border-[#1F1F1F] text-[#1F1F1F] group-hover:border-[#1F1F1F]"
                          }`}
                      >
                        {pt.icon}
                      </div>

                      <div>
                        <h3 className="sm:text-lg text-sm sm:font-semibold font-normal text-[#1F1F1F] tracking-tight">
                          {pt.title}
                        </h3>
                        <p className="mt-1.5 sm:text-sm text-xs font-normal text-[#727272] leading-relaxed max-w-lg">
                          {pt.description}
                        </p>
                      </div>
                    </div>

                    <svg
                      className={`w-5 h-5 shrink-0 mt-2 transition-colors ${isSelected ? "text-[#1F1F1F]" : "text-[#1D1D1D] group-hover:text-zinc-700"
                        }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          <StepProgressFooter currentStep={2} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
