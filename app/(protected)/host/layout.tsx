import type { ReactNode } from "react";
import { HostLayoutShell } from "@/components/host/host-header";

export default function HostLayout({ children }: { children: ReactNode }) {
  return <HostLayoutShell>{children}</HostLayoutShell>;
}