import React from "react";

interface AdminSectionHeaderProps {
  title: string;
  description?: string;
  subtitle?: string;
  badge?: string | number;
  actions?: React.ReactNode;
  className?: string;
}

export function AdminSectionHeader({
  title,
  description,
  subtitle,
  badge,
  actions,
  className = "",
}: AdminSectionHeaderProps) {
  const sub = subtitle || description;
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-medium text-zinc-900 tracking-tight">
            {title}
          </h2>
          {badge !== undefined && (
            <span className="inline-flex items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
              {badge}
            </span>
          )}
        </div>
        {sub && (
          <p className="mt-0.5 text-xs font-normal text-zinc-500">
            {sub}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

