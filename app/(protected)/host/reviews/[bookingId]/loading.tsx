import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui";

export default function HostReviewLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-0 sm:pb-0">
      <HostHeader />
      <main className="flex-1 flex flex-col py-0 sm:py-12" aria-busy="true" aria-label="Loading host review">
        <Container className="flex-1 flex flex-col">
          <div className="relative mx-auto w-full max-w-3xl animate-pulse px-0 sm:px-4 py-2 sm:py-8">
            <section className="flex min-h-[460px] flex-col justify-center rounded-3xl bg-white px-2 py-4 sm:px-8 sm:py-8">
              <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center text-center">
                <div className="h-7 w-28 rounded-full bg-zinc-200" />
                <div className="mt-6 h-12 w-[min(28rem,90%)] rounded-lg bg-zinc-200" />
                <div className="mt-5 h-4 w-[min(24rem,80%)] rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-[min(20rem,70%)] rounded bg-zinc-100" />
                <div className="mt-10 h-12 w-48 rounded-full bg-zinc-200" />
              </div>
            </section>
          </div>
        </Container>
      </main>
    </div>
  );
}
