import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";

export default function HostSupportCaseDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] text-[#1F1F1F] sm:pb-12">
      <HostHeader />
      <main className="flex-1 py-6 sm:py-8 lg:py-10">
        <Container className="px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <div className="space-y-6 animate-pulse font-sans">
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-zinc-200" />
                <div className="h-8 w-80 rounded-lg bg-zinc-200" />
              </div>
              <div className="flex gap-4">
                <div className="h-6 w-24 rounded bg-zinc-200" />
                <div className="h-9 w-44 rounded-full bg-zinc-200" />
              </div>
            </div>
            <div className="h-52 rounded-2xl bg-zinc-100 border border-zinc-200" />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="h-96 rounded-2xl bg-zinc-100 border border-zinc-200" />
              <div className="space-y-5">
                <div className="h-44 rounded-2xl bg-zinc-100 border border-zinc-200" />
                <div className="h-44 rounded-2xl bg-zinc-100 border border-zinc-200" />
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}

