"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { Toaster } from "@/components/ui/toaster";
import { WishlistProvider } from "@/components/wishlist/WishlistProvider";
import { CurrencyProvider } from "@/lib/currency-context";
import { ProfileCompletionModal } from "@/components/auth/profile-completion-modal";

export function Providers({ children, session }: { children: ReactNode; session: Session | null }) {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        <LanguageProvider>
          <SessionProvider
            session={session}
            refetchInterval={0}
            refetchOnWindowFocus={false}
            refetchWhenOffline={false}
          >
            <WishlistProvider>
              {children}
              <ProfileCompletionModal />
              <Toaster />
            </WishlistProvider>
          </SessionProvider>
        </LanguageProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}
