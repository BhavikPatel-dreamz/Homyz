import Link from "next/link";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { HostHeader } from "@/components/host/host-header";
import { HostSubNav } from "@/components/host/host-sub-nav";
import { Footer } from "@/components/dashboard/footer";

export default async function HostTodayPage() {
  await requirePageRole([Role.HOST, Role.ADMIN]);

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B] selection:text-[#1F1F1F]">
      {/* TOP HEADER */}
      <HostHeader />

      {/* TOP NAV TABS */}
      <HostSubNav activeTab="today" />

      <main className="max-w-6xl mx-auto w-full p-6 space-y-6 flex-1">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 space-y-4">
          <h1>Today's Overview</h1>
          <p className="text-xs text-zinc-500">Welcome back! Check your upcoming check-ins, check-outs, and pending guest requests.</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
