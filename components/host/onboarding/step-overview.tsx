"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";
import { useLanguage } from "@/lib/i18n/language-context";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface StepOverviewProps {
  onGetStarted: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export function StepOverview({
  onGetStarted,
  onBack,
  isLoading = false,
}: StepOverviewProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const STEPS = [
    {
      number: 1,
      title: t("host_overview_step1_title"),
      description: t("host_overview_step1_desc"),
    },
    {
      number: 2,
      title: t("host_overview_step2_title"),
      description: t("host_overview_step2_desc"),
    },
    {
      number: 3,
      title: t("host_overview_step3_title"),
      description: t("host_overview_step3_desc"),
    },
  ];

  const handleBack = () => {
    if (isLoading) return;
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <main className="step-overview min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col animate-in fade-in duration-200 sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          {/* Main content */}
          <div className="grid w-full grid-cols-1 items-start lg:grid-cols-12">
            {/* Heading */}
            <div className="mb-10 flex flex-col justify-center sm:mb-24 lg:col-span-4 lg:mb-0 lg:pr-8">
              <h1 data-aos="fade-up" data-aos-duration="700">
                <span>{t("host_overview_easy_started")}</span>
              </h1>
            </div>

            {/* Step cards */}
            <div className="mx-auto w-full max-w-[628px] lg:col-span-8 lg:mx-0">
              {STEPS.map((step, index) => (
                <article
                  key={step.number}
                  data-aos="fade-up"
                  data-aos-delay={String((index + 1) * 100)}
                  data-aos-duration="700"
                  className={`relative isolate min-h-[159px] w-full sm:min-h-[175px] ${index !== STEPS.length - 1
                      ? "mb-9 sm:mb-12"
                      : ""
                    }`}
                >
                  {/* Shadow wrapper */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 overflow-visible [filter:drop-shadow(0_3px_6px_rgb(0_0_0_/_20%))_drop-shadow(1px_0_3px_rgb(0_0_0_/_14%))]"
                  >
                    {/* Masked card surface */}
                    <div className="size-full rounded-2xl bg-white [-webkit-mask-image:radial-gradient(circle_28px_at_50%_0,transparent_27px,#000_28px)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%] [mask-image:radial-gradient(circle_28px_at_50%_0,transparent_27px,#000_28px)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%] sm:rounded-[18px] sm:[-webkit-mask-image:radial-gradient(circle_32px_at_50%_0,transparent_31px,#000_32px)] sm:[mask-image:radial-gradient(circle_32px_at_50%_0,transparent_31px,#000_32px)]" />
                  </div>

                  {/* Number badge */}
                  <div className="absolute -top-5 left-1/2 z-20 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#D4D4D8] bg-white text-base font-medium text-[#1F1F1F] shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:-top-6 sm:size-12 sm:text-lg lg:text-sm lg:font-semibold">
                    {step.number}
                  </div>

                  {/* Card content */}
                  <div className="relative z-10 flex min-h-[159px] flex-col items-center justify-center px-5 pt-10 pb-6 text-center sm:min-h-[175px] sm:px-9 sm:pt-11 sm:pb-8 lg:items-start lg:px-9 lg:pt-10 lg:text-left">
                    <h2 className="font-medium leading-tight tracking-tight text-[#1F1F1F] sm:text-xl text-[18px]  lg:font-semibold">
                      {step.title}
                    </h2>

                    <p className="mt-3 max-w-[540px] font-normal leading-[1.5] text-[#7A7A7A] text-base lg:font-medium lg:leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div
            data-aos="fade"
            data-aos-anchor="main"
            data-aos-delay="200"
            data-aos-duration="700"
            className="mt-10.75 flex w-full items-center lg:justify-end"
          >
            <OnboardingBackButton
              onClick={handleBack}
              disabled={isLoading}
            />

            <OnboardingPrimaryButton
              onClick={onGetStarted}
              isLoading={isLoading}
              label={t("host_get_started")}
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
