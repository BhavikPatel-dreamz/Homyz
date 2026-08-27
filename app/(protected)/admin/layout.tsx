import type { ReactNode } from "react";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { Role } from "@/generated/prisma/enums";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole([Role.ADMIN]);

  return <AdminShell>{children}</AdminShell>;
}
