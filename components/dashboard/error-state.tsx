"use client";

import React from "react";

export function ErrorState({
  title = "Unable to load reservations",
  message = "We encountered a temporary issue loading your reservation details. Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--error)]/30 bg-[var(--error)]/5 p-10 text-center my-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--error)]/10 text-[var(--error)] mb-3">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-muted-foreground">{title}</h3>
      <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-md">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-[var(--muted)] transition-colors shadow-2xs"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
