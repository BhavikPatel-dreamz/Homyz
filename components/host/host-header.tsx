"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/dashboard/app-header";
import { HostSubNav } from "./host-sub-nav";
export {
  HostNavigationDrawer,
  DrawerHeader,
  DrawerProfile,
  DrawerNavigation,
  DrawerFooter,
  HostResourcesCard,
  type HostNavigationDrawerProps,
} from "./navigation/host-navigation-drawer";

const HostHeaderManagedContext = createContext(false);

export function HostLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMessagesWorkspace = pathname === "/host/messages" || pathname?.startsWith("/host/messages/");
  const isListingCreationFlow = pathname === "/host/listings/new";

  // The listing wizard owns its focused onboarding header and footer. Keeping
  // the host navigation around it creates a duplicate header and leaves the
  // mobile sub-navigation over the wizard controls.
  if (isListingCreationFlow) {
    return (
      <HostHeaderManagedContext.Provider value>
        {children}
      </HostHeaderManagedContext.Provider>
    );
  }

  return (
    <HostHeaderManagedContext.Provider value>
      <AppHeader />
      <div className={isMessagesWorkspace ? "" : "pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0"}>
        {children}
      </div>
      <HostSubNav showDesktopNav={false} />
    </HostHeaderManagedContext.Provider>
  );
}

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
  const isManagedByLayout = useContext(HostHeaderManagedContext);
  if (isManagedByLayout) return null;

  return <AppHeader user={user} showBottomBorder={showBottomBorder} />;
}
