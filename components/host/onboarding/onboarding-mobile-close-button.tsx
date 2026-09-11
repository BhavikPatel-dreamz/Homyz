"use client";

import { CloseIcon } from "@/components/ui/close-icon";
import { useRouter } from "next/navigation";

interface OnboardingMobileCloseButtonProps {
  disabled?: boolean;
}

/** Mobile-only close control shared by onboarding steps. */
export function OnboardingMobileCloseButton({
  disabled = false,
}: OnboardingMobileCloseButtonProps) {
  const router = useRouter();

  return (
    <div className="mb-5 flex justify-end sm:mb-8 lg:hidden">
      <button
        type="button"
        onClick={() => router.back()}
        disabled={disabled}
        aria-label="Close"
        className="inline-flex size-11 items-center justify-center rounded-full text-[#1F1F1F] transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
