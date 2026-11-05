"use client";

import React from "react";
import { PropertyCategory } from "./types";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { useLanguage } from "@/lib/i18n/language-context";

interface StepCategoryProps {
  categories: PropertyCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

const CATEGORY_TRANSLATION_MAP: Record<string, keyof typeof import("@/messages/en.json")> = {
  House: "host_category_house",
  Apartment: "host_category_apartment",
  Barn: "host_category_barn",
  "Bed & breakfast": "host_category_bed_and_breakfast",
  Boat: "host_category_boat",
  Cabin: "host_category_cabin",
  "Camper / RV": "host_category_camper_rv",
  Castle: "host_category_castle",
  Container: "host_category_container",
  "Cycladic home": "host_category_cycladic_home",
  Dome: "host_category_dome",
  "Earth home": "host_category_earth_home",
  Farm: "host_category_farm",
  "Guest house": "host_category_guest_house",
  Hotel: "host_category_hotel",
  Houseboat: "host_category_houseboat",
};

export function StepCategory({
  categories,
  selectedCategory,
  onSelectCategory,
  onBack,
  onNext,
  isLoading = false,
}: StepCategoryProps) {
  const { t } = useLanguage();

  const getCategoryLabel = (id: string, fallback: string) => {
    const key = CATEGORY_TRANSLATION_MAP[id];
    return key ? t(key) : fallback;
  };

  return (
    <OnboardingStepLayout
      isLoading={isLoading}
      mainClassName="sm:pt-26 pb-12"
      wrapperClassName="wrapper flex-1 w-full flex flex-col sm:justify-center animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]"
    >
          <div className="max-w-187 mx-auto w-full flex flex-col items-start text-left my-auto">
            <OnboardingStepHeading
              title={t("host_category_title")}
              description={t("host_category_desc")}
              descriptionClassName="sm:mt-5 mt-3 max-w-122.75"
            />

            <div
              data-aos="fade-up"
              data-aos-delay="200"
              className="mt-6 grid w-full max-w-4xl grid-cols-2 gap-2.5 sm:mt-12 sm:gap-3 min-[480px]:grid-cols-3"
            >
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onSelectCategory(cat.id)}
                    className={`flex min-h-[64px] items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-normal transition-all duration-150 ease-out select-none sm:px-5 sm:py-3.5 sm:text-base sm:font-medium ${isSelected
                      ? "border-[#1F1F1F] bg-[#E9EBFF] text-[#1F1F1F]"
                      : "border-[#727272] bg-white text-[#1F1F1F] hover:bg-[#E9EBFF]"
                      }`}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#727272] transition-colors">
                      {cat.icon}
                    </div>
                    <span className="leading-tight">{getCategoryLabel(cat.id, cat.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <StepProgressFooter currentStep={1} onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </OnboardingStepLayout>
  );
}
