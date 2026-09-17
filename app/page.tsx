import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { HomeView } from "@/components/home/home-view";
import { homepageService, type HomepageSection } from "@/services/homepage.service";
import { getSessionUser } from "@/lib/auth/session";
import { resolveSearchContext, type SearchContext } from "@/lib/location/search-context";
import { parseServerLastSearch, LAST_SEARCH_COOKIE } from "@/lib/storage/client-history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Homyz - Book cozy stays that feel like home",
  description:
    "Explore hand-picked apartments, lofts, villas, and cozy homes across Riyadh, Jeddah, and top destinations worldwide.",
  openGraph: {
    title: "Homyz - Book cozy stays that feel like home",
    description:
      "Book cozy stays that feel like home. Explore top destinations and hand-picked properties.",
    siteName: "Homyz",
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    destination?: string;
    city?: string;
    placeName?: string;
    placeId?: string;
    locationType?: string;
    fullAddress?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    adults?: string;
    children?: string;
    infants?: string;
    pets?: string;
    ip?: string;
    country?: string;
    clear?: string;
  }>;
}) {
  let sections: HomepageSection[] = [];
  let trendingLocations: Awaited<ReturnType<typeof homepageService.getHomepageData>>["trendingLocations"] = [];
  let mode: "DEFAULT" | "SEARCH" = "DEFAULT";
  let resolvedContext: SearchContext | null = null;
  const user = await getSessionUser();

  try {
    const params = await searchParams;
    const headerStore = await headers();
    const forwardedFor = headerStore.get("x-forwarded-for");
    const realIp = headerStore.get("x-real-ip");
    const requestIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || null;

    const isExplicitClear = params.clear === "true" || params.clear === "1";
    const hasExplicitUrlSearch = Boolean(
      params.destination ||
        params.city ||
        params.placeName ||
        (params.lat && params.lng) ||
        params.checkIn ||
        params.checkOut,
    );

    if (!isExplicitClear) {
      if (hasExplicitUrlSearch) {
        resolvedContext = await resolveSearchContext({
          destination: params.destination,
          city: params.city,
          placeName: params.placeName,
          placeId: params.placeId,
          locationType: params.locationType,
          fullAddress: params.fullAddress,
          lat: params.lat,
          lng: params.lng,
          radius: params.radius,
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          guests: params.guests,
          adults: params.adults,
          children: params.children,
          infants: params.infants,
          pets: params.pets,
        });
      } else {
        // Read persisted last search context from cookie for SSR zero-flicker restoration
        const cookieStore = await cookies();
        const cookieValue = cookieStore.get(LAST_SEARCH_COOKIE)?.value;
        const persisted = parseServerLastSearch(cookieValue);
        if (persisted) {
          resolvedContext = persisted;
        }
      }
    }

    const parsedLat = params.lat
      ? Number(params.lat)
      : resolvedContext?.latitude ?? null;
    const parsedLng = params.lng
      ? Number(params.lng)
      : resolvedContext?.longitude ?? null;

    const homepage = await homepageService.getHomepageData({
      city: params.city || params.destination || params.placeName || resolvedContext?.city || undefined,
      userId: user?.id,
      searchContext: resolvedContext,
      requestContext: {
        city: params.city || params.destination || resolvedContext?.city || null,
        destination: params.destination || params.city || resolvedContext?.displayName || null,
        placeName: params.placeName || resolvedContext?.displayName || null,
        lat: Number.isFinite(parsedLat) ? parsedLat : null,
        lng: Number.isFinite(parsedLng) ? parsedLng : null,
        ip: requestIp || params.ip || null,
        country: params.country || resolvedContext?.country || null,
      },
    });

    sections = homepage.sections;
    trendingLocations = homepage.trendingLocations;
    mode = homepage.mode;
  } catch (error) {
    console.error("Failed to load homepage discovery data:", error);
  }

  return (
    <HomeView
      sections={sections}
      trendingLocations={trendingLocations}
      canFavorite={Boolean(user)}
      mode={mode}
      searchContext={resolvedContext}
    />
  );
}
