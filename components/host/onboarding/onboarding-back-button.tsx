import type { ComponentProps } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

export type OnboardingBackButtonProps = Omit<ComponentProps<"button">, "children" | "type">;

export function OnboardingBackButton({ className = "", ...props }: OnboardingBackButtonProps) {
  const { t } = useLanguage();
  return (
    <button
      {...props}
      type="button"
      className={`app-btn app-btn--lg mr-2 flex-1 rounded-full border border-[#1F1F1F] bg-white text-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:hover:text-white ${className}`.trim()}
    >
      {t("host_back")}
    </button>
  );
}
