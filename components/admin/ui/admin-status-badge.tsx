import React from "react";

export type AdminStatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface AdminStatusBadgeProps {
  status?: string;
  label?: string;
  variant?: AdminStatusVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

function resolveVariant(status?: string): AdminStatusVariant {
  if (!status) return "neutral";
  const s = status.toUpperCase();

  if (
    s === "CONFIRMED" ||
    s === "CAPTURED" ||
    s === "ACTIVE" ||
    s === "PAID" ||
    s === "SUCCEEDED" ||
    s === "VERIFIED" ||
    s === "COMPLIANT" ||
    s === "APPROVED" ||
    s === "RESOLVED" ||
    s === "PUBLISHED"
  ) {
    return "success";
  }

  if (
    s === "PENDING" ||
    s === "WAITING" ||
    s === "IN_REVIEW" ||
    s === "ACTION_REQUIRED" ||
    s === "PARTIALLY_REFUNDED" ||
    s === "HOLD" ||
    s === "PROCESSING"
  ) {
    return "warning";
  }

  if (
    s === "CANCELLED" ||
    s === "CANCELED" ||
    s === "FAILED" ||
    s === "REJECTED" ||
    s === "SUSPENDED" ||
    s === "VOIDED" ||
    s === "NON_COMPLIANT" ||
    s === "CRITICAL"
  ) {
    return "danger";
  }

  if (
    s === "UPCOMING" ||
    s === "SCHEDULED" ||
    s === "ELIGIBLE" ||
    s === "INFO" ||
    s === "OPEN"
  ) {
    return "info";
  }

  return "neutral";
}

const variantStyles: Record<
  AdminStatusVariant,
  { bg: string; text: string; border: string; dot: string }
> = {
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/70",
    dot: "bg-emerald-500",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200/70",
    dot: "bg-amber-500",
  },
  danger: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/70",
    dot: "bg-rose-500",
  },
  info: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200/70",
    dot: "bg-sky-500",
  },
  neutral: {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    border: "border-zinc-200/70",
    dot: "bg-zinc-400",
  },
};

export function AdminStatusBadge({
  status,
  label,
  variant,
  size = "md",
  dot = true,
  className = "",
}: AdminStatusBadgeProps) {
  const effectiveVariant = variant || resolveVariant(status);
  const styles = variantStyles[effectiveVariant];
  const displayLabel = label || status?.replaceAll("_", " ") || "Unknown";

  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[10px]"
      : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${styles.bg} ${styles.text} ${styles.border} ${sizeClass} font-medium capitalize tracking-tight ${className}`}
    >
      {dot && (
        <span
          className={`size-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}

