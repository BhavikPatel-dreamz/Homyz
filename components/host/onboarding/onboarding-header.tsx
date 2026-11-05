"use client";

import { LoadingIcon } from "@/components/ui/loading-icon";
import { useLanguage } from "@/lib/i18n/language-context";
import { BrandLogo } from "@/components/branding/brand-logo";
import { useBranding } from "@/components/branding/branding-provider";

interface OnboardingHeaderProps {
  onSaveAndExit: () => void;
  isSaving?: boolean;
  disabled?: boolean;
}

/** A focused header for the listing wizard, intentionally separate from host navigation. */
export function OnboardingHeader({ onSaveAndExit, isSaving = false, disabled = false }: OnboardingHeaderProps) {
  const branding = useBranding();
  const { t } = useLanguage();

  return (
    <header className="flex h-20 shrink-0 items-center justify-between px-6 sm:h-24 sm:px-10 lg:px-16">
      <BrandLogo
        src={branding.hostHeaderLogoUrl}
        fallbackSrc="/images/brand/homyz-logo-dark-v1.svg"
        alt="Homyz"
        width={133}
        height={48}
        priority
        className="h-11 w-auto sm:h-12"
      />

      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="/help"
          target="_blank"
          rel="noreferrer"
          className="app-btn app-btn--md rounded-full border border-zinc-300 text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-zinc-50"
        >
          {t("host_header_questions", "Questions?")}
        </a>
        <button
          type="button"
          onClick={onSaveAndExit}
          disabled={disabled || isSaving}
          className="app-btn app-btn--md rounded-full border border-zinc-300 text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving && <LoadingIcon className="mr-2 size-4 animate-spin" />}
          {isSaving ? t("host_saving", "Saving…") : t("host_save_exit", "Save & exit")}
        </button>
      </div>
    </header>
  );
}
