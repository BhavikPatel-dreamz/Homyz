import type { ReactNode } from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageRole([Role.ADMIN]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F8] text-zinc-900 font-sans">
      <AdminNav />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
