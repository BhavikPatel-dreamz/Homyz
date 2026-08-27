import type { ReactNode } from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { AdminSubNav } from "@/components/admin/admin-sub-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole([Role.ADMIN]);

  return (
    <div className="flex flex-1 flex-col font-sans text-zinc-900">
      <AdminSubNav />
      {children}
    </div>
  );
}
