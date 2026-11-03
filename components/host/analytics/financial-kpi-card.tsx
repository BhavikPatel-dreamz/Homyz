"use client";

import React, { ReactNode } from "react";
import { PercentageChangeBadge } from "./percentage-change-badge";

interface FinancialKPICardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  percentageChange?: number | string | null;
  percentageSuffix?: string;
  subtitle?: string;
  invertColors?: boolean;
  className?: string;
}

export function FinancialKPICard({
  icon,
  label,
  value,
  percentageChange,
  percentageSuffix = "",
  subtitle,
  invertColors = false,
  className = "",
}: FinancialKPICardProps) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 shadow-2xs transition hover:border-zinc-300 hover:shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
              {icon}
            </div>
          )}
          <span className="truncate text-xs font-medium text-zinc-600">
            {label}
          </span>
        </div>
        {percentageChange !== undefined && (
          <PercentageChangeBadge
            value={percentageChange}
            suffix={percentageSuffix}
            invertColors={invertColors}
          />
        )}
      </div>

      <div className="mt-3.5">
        <p className="text-xl sm:text-2xl font-medium tracking-tight text-zinc-950 truncate">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-[11px] font-normal text-zinc-500 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

