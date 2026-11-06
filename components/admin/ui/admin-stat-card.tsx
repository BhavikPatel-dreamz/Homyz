import React from "react";

export type AdminStatCardColor =
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "rose"
  | "zinc";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  comparisonText?: string;
  delta?: {
    value: number;
    label?: string;
    isExpense?: boolean;
    isPercentagePoint?: boolean;
  } | null;
  deltaType?: "percentage" | "currency" | "count";
  icon?: React.ReactNode;
  iconColor?: AdminStatCardColor;
  accentColor?: AdminStatCardColor;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const colorStyles: Record<AdminStatCardColor, string> = {
  amber: "bg-amber-50 text-amber-700 border-amber-200/50",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  sky: "bg-sky-50 text-sky-700 border-sky-200/50",
  violet: "bg-violet-50 text-violet-700 border-violet-200/50",
  rose: "bg-rose-50 text-rose-700 border-rose-200/50",
  zinc: "bg-zinc-100 text-zinc-700 border-zinc-200/50",
};

export function AdminStatCard({
  label,
  value,
  subtitle,
  comparisonText,
  delta,
  icon,
  iconColor,
  accentColor = "amber",
  loading = false,
  onClick,
  className = "",
}: AdminStatCardProps) {
  const isClickable = Boolean(onClick);
  const resolvedColor = iconColor || accentColor || "amber";
  const displaySubtitle = subtitle || comparisonText;

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all ${
        isClickable
          ? "cursor-pointer hover:border-zinc-300 hover:shadow-xs"
          : ""
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-normal text-zinc-500 truncate" title={label}>
          {label}
        </span>
        {icon && (
          <div
            className={`flex size-8 sm:size-9 items-center justify-center rounded-xl border shrink-0 ${colorStyles[resolvedColor]}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-zinc-100" />
        ) : (
          <div className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900">
            {value}
          </div>
        )}

        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {delta !== undefined && delta !== null && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                delta.value > 0
                  ? delta.isExpense
                    ? "text-rose-600"
                    : "text-emerald-600"
                  : delta.value < 0
                  ? delta.isExpense
                    ? "text-emerald-600"
                    : "text-rose-600"
                  : "text-zinc-500"
              }`}
            >
              {delta.value > 0 ? "↑" : delta.value < 0 ? "↓" : "•"}
              {delta.label || `${Math.abs(delta.value)}${delta.isPercentagePoint ? " pp" : "%"}`}
            </span>
          )}

          {displaySubtitle && (
            <span className="text-xs font-normal text-zinc-400">
              {displaySubtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
