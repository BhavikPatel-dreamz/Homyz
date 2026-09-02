"use client";

import { AppHeader } from "@/components/dashboard/app-header";

export interface HostHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function HostHeader(_props?: HostHeaderProps) {
  return <AppHeader />;
}
