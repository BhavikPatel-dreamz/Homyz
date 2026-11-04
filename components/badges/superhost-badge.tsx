import type { HTMLAttributes } from "react";

type SuperhostBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  active: boolean | null | undefined;
  compact?: boolean;
  label?: string;
};

/** Public badge: callers must pass the persisted host-level status only. */
export function SuperhostBadge({ active, compact = false, label = "Superhost", className = "", ...props }: SuperhostBadgeProps) {
  if (active !== true) return null;
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 font-medium text-sky-950 ${
        compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`}
    >
      <span aria-hidden="true">★</span>
      <span>{label}</span>
    </span>
  );
}
