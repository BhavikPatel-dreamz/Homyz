"use client";

import Link from "next/link";
import { LoadingIcon } from "@/components/ui/loading-icon";
import { useLanguage } from "@/lib/i18n/language-context";
import { BrandLogo } from "@/components/branding/brand-logo";
import { useBranding } from "@/components/branding/branding-provider";

interface OnboardingHeaderProps {
  onSaveAndExit: (redirectPath?: string) => void;
  onLogoClick?: () => void;
  isSaving?: boolean;
  disabled?: boolean;
}

/** A compact, mobile-safe header for the listing wizard. */
export function OnboardingHeader({
  onSaveAndExit,
  onLogoClick,
  isSaving = false,
  disabled = false,
}: OnboardingHeaderProps) {
  const branding = useBranding();
  const { t } = useLanguage();

  const handleLogoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (onLogoClick) {
      event.preventDefault();
      onLogoClick();
    }
  };

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between px-3 sm:h-[80px] sm:px-5 lg:px-16">
      <Link
        href="/host/today"
        aria-label="Go to Host Today"
        onClick={handleLogoClick}
        className="flex shrink-0 items-center py-1"
      >
        <BrandLogo
          src={branding.hostHeaderLogoUrl}
          fallbackSrc="/images/brand/homyz-logo-dark-v1.svg"
          alt="Homyz"
          width={120}
          height={42}
          priority
          className="h-8 w-auto sm:h-10"
        />
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="/help"
          target="_blank"
          rel="noreferrer"
          aria-label={t("host_header_questions", "Questions")}
          className="hidden h-9 items-center justify-center rounded-full border border-zinc-300 px-3 text-[13px] font-medium leading-none text-[#1F1F1F] transition hover:border-[#1F1F1F] hover:bg-zinc-50 sm:inline-flex"
        >
          {t("host_header_questions", "Questions")}
        </a>

        <a
          href="/help"
          target="_blank"
          rel="noreferrer"
          aria-label={t("host_header_questions", "Questions")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-[#1F1F1F] transition hover:border-[#1F1F1F] hover:bg-zinc-50 sm:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
            <circle cx="12" cy="12" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.8-1.5 1.2-1.5 2.5M12 17h.01" />
          </svg>
        </a>

        <button
          type="button"
          onClick={() => onSaveAndExit("/host/listings")}
          disabled={disabled || isSaving}
          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-zinc-300 px-3 text-[13px] font-medium leading-none text-[#1F1F1F] transition hover:border-[#1F1F1F] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:px-4"
        >
          {isSaving && <LoadingIcon className="mr-2 size-4 animate-spin" />}
          {isSaving ? t("host_saving", "Saving…") : t("host_save_exit", "Save & exit")}
        </button>
      </div>
    </header>
  );
}
