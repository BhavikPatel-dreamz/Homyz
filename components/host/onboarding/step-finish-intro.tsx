"use client";

import React from "react";
import { Container } from "@/components/ui";
import Image from "next/image";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";

interface StepFinishIntroProps {
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepFinishIntro({ onBack, onNext, isLoading = false }: StepFinishIntroProps) {
  return (
    <main className="min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex min-h-[calc(100dvh-4rem)] w-full flex-col animate-in fade-in duration-200 sm:min-h-[calc(100dvh-6rem)] sm:justify-between lg:min-h-[calc(100dvh-10.25rem)]">
          <OnboardingMobileCloseButton disabled={isLoading} />

          <div className="step-intro-panel mx-auto grid w-full max-w-[820px] grid-cols-1 items-center gap-5 sm:my-auto lg:grid-cols-12 lg:gap-8">
            {/* Step 3 heading and description */}
            <div className="order-2 flex max-w-xl flex-col justify-center lg:order-1 lg:col-span-6">
              <div className="mb-5">
                <span className="inline-flex items-center rounded-full border border-[#1F1F1F] bg-white px-6 py-2.5 text-base font-medium text-[#1F1F1F]">
                  Step 3
                </span>
              </div>
              <h1>Finish up and publish</h1>
              <p className="mt-5 text-base font-normal leading-relaxed text-[#727272]">
                Finally, you&apos;ll choose your weekday base price, weekend pricing, early bird or length-of-stay discounts, and review important safety details.
              </p>
            </div>

            {/* Illustration shared with the new-listing introduction */}
            <div className="order-1 flex w-full justify-center lg:order-2 lg:col-span-6 lg:justify-end">
              <div className="relative w-full">
                <Image src="/images/intro-new-banner.svg" alt="Decorative home illustration" width={480} height={491} className="hidden w-full sm:block" />
                <Image src="/images/intro-new-banner-mobile.svg" alt="Decorative home illustration" width={480} height={491} className="block w-full sm:hidden" />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-auto flex w-full max-w-7xl items-center justify-end pt-8 sm:mt-8 sm:pt-0">
            <OnboardingBackButton onClick={onBack} disabled={isLoading} />
            <OnboardingPrimaryButton onClick={onNext} isLoading={isLoading} label="Next" />
          </div>
        </div>
      </Container>
    </main>
  );
}
