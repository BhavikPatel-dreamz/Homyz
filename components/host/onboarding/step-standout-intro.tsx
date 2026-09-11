"use client";

import { Container } from "@/components/ui";
import { useRouter } from "next/navigation";
import { CloseIcon } from "@/components/ui/close-icon";
import React from "react";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import Image from "next/image";

interface StepStandoutIntroProps {
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepStandoutIntro({ onBack, onNext, isLoading = false }: StepStandoutIntroProps) {

  const router = useRouter();

  const handleBack = () => {
    if (!isLoading) {
      router.back();
    }
  };

  return (
    <main className="py-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="wrapper flex-1 w-full flex flex-col sm:justify-between animate-in fade-in duration-200 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-15.25rem)]">
          {/* Mobile close button */}
          <div className="mb-5 flex justify-end sm:mb-8 lg:hidden">
            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading}
              aria-label="Close"
              className="inline-flex size-11 items-center justify-center rounded-full text-[#1F1F1F] transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="step-intro-panel max-w-219.25 w-full grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center sm:m-auto mx-auto">

            {/* Left Column: Step 2 Badge, Title & Subtitle */}
            <div className="order-2 flex max-w-xl flex-col justify-center lg:order-1 lg:col-span-6">
              <div className="mb-5">
                <span className="inline-flex items-center rounded-full border border-[#1F1F1F] px-6 py-2.5 text-base font-medium text-[#1F1F1F] bg-white">
                  Step 2
                </span>
              </div>
              <h1>
                Make your place <br />
                to stand out
              </h1>
              <p className="text-base font-normal text-[#727272] leading-relaxed mt-5">
                In this step, you&apos;ll add amenities your place offers, upload 5 or more high-quality photos, and give your listing a title and description.
              </p>
            </div>

            {/* Right Column: Cozy Room Interior Vector Illustration with Floating Accent Blobs */}
            <div className="order-1 flex w-full justify-center lg:order-2 lg:col-span-6 lg:justify-end">

              <div className="w-full relative">
                {/* Main Illustration Container */}
                <div className="w-full relative z-0">
                  <Image src="/images/intro-new-banner.svg" alt="intro new banner" width={480} height={491} className="sm:block hidden" />
                  <Image src="/images/intro-new-banner-mobile.svg" alt="intro-new-banner-mobile" width={480} height={491} className="sm:hidden block" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer Bar */}
          <div className="max-w-7xl mx-auto w-full flex items-center justify-end pt-8 mt-8">
            <OnboardingBackButton
              onClick={onBack}
              disabled={isLoading}
            />
            <OnboardingPrimaryButton
              onClick={onNext}
              isLoading={isLoading}
              label="Next"
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
