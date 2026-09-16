import type { ComponentProps } from "react";

export type BackButtonProps = Omit<ComponentProps<"button">, "children">;

export function BackButton({
  className = "",
  type = "button",
  "aria-label": ariaLabel = "Go back",
  ...props
}: BackButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={ariaLabel}
      className={`hidden sm:flex w-8 h-8 shrink-0 rounded-full border border-[#1F1F1F] bg-[#F3F4F5] items-center justify-center text-[#1F1F1F] hover:bg-[#1F1F1F] text-sm transition-all cursor-pointer focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-50 group ${className}`.trim()}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="m15 18-6-6 6-6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="group-hover:stroke-white"
        />
      </svg>
    </button>
  );
}
