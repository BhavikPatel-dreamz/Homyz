"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Container } from "@/components/ui";
import { Footer } from "@/components/dashboard/footer";

export default function HostTodayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Host Today dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1F1F1F]">
      <HostHeader />
      <HostSubNav activeTab="today" />
      <main className="flex-1 py-16">
        <Container>
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-[24px] border border-zinc-200 bg-zinc-50/50 p-8 text-center shadow-xs">
            <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-rose-100 text-2xl text-rose-600">
              ⚠
            </span>
            <h2 className="text-xl font-bold text-[#1F1F1F]">
              Unable to load reservations
            </h2>
            <p className="mt-2 text-sm text-[#727272]">
              An error occurred while fetching your operational reservations for today.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-black cursor-pointer"
              >
                Try again
              </button>
              <Link
                href="/host/calendar"
                className="rounded-full border border-zinc-300 bg-white px-6 py-2.5 text-xs font-semibold text-[#1F1F1F] transition-colors hover:bg-zinc-50"
              >
                Go to calendar
              </Link>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

