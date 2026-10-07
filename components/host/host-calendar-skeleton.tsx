import { Footer } from "@/components/dashboard/footer";
import { HostHeader } from "./host-header";
import { HostSubNav } from "./host-sub-nav";

export function HostCalendarSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="calendar" />
      <main aria-busy="true" aria-label="Loading calendar" className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:pl-[120px]"><div className="flex items-center gap-3"><div className="size-10 rounded-full skeleton-shimmer" /><div className="h-8 w-52 rounded skeleton-shimmer" /><div className="size-10 rounded-full skeleton-shimmer" /></div><div className="flex gap-2"><div className="h-10 w-20 rounded-full skeleton-shimmer" /><div className="h-10 w-28 rounded-full skeleton-shimmer" /></div></div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="rounded-2xl border border-zinc-200 p-4 sm:p-6"><div className="mb-5 h-5 w-36 rounded skeleton-shimmer" /><div className="grid grid-cols-7 gap-2">{Array.from({ length: 35 }).map((_, index) => <div key={index} className="aspect-square rounded-lg skeleton-shimmer" />)}</div></section><aside className="hidden rounded-2xl border border-zinc-200 p-5 xl:block"><div className="h-5 w-32 rounded skeleton-shimmer" /><div className="mt-5 h-10 w-full rounded-xl skeleton-shimmer" /><div className="mt-5 space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-4 w-full rounded skeleton-shimmer" />)}</div></aside></div>
      </main>
      <Footer />
    </div>
  );
}
