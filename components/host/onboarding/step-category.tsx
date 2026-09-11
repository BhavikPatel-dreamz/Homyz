"use client";

import React from "react";
import { PropertyCategory } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface StepCategoryProps {
  categories: PropertyCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepCategory({
  categories,
  selectedCategory,
  onSelectCategory,
  onBack,
  onNext,
  isLoading = false,
}: StepCategoryProps) {

  return (
    <main className="sm:pt-26 pb-12">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          <OnboardingMobileCloseButton disabled={isLoading} />
          <div className="max-w-187 mx-auto w-full flex flex-col items-start text-left my-auto">
            <h1>
              Which of these best<br className="sm:block hidden" /> describes your place
            </h1>
            <p className="sm:mt-5 mt-3 max-w-122.75">
              Choose the property type that best reflects the style and layout of your accommodation.
            </p>

            <div className="flex flex-wrap min-[425px]:justify-start justify-between sm:gap-3 gap-2 max-w-4xl sm:mt-12 mt-6">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className={`flex items-center min-[425px]:w-auto w-[calc(50%_-_4px)] gap-2 sm:px-5 p-3 sm:py-3.5 rounded-lg border min-[425px]:text-center text-left sm:text-base text-sm sm:font-semibold font-normal transition-all cursor-pointer select-none border-[#727272] ${isSelected
                      ? " bg-[#E9EBFF] text-[#1F1F1F]"
                      : "bg-white text-[#1F1F1F] hover:bg-[#E9EBFF]"
                      }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full border border-[#727272] flex items-center justify-center shrink-0 transition-colors "
                    >
                      {cat.icon}
                    </div>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <StepProgressFooter currentStep={1} onBack={onBack} onNext={onNext} isLoading={isLoading} />
        </div>
      </Container>
    </main>
  );
}
