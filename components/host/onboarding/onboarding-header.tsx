"use client";

import Image from "next/image";
import { LoadingIcon } from "@/components/ui/loading-icon";
import { Container } from "@/components/ui";

interface OnboardingHeaderProps {
  onSaveAndExit: () => void;
  isSaving?: boolean;
  disabled?: boolean;
}

/** A focused header for the listing wizard, intentionally separate from host navigation. */
export function OnboardingHeader({ onSaveAndExit, isSaving = false, disabled = false }: OnboardingHeaderProps) {
  return (
    <header className="header sticky top-0 lg:z-9999 z-40 w-full bg-white text-[#1F1F1F]">
      <Container>
        <div className="flex shrink-0 items-center justify-between">
          <div className="relative block aspect-[199/72] w-[125px] md:w-[135px] lg:w-[145px] xl:w-[170px] 2xl:w-[198px]">
            <Image
              src="/images/brand/homyz-logo-dark-v1.svg"
              alt="Homyz"
              width={198}
              height={72}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/help"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-semibold text-[#1F1F1F] transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 sm:px-5"
            >
              Questions?
            </a>
            <button
              type="button"
              onClick={onSaveAndExit}
              disabled={disabled || isSaving}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm font-semibold text-[#1F1F1F] transition-colors hover:border-[#1F1F1F] hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
            >
              {isSaving && <LoadingIcon className="mr-2 size-4 animate-spin" />}
              {isSaving ? "Saving…" : "Save & exit"}
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}
