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
import { HeaderSearchProvider } from "@/components/header/header-search-context";
import { BrandingProvider } from "@/components/branding/branding-provider";
import type { PublicBrandingConfig } from "@/lib/branding/config";

export function Providers({
  children,
  session,
  branding,
}: {
  children: ReactNode;
  session: Session | null;
  branding: PublicBrandingConfig;
}) {
  return (
    <BrandingProvider branding={branding}>
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
                <HeaderSearchProvider>
                  {children}
                  <ProfileCompletionModal />
                  <Toaster />
                </HeaderSearchProvider>
              </WishlistProvider>
            </SessionProvider>
          </LanguageProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </BrandingProvider>
  );
}
