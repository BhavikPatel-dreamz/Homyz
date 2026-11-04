/** Client-safe branding defaults and the public configuration contract. */
export const BRANDING_FALLBACKS = {
  globalLogo: "/images/brand/homyz-logo-dark-v1.svg",
  mobileLogo: "/images/brand/homyz-mobile-logo-dark-v1.svg",
  favicon: "/favicon.ico",
  homepageHeroDesktop: "/images/home/hero-banner.png",
  homepageHeroMobile: "/images/home/hero.png",
} as const;

export type PublicBrandingConfig = {
  globalLogoUrl: string;
  guestHeaderLogoUrl: string;
  hostHeaderLogoUrl: string;
  adminLogoUrl: string;
  mobileLogoUrl: string;
  faviconUrl: string;
  homepageHeroDesktopUrl: string;
  homepageHeroDesktopPosition: string;
  homepageHeroMobileUrl: string;
  homepageHeroMobilePosition: string;
};
