"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { Toaster } from "@/components/ui/toaster";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SessionProvider>
          <WishlistProvider>
            {children}
            <Toaster />
          </WishlistProvider>
        </SessionProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
