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
      wrapperClassName="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]"
    >
          <div className="max-w-187 mx-auto w-full flex flex-col items-start text-left my-auto">
            <OnboardingStepHeading
              title={t("host_category_title")}
              description={t("host_category_desc")}
              descriptionClassName="sm:mt-5 mt-3 max-w-122.75"
            />

            <div data-aos="fade-up" data-aos-delay="200" className="flex flex-wrap min-[425px]:justify-start justify-between sm:gap-3 gap-2 max-w-4xl sm:mt-12 mt-6">
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
                    <span>{getCategoryLabel(cat.id, cat.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <StepProgressFooter currentStep={1} onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </OnboardingStepLayout>
  );
}
