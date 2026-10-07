import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { HomeView } from "@/components/home/home-view";
import { homepageService, type HomepageSection } from "@/services/homepage.service";
import { getSessionUser } from "@/lib/auth/session";
import { resolveSearchContext, type SearchContext } from "@/lib/location/search-context";
import {
  parseServerLastSearch,
  parseServerRecentSearches,
  LAST_SEARCH_COOKIE,
  RECENT_SEARCHES_COOKIE,
  SEARCH_SESSION_COOKIE,
} from "@/lib/storage/client-history";
import { getUserRecentSearches } from "@/services/search-analytics.service";

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

    // Only explicit search in URL parameters triggers SEARCH mode.
    // If the user visits the homepage root without explicit URL search params,
    // mode is DEFAULT, showcasing all rich, professional discovery rows.
    const hasSearch = Boolean(hasExplicitUrlSearch);
    const parsedLat = params.lat
      ? Number(params.lat)
      : resolvedContext?.latitude ?? null;
    const parsedLng = params.lng
      ? Number(params.lng)
      : resolvedContext?.longitude ?? null;

    // Concurrently fetch homepage discovery and recent search sections in parallel
    const resolveRecentSearches = async (): Promise<any[]> => {
      if (isExplicitClear) return [];
      if (user?.id) {
        const userRecent = await getUserRecentSearches(user.id);
        if (userRecent.length) return userRecent;
      }
      const cookieStore = await cookies();
      const recentCookie = cookieStore.get(RECENT_SEARCHES_COOKIE)?.value;
      return parseServerRecentSearches(recentCookie);
    };

    const recentSearchesPromise = resolveRecentSearches().then(async (searches) => {
      if (!searches.length) return [];
      return homepageService.getRecentSearchSections({
        searches,
        userId: user?.id,
        currentLocationQuery: hasSearch
          ? (resolvedContext?.city || resolvedContext?.displayName || undefined)
          : undefined,
        limit: 4,
      });
    });

    const homepagePromise = homepageService.getHomepageData({
      city: hasSearch
        ? (params.city || params.destination || params.placeName || resolvedContext?.city || undefined)
        : undefined,
      userId: user?.id,
      searchContext: hasSearch ? resolvedContext : null,
      requestContext: {
        city: hasSearch ? (params.city || params.destination || resolvedContext?.city || null) : null,
        destination: hasSearch ? (params.destination || params.city || resolvedContext?.displayName || null) : null,
        placeName: hasSearch ? (params.placeName || resolvedContext?.displayName || null) : null,
        lat: hasSearch && Number.isFinite(parsedLat) ? parsedLat : null,
        lng: hasSearch && Number.isFinite(parsedLng) ? parsedLng : null,
        ip: requestIp || params.ip || null,
        country: hasSearch ? (params.country || resolvedContext?.country || null) : null,
      },
    });

    const [homepage, recentSearchSections] = await Promise.all([
      homepagePromise,
      recentSearchesPromise,
    ]);

    sections = homepage.sections;
    trendingLocations = homepage.trendingLocations;
    mode = hasSearch ? "SEARCH" : "DEFAULT";

    return (
      <HomeView
        sections={sections}
        recentSearchSections={recentSearchSections}
        trendingLocations={trendingLocations}
        canFavorite={Boolean(user)}
        mode={mode}
        searchContext={resolvedContext}
      />
    );
  } catch (error) {
    console.error("Failed to load homepage discovery data:", error);
  }

  return (
    <HomeView
      sections={sections}
      recentSearchSections={[]}
      trendingLocations={trendingLocations}
      canFavorite={Boolean(user)}
      mode={mode}
      searchContext={resolvedContext}
    />
  );
}
