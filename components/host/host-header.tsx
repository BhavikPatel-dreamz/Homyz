"use client";

import { AppHeader } from "@/components/dashboard/app-header";

export interface HostHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  } | null;
  showBottomBorder?: boolean;
}

export function HostHeader({ user, showBottomBorder }: HostHeaderProps = {}) {
  return <AppHeader user={user} showBottomBorder={showBottomBorder} />;
}
