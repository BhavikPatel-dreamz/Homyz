import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";

export default function ListingsLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 lg:py-20 py-10">
        <Container>
          {/* Top Control Bar Skeleton */}
          <div className="flex items-center justify-between gap-3 pb-5 animate-pulse">
            <div className="flex items-center gap-2 overflow-hidden py-1 flex-1">
              <div className="h-9 w-24 rounded-full bg-zinc-200 shrink-0" />
              <div className="h-9 w-28 rounded-full bg-zinc-200 shrink-0" />
              <div className="h-9 w-28 rounded-full bg-zinc-200 shrink-0" />
              <div className="h-9 w-28 rounded-full bg-zinc-200 shrink-0" />
              <div className="h-9 w-28 rounded-full bg-zinc-200 shrink-0" />
            </div>
            <div className="h-9 w-36 rounded-full bg-zinc-200 shrink-0" />
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left section skeleton */}
            <div className="w-full lg:w-[58%] xl:w-[56%] min-w-0">
              <div className="pb-4 border-b border-zinc-200/80 mb-5 animate-pulse">
                <div className="h-7 w-72 bg-zinc-200 rounded-md mb-2" />
                <div className="h-4 w-48 bg-zinc-200 rounded-md" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-[20px] border border-zinc-200 overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-zinc-200 w-full" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3.5 bg-zinc-200 rounded w-3/4" />
                      <div className="h-3 bg-zinc-200 rounded w-1/2" />
                      <div className="h-3 bg-zinc-200 rounded w-2/3" />
                      <div className="h-4 bg-zinc-200 rounded w-1/3 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right sticky map skeleton (Desktop) */}
            <div className="hidden lg:block w-full lg:w-[42%] xl:w-[44%] shrink-0 h-[calc(100vh-104px)] rounded-[20px] border border-[#1f1f1f] bg-zinc-100 animate-pulse" />
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

