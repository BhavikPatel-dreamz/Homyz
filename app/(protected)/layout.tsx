import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/permissions/page-guards";
import { ProtectedShell } from "./protected-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageUser();

  return <ProtectedShell>{children}</ProtectedShell>;
}
