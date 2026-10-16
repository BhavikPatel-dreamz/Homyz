import { Footer } from "@/components/dashboard/footer";
import { HostHeader } from "./host-header";
import { HostSubNav } from "./host-sub-nav";

export function HostBookingApprovalsSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900"><HostHeader /><HostSubNav />
      <main aria-busy="true" aria-label="Loading booking requests" className="flex-1 px-4 sm:px-6"><div className="mx-auto w-full max-w-6xl py-8 sm:py-12"><div className="border-b border-zinc-200 pb-7"><div className="h-4 w-20 rounded skeleton-shimmer" /><div className="mt-3 h-9 w-64 rounded skeleton-shimmer" /><div className="mt-3 h-4 w-96 max-w-full rounded skeleton-shimmer" /></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <article key={index} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"><div className="aspect-[16/10] rounded-2xl skeleton-shimmer" /><div className="mt-4 h-5 w-3/4 rounded skeleton-shimmer" /><div className="mt-2 h-4 w-1/2 rounded skeleton-shimmer" /><div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3.5">{Array.from({ length: 4 }).map((_, detailIndex) => <div key={detailIndex} className="h-7 rounded skeleton-shimmer" />)}</div><div className="mt-5 h-11 w-full rounded-xl skeleton-shimmer" /></article>)}</div></div></main><Footer />
    </div>
  );
}
