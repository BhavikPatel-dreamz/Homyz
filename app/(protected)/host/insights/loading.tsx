import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";
import { HOST_REPORTING_CONTAINER_CLASS, HOST_REPORTING_MAIN_CLASS } from "@/components/host/dashboard/host-reporting-layout";

export default function HostInsightsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-0">
      <HostHeader />
      <main aria-busy="true" aria-label="Loading insights" className={HOST_REPORTING_MAIN_CLASS}>
        <Container className={HOST_REPORTING_CONTAINER_CLASS}>
          <div className="animate-pulse space-y-8">
            {/* Header skeleton */}
            <div className="flex flex-col gap-5 border-b border-[#E5E5E5] pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2.5 max-w-xl">
                <div className="h-4 w-28 rounded bg-[#F3F4F5]" />
                <div className="h-9 w-40 rounded bg-[#E5E5E5]" />
                <div className="h-4 w-72 max-w-full rounded bg-[#F3F4F5]" />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center shrink-0">
                <div className="h-11 sm:h-12 w-full sm:w-48 rounded-full bg-[#F3F4F5]" />
                <div className="h-11 sm:h-12 w-full sm:w-48 rounded-full bg-[#F3F4F5]" />
              </div>
            </div>

            {/* Tab navigation skeleton */}
            <div className="flex gap-6 border-b border-[#E5E5E5] pb-4">
              <div className="h-6 w-20 rounded bg-[#E5E5E5]" />
              <div className="h-6 w-16 rounded bg-[#F3F4F5]" />
              <div className="h-6 w-28 rounded bg-[#F3F4F5]" />
              <div className="h-6 w-24 rounded bg-[#F3F4F5]" />
            </div>

            {/* Overview cards skeleton */}
            <div className="grid gap-8 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-72 rounded-3xl border border-[#E5E5E5] bg-white p-8 shadow-2xs">
                  <div className="h-4 w-28 rounded bg-[#F3F4F5]" />
                  <div className="mt-5 h-12 w-36 rounded-lg bg-[#E5E5E5]" />
                  <div className="mt-8 space-y-4">
                    <div className="h-3 w-full rounded bg-[#F3F4F5]" />
                    <div className="h-3 w-5/6 rounded bg-[#F3F4F5]" />
                    <div className="h-3 w-4/6 rounded bg-[#FAFAFA]" />
                  </div>
                </div>
              ))}
            </div>

            {/* Table/List skeleton */}
            <div className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-2xs sm:p-8">
              <div className="h-6 w-44 rounded bg-[#E5E5E5]" />
              <div className="mt-3 h-3 w-80 max-w-full rounded bg-[#F3F4F5]" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-10 rounded-full bg-[#F3F4F5]" />
                ))}
              </div>
              <div className="mt-6 space-y-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3 border-t border-[#EDEDED] pt-6 first:border-t-0 first:pt-0">
                    <div className="h-4 w-48 rounded bg-[#E5E5E5]" />
                    <div className="h-3 w-full rounded bg-[#F3F4F5]" />
                    <div className="h-3 w-3/4 rounded bg-[#F3F4F5]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
