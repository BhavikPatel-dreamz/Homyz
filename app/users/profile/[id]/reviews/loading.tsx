import { Container } from "@/components/ui";

export default function HostReviewsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1F1F1F] antialiased">
      {/* AppHeader placeholder / contract */}
      <div className="h-20 w-full border-b border-zinc-200/80 bg-white" />

      <main className="w-full flex-1 pb-16 pt-5 sm:pt-8">
        <Container>
          <div className="mx-auto w-full max-w-[1262px]">
            {/* Back button skeleton */}
            <div className="flex items-center gap-3">
              <div className="size-7.5 rounded-full bg-zinc-200 animate-pulse" />
              <div className="h-4 w-44 rounded-md bg-zinc-200 animate-pulse" />
            </div>

            {/* Responsive 2-column layout */}
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-14">
              {/* Left Column / Sidebar */}
              <div className="space-y-6">
                {/* Host summary card skeleton */}
                <div className="min-h-[260px] rounded-[24px] sm:rounded-[30px] border border-[#dedede] bg-white p-7 animate-pulse">
                  <div className="grid grid-cols-2 gap-x-7 gap-y-4">
                    <div className="flex flex-col items-center">
                      <div className="size-[104px] rounded-full bg-zinc-200" />
                      <div className="mt-4 h-5 w-24 rounded bg-zinc-200" />
                      <div className="mt-2 h-4 w-16 rounded bg-zinc-100" />
                    </div>
                    <div className="divide-y divide-[#dedede] space-y-4">
                      <div className="h-5 w-12 rounded bg-zinc-200" />
                      <div className="pt-4 h-5 w-16 rounded bg-zinc-200" />
                      <div className="pt-4 h-5 w-20 rounded bg-zinc-200" />
                    </div>
                  </div>
                </div>

                {/* Rating breakdown skeleton */}
                <div className="rounded-[20px] sm:rounded-[24px] border border-[#dedede] bg-white p-6 space-y-4 animate-pulse">
                  <div className="flex items-baseline justify-between">
                    <div className="space-y-2">
                      <div className="h-3 w-24 rounded bg-zinc-200" />
                      <div className="h-8 w-20 rounded bg-zinc-300" />
                    </div>
                    <div className="h-4 w-20 rounded bg-zinc-200" />
                  </div>
                  <div className="space-y-2.5 pt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-3 w-6 rounded bg-zinc-200" />
                        <div className="h-2 flex-1 rounded-full bg-zinc-100" />
                        <div className="h-3 w-6 rounded bg-zinc-100" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Reviews List Skeleton */}
              <div className="space-y-6 min-w-0">
                <div className="border-b border-zinc-200/80 pb-5 space-y-2">
                  <div className="h-8 w-56 rounded bg-zinc-200 animate-pulse" />
                  <div className="h-4 w-36 rounded bg-zinc-100 animate-pulse" />
                </div>

                {/* Search Bar Skeleton */}
                <div className="h-11 w-full rounded-full bg-zinc-100 animate-pulse" />

                {/* Review Cards Skeleton */}
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-[20px] border border-zinc-200/80 bg-white p-5 sm:p-6 space-y-4 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-11 rounded-full bg-zinc-200" />
                          <div className="space-y-1.5">
                            <div className="h-4 w-28 rounded bg-zinc-200" />
                            <div className="h-3 w-20 rounded bg-zinc-100" />
                          </div>
                        </div>
                        <div className="h-4 w-20 rounded bg-zinc-200" />
                      </div>
                      <div className="h-6 w-48 rounded-full bg-zinc-100" />
                      <div className="space-y-2 pt-1">
                        <div className="h-4 w-full rounded bg-zinc-100" />
                        <div className="h-4 w-5/6 rounded bg-zinc-100" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
