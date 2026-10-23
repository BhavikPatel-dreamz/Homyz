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
            <div className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
              <div className="space-y-3">
                <div className="h-8 w-44 rounded-lg bg-zinc-200" />
                <div className="h-4 w-72 max-w-full rounded bg-zinc-100" />
              </div>
              <div className="flex gap-3">
                <div className="h-10 w-36 rounded-full bg-zinc-100" />
                <div className="h-10 w-32 rounded-full bg-zinc-100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 rounded-xl bg-white" />
              ))}
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-72 rounded-3xl border border-zinc-200 bg-white p-8">
                  <div className="h-4 w-28 rounded bg-zinc-100" />
                  <div className="mt-5 h-12 w-36 rounded-lg bg-zinc-200" />
                  <div className="mt-8 space-y-4">
                    <div className="h-3 w-full rounded bg-zinc-100" />
                    <div className="h-3 w-5/6 rounded bg-zinc-100" />
                    <div className="h-3 w-4/6 rounded bg-zinc-100" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
              <div className="h-6 w-44 rounded bg-zinc-200" />
              <div className="mt-3 h-3 w-80 max-w-full rounded bg-zinc-100" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-10 rounded-2xl bg-zinc-100" />
                ))}
              </div>
              <div className="mt-6 space-y-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3 border-t border-zinc-100 pt-6 first:border-t-0 first:pt-0">
                    <div className="h-4 w-48 rounded bg-zinc-200" />
                    <div className="h-3 w-full rounded bg-zinc-100" />
                    <div className="h-3 w-3/4 rounded bg-zinc-100" />
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
