import React from "react";
import { HostHeader } from "@/components/host/host-header";
import { Container } from "@/components/ui/container";
import { HostSettingsNavigation } from "./host-settings-navigation";

export interface HostAccountSettingsLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  className?: string;
}

export function HostAccountSettingsLayout({
  children,
  showSidebar = false,
  className = "",
}: HostAccountSettingsLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white pb-16 font-sans text-[#1F1F1F] selection:bg-[#FCDF9C] sm:pb-20">
      <HostHeader />
      <main className="w-full min-w-0 flex-1">
        <Container className="max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
          {showSidebar ? (
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-4 lg:gap-8">
              {/* Left Navigation (Desktop Sidebar + Mobile Pill Navigation) */}
              <div className="lg:col-span-1">
                <HostSettingsNavigation className="sticky top-24" />
              </div>

              {/* Main Content Pane */}
              <div className={`min-w-0 lg:col-span-3 ${className}`}>
                {children}
              </div>
            </div>
          ) : (
            <div className={`min-w-0 ${className}`}>{children}</div>
          )}
        </Container>
      </main>
    </div>
  );
}

