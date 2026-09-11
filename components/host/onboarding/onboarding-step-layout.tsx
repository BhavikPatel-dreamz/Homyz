"use client";

import type { ReactNode } from "react";
import { Container } from "@/components/ui";
import { OnboardingMobileCloseButton } from "./onboarding-mobile-close-button";

interface OnboardingStepLayoutProps {
  children: ReactNode;
  isLoading?: boolean;
  mainClassName: string;
  wrapperClassName: string;
  showMobileClose?: boolean;
}

/**
 * Shared structural shell for onboarding steps.
 *
 * Keep page-specific sizing and spacing in the two class props so adopting this
 * component never changes a step's existing layout.
 */
export function OnboardingStepLayout({
  children,
  isLoading = false,
  mainClassName,
  wrapperClassName,
  showMobileClose = true,
}: OnboardingStepLayoutProps) {
  return (
    <main className={mainClassName}>
      <Container>
        <div className={wrapperClassName}>
          {showMobileClose && <OnboardingMobileCloseButton disabled={isLoading} />}
          {children}
        </div>
      </Container>
    </main>
  );
}
