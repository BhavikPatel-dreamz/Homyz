import type { ComponentProps, ReactNode } from "react";
import { LoadingIcon } from "@/components/ui/loading-icon";

export type OnboardingPrimaryButtonProps = Omit<ComponentProps<"button">, "children" | "type" | "disabled"> & {
  label: ReactNode;
  isLoading?: boolean;
  loadingLabel?: ReactNode;
  disabled?: boolean;
};

export function OnboardingPrimaryButton({
  label,
  isLoading = false,
  loadingLabel = "Loading...",
  disabled = false,
  className = "",
  ...props
}: OnboardingPrimaryButtonProps) {
  return (
    <button
      {...props}
      type="button"
      disabled={isLoading || disabled}
      className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-transparent bg-[#FCDF9C] px-5 py-2.25 text-base font-medium text-[#1F1F1F] transition-colors delay-100 duration-300 hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-13 lg:min-h-0 lg:flex-none lg:px-6 ${className}`.trim()}
    >
      {isLoading ? (
        <>
          <LoadingIcon className="mr-2 size-4 shrink-0 animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : label}
    </button>
  );
}
