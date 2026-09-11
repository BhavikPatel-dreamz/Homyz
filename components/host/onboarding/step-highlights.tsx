"use client";

import Image from "next/image";
import React from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";

export interface HouseHighlightOption {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const highlightIconPaths: Record<string, string> = {
  Peaceful: "/images/icons/peaceful.svg",
  Unique: "/images/icons/unique.svg",
  "Family-friendly": "/images/icons/family-friendly.svg",
  Stylish: "/images/icons/stylish.svg",
  Central: "/images/icons/central.svg",
  Spacious: "/images/icons/spacious.svg",
};

interface StepHighlightsProps {
  selectedHighlights: string[];
  onToggleHighlight: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepHighlights({
  selectedHighlights,
  onToggleHighlight,
  onBack,
  onNext,
  isLoading = false,
}: StepHighlightsProps) {
  const highlightOptions: HouseHighlightOption[] = [
    {
      id: "Peaceful",
      label: "Peaceful",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-15a3 3 0 100 6 3 3 0 000-6zm-4.5 9h9" />
        </svg>
      ),
    },
    {
      id: "Unique",
      label: "Unique",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385c.116.488-.42.88-.838.614L12 17.763l-4.72 2.784c-.418.266-.954-.126-.838-.614l1.285-5.385a.563.563 0 00-.182-.557l-4.204-3.602c-.38-.325-.178-.948.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      id: "Family-friendly",
      label: "Family-friendly",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a5.97 5.97 0 00-.942 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      id: "Stylish",
      label: "Stylish",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
    },
    {
      id: "Central",
      label: "Central",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-8.25-8.25v16.5m-3-11.25l6 6m0-6l-6 6" />
        </svg>
      ),
    },
    {
      id: "Spacious",
      label: "Spacious",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
        </svg>
      ),
    },
  ];

  return (
    <OnboardingStepLayout
      isLoading={isLoading}
      mainClassName="min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16"
      wrapperClassName="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]"
    >
          <div className="max-w-187 mx-auto w-full flex flex-col items-start">
            {/* Main Title & Subtitle */}
            <OnboardingStepHeading
              title="Let’s describe your house"
              description="Choose up to 3 highlights. We’ll use these to help guests understand your place."
              titleClassName="sm:mb-5 mb-3"
              descriptionClassName="text-base font-normal text-[#727272] sm:mb-10 mb-6"
            />

            {/* Highlights Selector Grid */}
            <div data-aos="fade-up" data-aos-delay="200" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-5">
              {highlightOptions.map((item) => {
                const isSelected = selectedHighlights.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleHighlight(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3.25 py-3 text-left text-sm font-normal transition-all cursor-pointer select-none sm:w-auto sm:py-3.25 sm:text-base sm:font-medium ${isSelected
                      ? "bg-[#E9EBFF] text-[#1F1F1F]"
                      : "bg-white text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-[#E9EBFF]"
                      }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full border border-[#1F1F1F] flex items-center justify-center shrink-0 transition-colors"
                    >
                      <Image
                        src={highlightIconPaths[item.id]}
                        alt=""
                        aria-hidden="true"
                        width={24}
                        height={24}
                        unoptimized
                        className="h-6 w-6 object-contain"
                      />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <StepProgressFooter
            currentStep={5}
            totalSteps={6}
            onBack={onBack}
            onNext={onNext}
            isLoading={isLoading}
          />
    </OnboardingStepLayout>
  );
}
