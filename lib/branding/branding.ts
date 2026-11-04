import { cache } from "react";
import type { GlobalSettingsPayload } from "@/lib/cms/content-types";
import { cmsSettingsService } from "@/services/cms-settings.service";
import { BRANDING_FALLBACKS, type PublicBrandingConfig } from "./config";

export { BRANDING_FALLBACKS, type PublicBrandingConfig } from "./config";

function configured(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/**
 * Resolve every public branding surface with one consistent inheritance chain:
 * section override → global logo → bundled fallback.
 */
export function resolvePublicBranding(settings: GlobalSettingsPayload): PublicBrandingConfig {
  // Older installations stored a retired homepage logo as the legacy default.
  // Treat it as unset so legacy data still receives the reliable bundled fallback.
  const legacyLogoUrl = configured(settings.logoUrl);
  const globalLogoUrl = configured(settings.globalLogoUrl)
    || (legacyLogoUrl === "/images/home/homyz-logo.png" ? null : legacyLogoUrl)
    || BRANDING_FALLBACKS.globalLogo;

  return {
    globalLogoUrl,
    guestHeaderLogoUrl: configured(settings.guestHeaderLogoUrl) || globalLogoUrl,
    hostHeaderLogoUrl: configured(settings.hostHeaderLogoUrl) || globalLogoUrl,
    adminLogoUrl: configured(settings.adminLogoUrl) || globalLogoUrl,
    mobileLogoUrl: configured(settings.mobileLogoUrl) || globalLogoUrl || BRANDING_FALLBACKS.mobileLogo,
    faviconUrl: configured(settings.faviconUrl) || BRANDING_FALLBACKS.favicon,
    homepageHeroDesktopUrl: configured(settings.homepageHeroDesktopUrl) || BRANDING_FALLBACKS.homepageHeroDesktop,
    homepageHeroDesktopPosition: configured(settings.homepageHeroDesktopPosition) || "center",
    homepageHeroMobileUrl: configured(settings.homepageHeroMobileUrl) || BRANDING_FALLBACKS.homepageHeroMobile,
    homepageHeroMobilePosition: configured(settings.homepageHeroMobilePosition) || "center 12%",
  };
}

/** One server read shared by the root layout and route-level consumers. */
export const getPublicBranding = cache(async (): Promise<PublicBrandingConfig> => {
  const settings = await cmsSettingsService.getGlobalSettings();
  return resolvePublicBranding(settings);
});
