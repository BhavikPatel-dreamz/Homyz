"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui/container";

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isHostRoute = pathname.startsWith("/host");

  // Admin and Host routes manage their own headers/layouts
  if (isAdminRoute || isHostRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors">
      <AppHeader />
      <Container as="main" className="flex-1 py-8">{children}</Container>
      <Footer />
    </div>
  );
}
