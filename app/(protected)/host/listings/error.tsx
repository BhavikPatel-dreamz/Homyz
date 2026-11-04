"use client";

import { useEffect } from "react";

/** A bounded recovery state for listing-grid and listing-editor data failures. */
export default function HostListingsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Host listings route failed to render", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-2xs sm:p-8">
        <h1 className="text-lg font-medium text-[#1F1F1F]">We couldn’t load this listing</h1>
        <p className="mt-2 text-sm leading-6 text-[#727272]">
          Check your connection and try again. Your saved changes have not been discarded.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#1F1F1F] px-5 text-sm font-medium text-white transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F1F1F]"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
