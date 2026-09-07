"use client";

import React from "react";
import Link from "next/link";

export function EmptyState({
  title = "No upcoming reservations",
  description = "You don't have any active stay reservations at the moment. Explore listings or create a new booking.",
  actionHref = "/host/listings",
  actionText = "Explore Listings",
}: {
  title?: string;
  description?: string;
  actionHref?: string;
  actionText?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)]/50 p-12 text-center my-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBDE9B] text-[#291E05] shadow-xs mb-4 dark:bg-[#f59e0b] dark:text-zinc-950">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-muted-foreground">{title}</h3>
      <p className="mt-1.5 text-xs text-[var(--muted-foreground)] max-w-sm leading-relaxed">
        {description}
      </p>
      {actionHref && (
        <Link
          href={actionHref}
          className="mt-6 rounded-full bg-[var(--primary)] px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-xs"
        >
          {actionText}
        </Link>
      )}
    </div>
  );
}
