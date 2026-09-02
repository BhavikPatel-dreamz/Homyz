import Link from "next/link";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";

export default async function HostCalendarPage() {
  await requirePageRole([Role.USER, Role.HOST, Role.ADMIN]);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans flex flex-col selection:bg-[#FEE08B] selection:text-zinc-900">
      {/* TOP HEADER */}
      <HostHeader />

      {/* TOP NAV TABS */}
      <HostSubNav activeTab="calendar" />

      <main className="max-w-6xl mx-auto w-full p-6 space-y-6 flex-1">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 space-y-4">
          <h1>Host Calendar</h1>
          <p className="text-xs text-zinc-500">Manage property availability, block dates, and adjust night rates across your listings.</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
