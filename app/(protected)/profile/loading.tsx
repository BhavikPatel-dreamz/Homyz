"use client";

import { usePathname } from "next/navigation";
import { GuestDashboardSidebar } from "@/components/dashboard/guest-sidebar";
import { LoadingSkeleton } from "@/components/dashboard/loading-skeleton";
import { extractProfileRoute } from "@/lib/profile/tab-utils";

function AboutMeSkeleton() {
  return (
    <>
      <div className="mb-8 flex items-center gap-5">
        <div className="h-10 w-40 rounded-lg skeleton-shimmer" />
        <div className="h-12 w-20 rounded-full skeleton-shimmer" />
      </div>

      <div className="mb-8 flex items-start gap-6">
        <div className="h-[124px] w-[124px] shrink-0 rounded-xl skeleton-shimmer sm:h-[151px] sm:w-[233px] sm:rounded-2xl" />
        <div className="flex min-h-[124px] flex-1 flex-col justify-center gap-4 sm:min-h-[151px] sm:max-w-[195px]">
          <div className="h-5 w-28 rounded skeleton-shimmer" />
          <div className="h-4 w-36 rounded skeleton-shimmer" />
          <div className="flex gap-5 border-t border-zinc-200 pt-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="h-9 w-9 rounded-full skeleton-shimmer" />
                <div className="h-3 w-10 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="border-t border-zinc-200/80 pt-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 rounded skeleton-shimmer" />
            <div className="h-4 w-60 rounded skeleton-shimmer" />
          </div>
          <div className="h-6 w-16 rounded-full skeleton-shimmer" />
        </div>
        <div className="h-56 max-w-[336px] rounded-2xl border border-zinc-200 skeleton-shimmer" />
      </section>
    </>
  );
}

function ReservationsSkeleton() {
  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="h-10 w-64 rounded-lg skeleton-shimmer" />
        <div className="h-10 w-64 rounded-full skeleton-shimmer" />
      </div>
      <div className="mb-8 h-12 w-full rounded-full skeleton-shimmer" />
      <LoadingSkeleton count={3} />
    </>
  );
}

export default function Loading() {
  const pathname = usePathname();
  const activeTab = extractProfileRoute({
    pathname: pathname ?? "/profile",
  }).tab;

  return (
    <div className="min-h-[85vh] w-full bg-white pb-14 pt-0 lg:pb-28">
      <div className="grid grid-cols-1 gap-3 sm:gap-8 lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[452px_minmax(0,1fr)]">
        <GuestDashboardSidebar activeId={activeTab} />

        <main
          aria-busy="true"
          aria-label="Loading profile content"
          className="order-1 flex min-w-0 flex-col lg:order-2"
        >
          {activeTab === "about_me" ? <AboutMeSkeleton /> : <ReservationsSkeleton />}
        </main>
      </div>
    </div>
  );
}
