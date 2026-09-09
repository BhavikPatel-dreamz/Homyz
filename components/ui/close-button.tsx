import type { ComponentPropsWithoutRef } from "react";

type CloseButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children">;

export function CloseButton({
  className = "",
  "aria-label": label = "Close dialog",
  ...props
}: CloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[#1F1F1F] transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <path d="M1 11L11 1M1 1L11 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
