import { Footer } from "@/components/dashboard/footer";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Container } from "@/components/ui";

export default function HostReviewLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-[calc(110px+env(safe-area-inset-bottom))] sm:pb-0">
      <HostHeader />
      <HostSubNav activeTab="today" />
      <main className="flex-1 py-8 sm:py-12" aria-busy="true" aria-label="Loading host review">
        <Container>
          <div className="mx-auto grid w-full max-w-6xl animate-pulse gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14">
            <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="aspect-[4/3] rounded-2xl bg-zinc-200" />
              <div className="mt-4 h-6 w-4/5 rounded bg-zinc-200" />
              <div className="mt-3 h-4 w-3/4 rounded bg-zinc-100" />
              <div className="mt-4 border-t border-zinc-200 pt-4"><div className="h-5 w-28 rounded bg-zinc-200" /></div>
            </aside>
            <section className="flex min-h-[560px] flex-col rounded-3xl bg-white px-2 py-3 sm:px-8 sm:py-8">
              <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center">
                <div className="h-3 w-20 rounded bg-zinc-100" />
                <div className="mt-5 h-11 w-[min(32rem,92%)] rounded-lg bg-zinc-200" />
                <div className="mt-4 h-4 w-[min(25rem,80%)] rounded bg-zinc-100" />
              </div>
              <div className="mx-auto mt-8 w-full max-w-xl"><div className="h-1 rounded-full bg-zinc-200" /></div>
            </section>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
