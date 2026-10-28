"use client";

import { OnboardingStepHeading } from "./onboarding-step-heading";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { StepProgressFooter } from "./step-progress-footer";
import { useLanguage } from "@/lib/i18n/language-context";
import type { BookingMode } from "@/lib/booking/booking-mode";

interface StepBookingSettingsProps {
  mode: BookingMode;
  onChange: (mode: BookingMode) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function StepBookingSettings({ mode, onChange, onBack, onNext, isLoading = false }: StepBookingSettingsProps) {
  const { t } = useLanguage();

  const options: Array<{ mode: BookingMode; title: string; description: string; recommended?: boolean; icon: string }> = [
    {
      mode: "REQUEST_TO_BOOK",
      title: t("host_booking_mode_request_title", "Approve your first bookings"),
      description: t("host_booking_mode_request_desc", "Start by reviewing reservation requests. You can switch to Instant Book whenever you’re ready."),
      recommended: true,
      icon: "▣",
    },
    {
      mode: "INSTANT_BOOK",
      title: t("host_booking_mode_instant_title", "Use Instant Book"),
      description: t("host_booking_mode_instant_desc", "Let guests who meet your requirements book automatically."),
      icon: "ϟ",
    },
  ];

  return (
    <OnboardingStepLayout isLoading={isLoading} mainClassName="min-h-dvh bg-white pb-8 sm:py-12 lg:pt-25 lg:pb-16" wrapperClassName="wrapper flex min-h-[calc(100dvh-10.25rem)] w-full flex-1 flex-col sm:justify-between">
      <div className="mx-auto my-auto flex w-full max-w-xl flex-col items-start">
        <OnboardingStepHeading title="Pick your booking settings" description={<><span>You can change this at any time. </span><button type="button" className="underline font-medium underline-offset-2">Learn more</button></>} titleClassName="mb-3" descriptionClassName="mb-8" />
        <div className="w-full space-y-3" data-aos="fade-up">
          {options.map((option) => {
            const selected = mode === option.mode;
            return <button key={option.mode} type="button" onClick={() => onChange(option.mode)} disabled={isLoading} className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:cursor-not-allowed ${selected ? "border-[#1F1F1F] bg-zinc-50 shadow-sm" : "border-zinc-200 bg-white hover:border-zinc-500"}`}><span className="flex-1"><span className="block text-base font-medium text-[#1F1F1F]">{option.title}</span>{option.recommended && <span className="mt-1 block text-xs font-medium text-emerald-700">Recommended</span>}<span className="mt-1 block max-w-md text-sm leading-5 text-zinc-600">{option.description}</span></span><span className="mt-1 text-3xl font-light leading-none text-zinc-900" aria-hidden="true">{option.icon}</span></button>;
          })}
        </div>
      </div>
      <StepProgressFooter currentStep={3} totalSteps={4} onBack={onBack} onNext={onNext} isLoading={isLoading} />
    </OnboardingStepLayout>
  );
}
