"use client";

import type { ReactNode } from "react";
import { Container } from "@/components/ui";
import { useLanguage } from "@/lib/i18n/language-context";
import { OnboardingBackButton } from "./onboarding-back-button";
import { OnboardingPrimaryButton } from "./onboarding-primary-button";

interface OnboardingStickyFooterProps {
  currentStep?: number;
  totalSteps?: number;
  onBack: () => void;
  onNext: () => void;
  isLoading?: boolean;
  nextLabel?: ReactNode;
  disableNext?: boolean;
}

/**
 * The one action bar used throughout the listing creation wizard. It remains
 * visible as a host scrolls and the wizard shell reserves matching space below
 * every step so fields at the end of a page remain reachable.
 */
export function OnboardingStickyFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isLoading = false,
  nextLabel,
  disableNext = false,
}: OnboardingStickyFooterProps) {
  const { t } = useLanguage();
  const displayNextLabel = nextLabel ?? t("host_next");
  const progressLabel = currentStep && totalSteps
    ? t("review_step_indicator", { current: currentStep, total: totalSteps }, `Step ${currentStep} of ${totalSteps}`)
    : undefined;

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white shadow-[0_-3px_12px_rgba(0,0,0,0.14)]"
      aria-label={t("host_listing_actions_aria", "Listing actions")}
    >
      <Container>
        <div className="flex min-h-[5.5rem] items-center justify-end py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {progressLabel && <span className="sr-only">{progressLabel}</span>}
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <OnboardingBackButton
              onClick={onBack}
              disabled={isLoading}
              className="mr-0"
            />
            <OnboardingPrimaryButton
              onClick={onNext}
              disabled={disableNext}
              isLoading={isLoading}
              loadingLabel={t("host_saving")}
              label={displayNextLabel}
            />
          </div>
        </div>
      </Container>
    </footer>
  );
}
