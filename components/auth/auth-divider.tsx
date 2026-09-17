"use client";

import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";

export function AuthDivider() {
  const { t } = useLanguage();
  return (
    <div className="my-1 flex w-full items-center gap-3 sm:gap-4" role="separator" aria-label={t("auth_or")}>
      <Image src="/auth-divider.svg" alt="" width={237} height={1} className="h-px min-w-0 flex-1" aria-hidden="true" />
      <span className="font-['Poppins'] text-[15px] font-normal leading-6 text-[#1F1F1F] sm:text-[16px]">{t("auth_or")}</span>
      <Image src="/auth-divider.svg" alt="" width={237} height={1} className="h-px min-w-0 flex-1" aria-hidden="true" />
    </div>
  );
}
