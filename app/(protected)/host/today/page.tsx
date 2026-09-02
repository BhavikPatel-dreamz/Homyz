import Link from "next/link";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui/container";

export default async function HostTodayPage() {
  await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#FEE08B] selection:text-zinc-900">
      {/* TOP HEADER */}
      <HostHeader />

      {/* TOP NAV TABS */}
      <div className="w-full bg-white border-b border-zinc-150 py-4">
        <Container className="flex items-center gap-3">
          <Link
            href="/host/today"
            className="flex items-center gap-2 rounded-2xl bg-[#FEE08B] border border-amber-300 text-zinc-950 px-5 py-2.5 text-xs font-extrabold shadow-xs"
          >
            <span className="text-sm">📋</span>
            <span>Today</span>
          </Link>

          <Link
            href="/host/calendar"
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-xs"
          >
            <span className="text-sm">📅</span>
            <span>Calendar</span>
          </Link>

          <Link
            href="/host/listings"
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-xs"
          >
            <span className="text-sm">📑</span>
            <span>Listing</span>
          </Link>

          <Link
            href="/host/messages"
            className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-xs"
          >
            <span className="text-sm">💬</span>
            <span>Messages</span>
          </Link>
        </Container>
      </div>

      <Container as="main" className="py-6 space-y-6">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 space-y-4">
          <h1>Today's Overview</h1>
          <p className="text-xs text-zinc-500">Welcome back! Check your upcoming check-ins, check-outs, and pending guest requests.</p>
        </div>
      </Container>
    </div>
  );
}
