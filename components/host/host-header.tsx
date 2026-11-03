"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
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
  return (
    <HostHeaderManagedContext.Provider value>
      <AppHeader />
      {children}
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
