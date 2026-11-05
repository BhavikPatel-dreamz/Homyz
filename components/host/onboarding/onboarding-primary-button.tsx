import type { ComponentProps, ReactNode } from "react";
import { LoadingIcon } from "@/components/ui/loading-icon";
import { useLanguage } from "@/lib/i18n/language-context";

export type OnboardingPrimaryButtonProps = Omit<ComponentProps<"button">, "children" | "type" | "disabled"> & {
  label: ReactNode;
  isLoading?: boolean;
  loadingLabel?: ReactNode;
  disabled?: boolean;
};

export function OnboardingPrimaryButton({
  label,
  isLoading = false,
  loadingLabel,
  disabled = false,
  className = "",
  ...props
}: OnboardingPrimaryButtonProps) {
  const { t } = useLanguage();
  const displayLoadingLabel = loadingLabel ?? t("host_loading");
  return (
    <button
      {...props}
      type="button"
      disabled={isLoading || disabled}
      className={`app-btn app-btn--lg flex-1 rounded-full border border-transparent bg-[#FCDF9C] text-[#1F1F1F] hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 lg:flex-none ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <LoadingIcon className="mr-2 size-4 shrink-0 animate-spin" />
          <span>{displayLoadingLabel}</span>
        </>
      ) : label}
    </button>
  );
}
