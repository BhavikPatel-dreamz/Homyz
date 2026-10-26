import React from "react";
import Link from "next/link";
import { InfoIcon } from "./icons";
import { primaryButtonInteractionClass } from "@/components/ui/button";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface SettingsEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function SettingsEmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = "",
}: SettingsEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center sm:p-12 ${className}`}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-white border border-zinc-200 text-zinc-700 shadow-2xs">
        {icon || <InfoIcon size={28} />}
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#1F1F1F] sm:text-lg">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-[#727272] leading-relaxed">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className={`inline-flex items-center rounded-full bg-zinc-950 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 transition-colors ${primaryButtonInteractionClass}`}
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className={`inline-flex items-center rounded-full bg-zinc-950 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 transition-colors ${primaryButtonInteractionClass}`}
              >
                {action.label}
              </button>
            ))}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

