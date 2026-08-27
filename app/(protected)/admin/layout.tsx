import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole([Role.ADMIN]);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#F9F9F8] text-zinc-900 font-sans">
      <AdminNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
