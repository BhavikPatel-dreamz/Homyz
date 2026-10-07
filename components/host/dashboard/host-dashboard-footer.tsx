import Link from "next/link";

/** A quiet workspace footer used only by the reporting dashboard. */
export function HostDashboardFooter() {
  return (
    <footer className="w-full border-t border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-5 text-xs text-[#727272] sm:px-6 lg:px-8">
        <span>© 2026 Homyz</span>
        <nav aria-label="Dashboard support links" className="flex items-center gap-4">
          <Link href="/help" className="transition hover:text-[#1F1F1F]">Help Centre</Link>
          <Link href="/host/today" className="transition hover:text-[#1F1F1F]">Host workspace</Link>
        </nav>
      </div>
    </footer>
  );
}
