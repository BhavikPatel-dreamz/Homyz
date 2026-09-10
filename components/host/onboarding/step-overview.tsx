"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui";

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

function CloseIcon() {
  return (
    <svg
      className="size-7"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg
      className="mr-2 size-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />

      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z"
      />
    </svg>
  );
}

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
    <main className="min-h-dvh bg-white py-8 sm:py-12 lg:pt-25 lg:pb-16">
      <Container>
        <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col animate-in fade-in duration-200 sm:min-h-[calc(100dvh-6rem)] lg:min-h-[calc(100dvh-10.25rem)]">
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

          {/* Main content */}
          <div className="grid w-full grid-cols-1 items-center lg:grid-cols-12">
            {/* Heading */}
            <div className="mb-10 flex flex-col justify-center sm:mb-24 lg:col-span-4 lg:mb-0 lg:pr-8">
              <h1 className="text-[clamp(24px,6vw,30px)] font-medium leading-[1.15] tracking-tight text-[#1F1F1F] lg:text-6xl lg:font-semibold">
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
          <div className="mt-12 flex w-full items-center sm:mt-16 lg:mt-auto lg:justify-end lg:border-t lg:border-zinc-100 lg:pt-8">
            <button
              type="button"
              onClick={handleBack}
              disabled={isLoading}
              className="mr-2 inline-flex min-h-11 sm:min-h-13 flex-1 items-center justify-center rounded-full border border-[#1F1F1F] bg-white hover:bg-[#1F1F1F] px-5 sm:py-3 py-2 text-base font-medium text-[#1F1F1F] hover:text-white transition-colors delay-100 duration-300 disabled:cursor-not-allowed disabled:opacity-50 sm:mr-3 lg:min-h-0 lg:flex-none lg:px-6"
            >
              Back
            </button>

            <button
              type="button"
              onClick={onGetStarted}
              disabled={isLoading}
              className="ml-2 inline-flex min-h-11 sm:min-h-13 flex-1 items-center justify-center rounded-full border border-transparent bg-[#FCDF9C] hover:bg-[#1F1F1F] px-5 sm:py-3 py-2 text-base font-medium text-[#1F1F1F] hover:text-white transition-colors  delay-100 duration-300 hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-3 lg:min-h-0 lg:flex-none lg:px-6"
            >
              {isLoading ? (
                <>
                  <LoadingIcon />
                  <span>Loading...</span>
                </>
              ) : (
                "Get started"
              )}
            </button>
          </div>
        </div>
      </Container>
    </main>
  );
}