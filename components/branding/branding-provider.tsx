"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  BRANDING_FALLBACKS,
  type PublicBrandingConfig,
} from "@/lib/branding/config";

const fallbackBranding: PublicBrandingConfig = {
  globalLogoUrl: BRANDING_FALLBACKS.globalLogo,
  guestHeaderLogoUrl: BRANDING_FALLBACKS.globalLogo,
  hostHeaderLogoUrl: BRANDING_FALLBACKS.globalLogo,
  adminLogoUrl: BRANDING_FALLBACKS.globalLogo,
  mobileLogoUrl: BRANDING_FALLBACKS.mobileLogo,
  faviconUrl: BRANDING_FALLBACKS.favicon,
  homepageHeroDesktopUrl: BRANDING_FALLBACKS.homepageHeroDesktop,
  homepageHeroDesktopPosition: "center",
  homepageHeroMobileUrl: BRANDING_FALLBACKS.homepageHeroMobile,
  homepageHeroMobilePosition: "center 12%",
};

const BrandingContext = createContext<PublicBrandingConfig | undefined>(undefined);

export function BrandingProvider({
  branding,
  children,
}: {
  branding?: PublicBrandingConfig | null;
  children: ReactNode;
}) {
  // Keep every consuming header usable during a streamed render, an HMR
  // transition, or an unavailable settings read.
  const resolvedBranding = branding ? { ...fallbackBranding, ...branding } : fallbackBranding;
  return <BrandingContext.Provider value={resolvedBranding}>{children}</BrandingContext.Provider>;
}

export function useBranding(): PublicBrandingConfig {
  return useContext(BrandingContext) ?? fallbackBranding;
}
