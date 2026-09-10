import type { SVGProps } from "react";

export function CloseIcon({ className = "size-7", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 6 6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
