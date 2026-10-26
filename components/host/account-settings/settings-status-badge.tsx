import React from "react";

export type BadgeVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "roadmapped";

export interface SettingsStatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, { badge: string; dot: string }> = {
  success: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  warning: {
    badge: "bg-amber-50 text-amber-900 border-amber-200/80",
    dot: "bg-amber-500",
  },
  error: {
    badge: "bg-rose-50 text-rose-800 border-rose-200/80",
    dot: "bg-rose-500",
  },
  info: {
    badge: "bg-sky-50 text-sky-800 border-sky-200/80",
    dot: "bg-sky-500",
  },
  neutral: {
    badge: "bg-zinc-100 text-zinc-800 border-zinc-200",
    dot: "bg-zinc-500",
  },
  roadmapped: {
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200/80",
    dot: "bg-indigo-500",
  },
};

export function SettingsStatusBadge({
  label,
  variant = "neutral",
  className = "",
  dot = false,
}: SettingsStatusBadgeProps) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors ${styles.badge} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
  );
}

