import React from "react";

export type AdminBadgeVariant =
  | "amber"
  | "emerald"
  | "rose"
  | "sky"
  | "zinc"
  | "neutral"
  | "warning"
  | "danger"
  | "success";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  badge?:
    | string
    | {
        label: string;
        variant?: AdminBadgeVariant;
      };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

const badgeVariantStyles: Record<AdminBadgeVariant, string> = {
  amber: "bg-amber-50 text-amber-800 border-amber-200/60",
  warning: "bg-amber-50 text-amber-800 border-amber-200/60",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
  rose: "bg-rose-50 text-rose-800 border-rose-200/60",
  danger: "bg-rose-50 text-rose-800 border-rose-200/60",
  sky: "bg-sky-50 text-sky-800 border-sky-200/60",
  zinc: "bg-zinc-100 text-zinc-700 border-zinc-200/60",
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200/60",
};

export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  children,
}: AdminPageHeaderProps) {
  const badgeLabel = typeof badge === "string" ? badge : badge?.label;
  const badgeVariant =
    typeof badge === "object" && badge?.variant
      ? badge.variant
      : "amber";
  const badgeClass = badgeVariantStyles[badgeVariant] || badgeVariantStyles.amber;

  return (
    <div className="flex flex-col gap-4 border-b border-zinc-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl sm:text-[26px] font-medium tracking-tight text-zinc-900">
            {title}
          </h1>
          {badgeLabel && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badgeClass}`}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs sm:text-sm font-normal text-zinc-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
