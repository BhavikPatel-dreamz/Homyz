import React from "react";
import Link from "next/link";
import { AlertTriangleIcon } from "./icons";

export interface SettingsErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  backHref?: string;
  className?: string;
}

export function SettingsErrorState({
  title = "Unable to load settings",
  message = "An error occurred while loading this section. Please try again or return to settings.",
  onRetry,
  backHref = "/host/account-settings",
  className = "",
}: SettingsErrorStateProps) {
  return (
    <div
      role="alert"
      className={`rounded-3xl border border-rose-200 bg-rose-50/70 p-6 sm:p-8 text-center ${className}`}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
        <AlertTriangleIcon size={24} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-rose-950 sm:text-lg">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs sm:text-sm text-rose-800 leading-relaxed">
        {message}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-rose-900 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-rose-950 transition-colors"
          >
            Try again
          </button>
        )}
        {backHref && (
          <Link
            href={backHref}
            className="rounded-full border border-rose-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-rose-900 hover:bg-rose-50 transition-colors"
          >
            Return to settings
          </Link>
        )}
      </div>
    </div>
  );
}

