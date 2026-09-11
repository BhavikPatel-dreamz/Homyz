"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface StepOverviewProps {
  onGetStarted: () => void;
  isLoading?: boolean;
}

interface Step {
  number: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Tell us about your place",
    description:
      "Share some basic info, like where it is and how many guests can stay.",
  },
  {
    number: 2,
    title: "Make it stand out",
    description:
      "Add 5 or more photos plus a title and description and we’ll help you out.",
  },
  {
    number: 3,
    title: "Finish and publish",
    description:
      "Choose a starting price, verify a few details, then publish your listing.",
  },
];

export function StepOverview({
  onGetStarted,
  isLoading = false,
}: StepOverviewProps) {
  const router = useRouter();

  const handleBack = () => {
    if (!isLoading) {
      router.back();
    }
  };

  return (
    <main className="step-overview min-h-dvh bg-white py-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col animate-in fade-in duration-200 sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
          
          {/* Mobile-only close control shared by onboarding steps.  */}
          <OnboardingMobileCloseButton disabled={isLoading} />

          {/* Main content */}
          <div className="grid w-full grid-cols-1 items-start lg:grid-cols-12">
            {/* Heading */}
            <div className="mb-10 flex flex-col justify-center sm:mb-24 lg:col-span-4 lg:mb-0 lg:pr-8">
              <h1>
                <span className="lg:hidden">
                  It&rsquo;s easy to get started on
                  <br />
                  <span className="text-[#E6A838]">Homyz</span>
                </span>

                <span className="hidden lg:inline">
                  It&rsquo;s easy to <br />
                  get started <br />
                  on <span className="text-[#E6A838]">Homyz</span>
                </span>
              </h1>
            </div>

            {/* Step cards */}
            <div className="mx-auto w-full max-w-[628px] lg:col-span-8 lg:mx-0">
              {STEPS.map((step, index) => (
                <article
                  key={step.number}
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
                    <h2 className="text-[18px] font-medium leading-tight tracking-tight text-[#1F1F1F] sm:text-xl lg:font-semibold">
                      {step.title}
                    </h2>

                    <p className="mt-3 max-w-[540px] text-[15px] font-normal leading-[1.5] text-[#7A7A7A] sm:text-base lg:text-sm lg:font-medium lg:leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-10.75 flex w-full items-center lg:justify-end">
            <OnboardingBackButton
              onClick={handleBack}
              disabled={isLoading}
            />

            <OnboardingPrimaryButton
              onClick={onGetStarted}
              isLoading={isLoading}
              label="Get started"
            />
          </div>
        </div>
      </Container>
    </main>
  );
}
