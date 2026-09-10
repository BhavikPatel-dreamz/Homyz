import type { ComponentProps } from "react";

export type OnboardingBackButtonProps = Omit<ComponentProps<"button">, "children" | "type">;

export function OnboardingBackButton({ className = "", ...props }: OnboardingBackButtonProps) {
  return (
    <button
      {...props}
      type="button"
      className={`mr-2 inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-[#1F1F1F] bg-white px-5 py-2.25 text-base font-medium text-[#1F1F1F] transition-colors delay-100 duration-300 hover:bg-[#1F1F1F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-13 lg:min-h-0 lg:flex-none lg:px-6 ${className}`.trim()}
    >
      Back
    </button>
  );
}
