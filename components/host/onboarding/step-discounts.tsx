"use client";

import { Container } from "@/components/ui";
import React, { useState } from "react";
import { StepProgressFooter } from "./step-progress-footer";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import { useLanguage } from "@/lib/i18n/language-context";


export interface DiscountOption {
  id: string;
  title: string;
  description: string;
  percentage: number;
}

interface StepDiscountsProps {
  selectedDiscounts: string[];
  onToggleDiscount: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepDiscounts({
  selectedDiscounts,
  onToggleDiscount,
  onBack,
  onNext,
  isLoading = false,
}: StepDiscountsProps) {
  const { t } = useLanguage();
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const discounts: DiscountOption[] = [
    {
      id: "new_listing",
      title: t("host_discount_new_listing_title"),
      description: t("host_discount_new_listing_desc"),
      percentage: 20,
    },
    {
      id: "last_minute",
      title: t("host_discount_last_minute_title"),
      description: t("host_discount_last_minute_desc"),
      percentage: 15,
    },
    {
      id: "weekly",
      title: t("host_discount_weekly_title"),
      description: t("host_discount_weekly_desc"),
      percentage: 10,
    },
    {
      id: "monthly",
      title: t("host_discount_monthly_title"),
      description: t("host_discount_monthly_desc"),
      percentage: 25,
    },
  ];

  return (
    <main className="step-discounts min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">

          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />


          <div className="max-w-[491px] mx-auto w-full flex flex-col items-start my-auto">
            {/* Main Title & Tip Subtitle */}
            <div className="title-section">
              <h1 data-aos="fade-up" className="sm:mb-5 mb-3">
                {t("host_discounts_title")}
              </h1>
              <p data-aos="fade-up" data-aos-delay="100" className="sm:mb-10 mb-6">
                {t("host_discounts_subtitle")}
              </p>
            </div>

            {/* Discounts List */}
            <div data-aos="fade-up" data-aos-delay="200" className="w-full sm:space-y-4 space-y-3">
              {discounts.map((discount) => {
                const isEnabled = selectedDiscounts.includes(discount.id);
                return (
                  <div
                    key={discount.id}
                    onClick={() => onToggleDiscount(discount.id)}
                    className={`w-full border sm:rounded-2xl rounded-[6px] sm:p-4 p-3 bg-white transition-all flex items-end justify-between shadow-2xs cursor-pointer select-none ${isEnabled ? "border-[#727272]" : "border-[#727272] hover:border-[#1f1f1f]"
                      }`}
                  >
                    {/* Left Side Info */}
                    <div className="flex flex-col items-start pr-4">
                      <span className="text-xs font-normal text-[#1f1f1f] mb-1.5">
                        {discount.title}
                      </span>
                      <span className="text-xs text-[#727272] font-normal mb-2 leading-relaxed">
                        {discount.description}
                      </span>
                      <span className="text-2xl font-medium text-[#1F1F1F]">
                        {discount.percentage}%
                      </span>
                    </div>

                    {/* Right Side Toggle Switch */}
                    <div
                      className={`w-10.75 h-4.75 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${isEnabled ? "bg-[#DF4557]" : "bg-[#DDDDDE]"
                        }`}
                    >
                      <div
                        className={`w-3.75 h-3.75 rounded-full bg-white shadow-md transform transition-transform duration-200 ${isEnabled ? "translate-x-6" : "translate-x-0"
                          }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footnote Notice & Read more Toggle */}
            <div className="mt-4 w-full">
              <p>
                {t("host_discount_footnote")}{" "}
                <button
                  type="button"
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="underline text-[#1F1F1F] hover:text-[#727272] cursor-pointer font-normal"
                >
                  {showExplanation ? t("host_hide_details") : t("host_read_more")}
                </button>
              </p>

              {showExplanation && (
                <div className="mt-3 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600 leading-relaxed animate-in fade-in duration-150">
                  <p className="font-semibold text-zinc-800 mb-1">{t("host_discounts_how_it_works")}</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>If multiple discounts apply to the same dates, the highest qualifying single discount will be granted to the guest.</li>
                    <li>Length-of-stay discounts (weekly or monthly) take priority over the new listing promotion once your first 3 bookings are completed.</li>
                    <li>You can adjust or turn off any discount at any time from your host listing editor.</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <StepProgressFooter
            currentStep={3}
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
