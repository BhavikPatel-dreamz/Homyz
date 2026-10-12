"use client";

import React from "react";
import type { BookingStatusTimelineEvent } from "@/lib/booking/booking-status";
import { useLanguage } from "@/lib/i18n/language-context";

interface BookingStatusTimelineProps {
  events: BookingStatusTimelineEvent[];
  className?: string;
}

function formatTimelineDate(timestampStr: string | null): string {
  if (!timestampStr) return "";
  try {
    const d = new Date(timestampStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

export function BookingStatusTimeline({ events, className = "" }: BookingStatusTimelineProps) {
  const { t } = useLanguage();

  if (!events || events.length === 0) return null;

  return (
    <section
      aria-labelledby="booking-timeline-heading"
      className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-2xs sm:rounded-2xl sm:p-6 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5 mb-5">
        <h3 id="booking-timeline-heading" className="text-base sm:text-lg font-semibold text-[#1F1F1F]">
          {t("booking_details_timeline_title", "Reservation timeline")}
        </h3>
        <span className="text-xs text-zinc-500 font-medium">
          {t("booking_details_timeline_subtitle", "Status updates & milestones")}
        </span>
      </div>

      <ol role="list" className="relative space-y-6">
        {events.map((evt, idx) => {
          const isLast = idx === events.length - 1;
          const formattedTime = formatTimelineDate(evt.timestamp);

          // Indicator color & icon based on state
          let indicatorClasses = "bg-emerald-600 text-white";
          let lineClasses = "bg-emerald-200";

          if (evt.state === "current") {
            indicatorClasses = "bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse";
            lineClasses = "bg-zinc-200";
          } else if (evt.state === "terminal_declined") {
            indicatorClasses = "bg-rose-600 text-white";
            lineClasses = "bg-rose-200";
          } else if (evt.state === "terminal_expired") {
            indicatorClasses = "bg-slate-500 text-white";
            lineClasses = "bg-slate-200";
          } else if (evt.state === "terminal_cancelled") {
            indicatorClasses = "bg-red-600 text-white";
            lineClasses = "bg-red-200";
          }

          return (
          <li key={evt.id} role="listitem" className="relative flex items-start gap-3.5 sm:gap-4">
              {/* Connecting vertical line */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`absolute left-3.5 top-8 -bottom-6 w-0.5 ${lineClasses}`}
                />
              )}

              {/* Node Icon */}
              <div
                className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-2xs ${indicatorClasses}`}
              >
                {evt.state === "completed" && (
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {evt.state === "current" && (
                  <span className="size-2 rounded-full bg-white" />
                )}
                {evt.state === "terminal_declined" && (
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {evt.state === "terminal_expired" && (
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {evt.state === "terminal_cancelled" && (
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900 leading-tight">
                    {evt.title}
                  </h4>
                  {formattedTime && (
                    <time dateTime={evt.timestamp || undefined} className="text-xs font-normal text-zinc-500 sm:whitespace-nowrap">
                      {formattedTime}
                    </time>
                  )}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  {evt.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
