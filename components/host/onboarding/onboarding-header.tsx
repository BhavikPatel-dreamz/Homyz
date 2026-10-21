"use client";

import Image from "next/image";
import { LoadingIcon } from "@/components/ui/loading-icon";
import { useLanguage } from "@/lib/i18n/language-context";

interface OnboardingHeaderProps {
  onSaveAndExit: () => void;
  isSaving?: boolean;
  disabled?: boolean;
}

/** A focused header for the listing wizard, intentionally separate from host navigation. */
export function OnboardingHeader({ onSaveAndExit, isSaving = false, disabled = false }: OnboardingHeaderProps) {
  const { t } = useLanguage();

  return (
    <header className="flex h-20 shrink-0 items-center justify-between px-6 sm:h-24 sm:px-10 lg:px-16">
      <Image
        src="/images/brand/homyz-logo-dark-v1.svg"
        alt="Homyz"
        width={100}
        height={36}
        priority
        className="h-9 w-auto"
      />

      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href="/help"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-semibold text-[#1F1F1F] transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 sm:px-5"
        >
          {t("host_header_questions", "Questions?")}
        </a>
        <button
          type="button"
          onClick={onSaveAndExit}
          disabled={disabled || isSaving}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-semibold text-[#1F1F1F] transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
        >
          {isSaving && <LoadingIcon className="mr-2 size-4 animate-spin" />}
          {isSaving ? t("host_saving", "Saving…") : t("host_save_exit", "Save & exit")}
        </button>
      </div>
    </header>
  );
}
