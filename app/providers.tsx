"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

// Client wrapper so RSC pages stay server-only while client components can use
// useSession(). Wired once in the root layout.
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
