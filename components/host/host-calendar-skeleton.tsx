"use client";

import { HostHeader } from "./host-header";
import { useLanguage } from "@/lib/i18n/language-context";

const shimmer = "skeleton-shimmer";

function CalendarWeekSkeleton({ week }: { week: number }) {
  const bookingBar = week === 0
    ? "col-start-3 col-end-6"
    : week === 1
      ? "col-start-2 col-end-4"
      : week === 2
        ? "col-start-5 col-end-8"
        : null;

  return (
    <div className="relative">
      <div className="grid min-w-0 grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: 7 }, (_, day) => (
          <div
            key={`${week}-${day}`}
            className="min-h-[76px] overflow-hidden rounded-[14px] border border-[#ececef] bg-white p-2 sm:min-h-[102px] sm:p-2.5 lg:min-h-[140px] lg:p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className={`block size-3 rounded-full ${shimmer}`} />
            <span className={`mt-3 block h-3 w-16 rounded ${shimmer}`} />
          </div>
        ))}
      </div>
      {bookingBar ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 grid grid-cols-7 gap-1.5 sm:gap-2">
          <span className={`h-8 rounded-full ${bookingBar} ${shimmer}`} />
        </div>
      ) : null}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <aside className="hidden h-full w-[300px] shrink-0 overflow-hidden border-l border-[#eeeeee] px-5 py-5 xl:block xl:w-[338px] dark:border-zinc-800">
      <div className="space-y-7">
        <section>
          <div className="flex items-center justify-between">
            <span className={`h-4 w-28 rounded ${shimmer}`} />
            <span className={`size-4 rounded-full ${shimmer}`} />
          </div>
          <div className="mt-4 space-y-3">
            <span className={`block h-3 w-24 rounded ${shimmer}`} />
            <span className={`block h-3 w-40 rounded ${shimmer}`} />
            <span className={`block h-3 w-36 rounded ${shimmer}`} />
          </div>
        </section>
        <div className="h-px bg-[#e7e7e8]" />
        <section>
          <div className="flex items-center justify-between">
            <span className={`h-4 w-36 rounded ${shimmer}`} />
            <span className={`size-4 rounded-full ${shimmer}`} />
          </div>
          <div className="mt-4 space-y-3">
            <span className={`block h-3 w-20 rounded ${shimmer}`} />
            <span className={`block h-3 w-32 rounded ${shimmer}`} />
          </div>
        </section>
      </div>
    </aside>
  );
}

export function HostCalendarSkeleton() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 font-sans text-[#1F1F1F] lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <HostHeader />
      <main
        aria-busy="true"
        aria-label={t("host_calendar_loading_aria", "Loading calendar")}
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:pb-6"
      >
        <div className="relative sticky top-0 z-30 hidden shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white/95 pb-5 pt-2 backdrop-blur after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[#d8d8d8] sm:flex sm:pl-[120px] sm:after:left-[129px] dark:bg-zinc-950/95 dark:after:bg-zinc-700">
          <div className="flex items-center gap-3">
            <span className={`h-7 w-44 rounded-md ${shimmer}`} />
            <span className={`size-9 rounded-full ${shimmer}`} />
            <span className={`size-9 rounded-full ${shimmer}`} />
            <span className={`h-9 w-20 rounded-full ${shimmer}`} />
          </div>
          <div className="flex items-center gap-3">
            <span className={`h-9 w-28 rounded-full ${shimmer}`} />
            <span className={`h-9 w-32 rounded-full ${shimmer}`} />
          </div>
        </div>

        <section className="sm:hidden">
          <div className="mb-5 flex items-center justify-between">
            <span className={`h-7 w-40 rounded ${shimmer}`} />
            <span className={`h-9 w-20 rounded-full ${shimmer}`} />
          </div>
          <div className="mb-3 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => <span key={index} className={`mx-auto h-2 w-6 rounded ${shimmer}`} />)}
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 5 }, (_, week) => <CalendarWeekSkeleton key={week} week={week} />)}
          </div>
        </section>

        <div className="mt-4 hidden min-h-0 flex-1 items-start gap-6 sm:flex lg:overflow-hidden">
          <aside className="flex w-[105px] shrink-0 flex-col items-center gap-3 lg:max-h-full" aria-hidden="true">
            <div className="flex h-[94px] w-[105px] flex-col items-center justify-center rounded-2xl border border-[#e5e5e7] p-3">
              <span className={`size-6 rounded-md ${shimmer}`} />
              <span className={`mt-2 h-2.5 w-14 rounded ${shimmer}`} />
              <span className={`mt-1 h-2 w-10 rounded ${shimmer}`} />
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className={`h-[94px] w-[94px] rounded-2xl ${shimmer}`} />
            ))}
          </aside>

          <section className="relative min-w-0 flex-1 overflow-hidden border-b border-[#d7d7d7] pb-4 lg:h-full lg:pr-4 dark:border-zinc-700">
            <div className="mb-4 flex items-center justify-between">
              <span className={`h-5 w-36 rounded ${shimmer}`} />
              <span className={`h-2.5 w-20 rounded ${shimmer}`} />
            </div>
            <div className="mb-3 grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: 7 }, (_, index) => <span key={index} className={`mx-auto h-2.5 w-10 rounded ${shimmer}`} />)}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, week) => <CalendarWeekSkeleton key={week} week={week} />)}
            </div>
          </section>

          <SettingsSkeleton />
        </div>
      </main>
    </div>
  );
}
