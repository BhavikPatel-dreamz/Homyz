"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { HeroSection } from "./hero-section";
import { HomePropertySection } from "./category-carousel";
import { Footer } from "@/components/dashboard/footer";
import type { HomepageSection, TrendingLocation } from "@/services/homepage.service";
import type { SearchContext } from "@/lib/location/search-context";
import {
  getRecentlyViewedProperties,
  type ViewedPropertyItem,
  saveRecentSearchContext,
  getRecentSearchContexts,
  saveLastSearch,
  getLastSearch,
  clearLastSearch,
  shouldShowContinueSearching,
  type PersistedSearchContext,
  type StoredSearchContext,
} from "@/lib/storage/client-history";
import { HomepageLoadingState } from "./home-section-skeleton";
import { Container } from "../ui";
import { ContinueSearchingBar } from "./continue-searching-bar";

export interface HomeViewProps {
  sections?: HomepageSection[];
  recentSearchSections?: HomepageSection[];
  trendingLocations?: TrendingLocation[];
  canFavorite?: boolean;
  mode?: "DEFAULT" | "SEARCH";
  searchContext?: SearchContext | null;
  /** @deprecated Homepage data is now grouped into server-provided sections. */
  initialListings?: Array<{
    id: string;
    title: string;
    city?: string | null;
    country?: string | null;
    price: number;
  }>;
}

export function HomeView({
  sections = [],
  recentSearchSections = [],
  trendingLocations = [],
  canFavorite = false,
  mode = "DEFAULT",
  searchContext = null,
}: HomeViewProps) {
  const router = useRouter();
  const [isNavigatingSearch, setIsNavigatingSearch] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<ViewedPropertyItem[]>([]);
  const [activeContext, setActiveContext] = useState<SearchContext | PersistedSearchContext | null>(searchContext);
  const [showContinueSearchingBar, setShowContinueSearchingBar] = useState(false);
  const [pastSearchSections, setPastSearchSections] = useState<HomepageSection[]>(recentSearchSections);

  // Load client-persisted search contexts & recently viewed properties on mount
  useEffect(() => {
    setRecentlyViewed(getRecentlyViewedProperties());
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("clear") === "true") {
        clearLastSearch();
        setActiveContext(null);
        setShowContinueSearchingBar(false);
      } else {
        const last = getLastSearch();
        if (last) {
          setActiveContext(last);
          setShowContinueSearchingBar(shouldShowContinueSearching(last));
        } else if (searchContext) {
          setActiveContext(searchContext);
          setShowContinueSearchingBar(shouldShowContinueSearching(searchContext));
        } else {
          setShowContinueSearchingBar(false);
        }
      }

        // Check recent searches from client storage to load extra rows if needed
        const pastSearches = getRecentSearchContexts();
        if (pastSearches.length > 0 && pastSearchSections.length === 0) {
          const activeCity = (searchContext?.city || searchContext?.displayName || "").toLowerCase();
          const candidateSearches = pastSearches.filter((s) => {
            const name = (s.city || s.displayName || s.query || "").toLowerCase();
            if (!name) return false;
            if (mode === "SEARCH" && activeCity && name === activeCity) return false;
            return true;
          }).slice(0, 4);

          if (candidateSearches.length > 0) {
            void fetch("/api/v1/homepage/recent-searches", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                searches: candidateSearches,
                currentCity: mode === "SEARCH" ? (searchContext?.city || undefined) : undefined,
                limit: 4,
              }),
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.data?.sections?.length) {
                  setPastSearchSections(data.data.sections);
                }
              })
              .catch(() => undefined);
          }
        }
      }
  }, [searchContext]);

  // Sync activeContext with incoming searchContext from SSR or navigation
  useEffect(() => {
    if (searchContext) {
      setActiveContext(searchContext);
    }
  }, [searchContext]);

  // Sync pastSearchSections when SSR prop updates
  useEffect(() => {
    if (recentSearchSections.length > 0) {
      setPastSearchSections(recentSearchSections);
    }
  }, [recentSearchSections]);

  // Reset search navigation state when sections or searchContext updates, or on initial mount/back
  useEffect(() => {
    setIsNavigatingSearch(false);
  }, [sections, searchContext]);

  useEffect(() => {
    setIsNavigatingSearch(false);
  }, []);

  const handleSearch = (params: {
    destination: string;
    checkIn: string;
    checkOut: string;
    guests: string;
    guestDetails?: { adults: number; children: number; infants: number; pets: number };
    lat?: number;
    lng?: number;
    radiusKm?: number;
    placeId?: string;
    locationType?: string;
    placeName?: string;
    fullAddress?: string;
    city?: string;
    country?: string;
  }) => {
    const sp = new URLSearchParams();

    // Ignore placeholder values from the old static suggestions
    const staticValues = new Set(["Recent searches", "Nearby", "Suggested destinations"]);
    const resolvedDestination = (params.destination || params.city || params.placeName || "").trim();
    if (resolvedDestination && !staticValues.has(resolvedDestination)) {
      sp.set("destination", resolvedDestination);
      sp.set("city", (params.city || resolvedDestination).trim());
    } else if (params.city && !staticValues.has(params.city)) {
      sp.set("city", params.city.trim());
    }
    if (params.placeName) sp.set("placeName", params.placeName);
    if (params.fullAddress) sp.set("fullAddress", params.fullAddress);
    if (typeof params.lat === "number" && !isNaN(params.lat)) sp.set("lat", String(params.lat));
    if (typeof params.lng === "number" && !isNaN(params.lng)) sp.set("lng", String(params.lng));
    if (typeof params.radiusKm === "number" && !isNaN(params.radiusKm)) sp.set("radius", String(params.radiusKm));
    if (params.placeId) sp.set("placeId", params.placeId);
    if (params.locationType) sp.set("locationType", params.locationType);

    if (params.checkIn) sp.set("checkIn", params.checkIn);
    if (params.checkOut) sp.set("checkOut", params.checkOut);

    const normalizedGuestCount = Math.max(
      1,
      params.guestDetails
        ? (params.guestDetails.adults || 0) + (params.guestDetails.children || 0)
        : parseInt(params.guests || "0", 10) || 0,
    );

    if (params.guestDetails) {
      const adults = params.guestDetails.adults > 0 ? params.guestDetails.adults : normalizedGuestCount > 0 ? 1 : 0;
      const children = params.guestDetails.children > 0 ? params.guestDetails.children : 0;
      sp.set("guests", String(normalizedGuestCount));
      if (adults > 0) sp.set("adults", String(adults));
      if (children > 0) sp.set("children", String(children));
      if (params.guestDetails.infants > 0) sp.set("infants", String(params.guestDetails.infants));
      if (params.guestDetails.pets > 0) sp.set("pets", String(params.guestDetails.pets));
    } else if (params.guests) {
      const n = Math.max(1, parseInt(params.guests, 10) || 1);
      sp.set("guests", String(n));
    } else {
      sp.set("guests", "1");
    }

    // Persist normalized search context (both localStorage and 30-day cookie for SSR)
    const persistedContext: PersistedSearchContext = {
      query: resolvedDestination || params.city || "Stays",
      displayName: resolvedDestination || params.city || "Stays",
      placeId: params.placeId || null,
      placeType: (params.locationType as any) || "general",
      latitude: params.lat ?? null,
      longitude: params.lng ?? null,
      city: params.city || null,
      country: params.country || null,
      checkIn: params.checkIn || null,
      checkOut: params.checkOut || null,
      guests: normalizedGuestCount,
      adults: params.guestDetails?.adults ?? normalizedGuestCount,
      children: params.guestDetails?.children ?? 0,
      infants: params.guestDetails?.infants ?? 0,
      pets: params.guestDetails?.pets ?? 0,
      radiusKm: params.radiusKm ?? undefined,
      searchedAt: new Date().toISOString(),
    };
    saveLastSearch(persistedContext);
    saveRecentSearchContext(persistedContext);

    void fetch("/api/v1/search/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        destination: params.destination || params.city || params.placeName || null,
        destinationType: params.locationType || null,
        city: params.city || null,
        country: params.country || null,
        lat: typeof params.lat === "number" ? params.lat : null,
        lng: typeof params.lng === "number" ? params.lng : null,
        checkIn: params.checkIn || null,
        checkOut: params.checkOut || null,
        guestCount: normalizedGuestCount,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => undefined);

    // Search results are presented on the full Search/Listings results page
    // source=home-search flags that the user explicitly searched so the listing
    // page can show the search bar (vs. See All / View All navigation which should not).
    sp.set("source", "home-search");
    setIsNavigatingSearch(true);
    router.push(`/listings?${sp.toString()}`);
  };

  const handleClearSearch = () => {
    clearLastSearch();
    setActiveContext(null);
    setIsNavigatingSearch(true);
    router.push("/?clear=true", { scroll: false });
  };

  const continueSearchThumbnail = useMemo(() => {
    for (const section of sections) {
      if (section.properties?.length) {
        const p = section.properties[0];
        const img = p.image || p.mainImage || p.imageUrl;
        if (img) return img;
      }
    }
    if (trendingLocations.length > 0 && trendingLocations[0]?.imageUrl) {
      return trendingLocations[0].imageUrl;
    }
    return null;
  }, [sections, trendingLocations]);

  const propertySections = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      cards: section.properties.map((property) => ({
        id: property.id,
        slug: property.slug,
        name: property.name || property.title,
        image: property.image || property.mainImage,
        imageUrl: property.imageUrl || property.mainImage,
        subtitle: [property.area, property.city].filter(Boolean).join(", ") || property.country || undefined,
        pricePerNight: property.pricePerNight ?? property.price,
        price: property.price,
        currency: property.currency,
        badge: property.badge,
        isGuestFavorite: property.isGuestFavorite,
        isSuperhost: property.isSuperhost,
        city: property.city,
        country: property.country,
        guests: property.maxGuests,
        propertyType: property.propertyType,
        averageRating: property.averageRating ?? property.rating ?? null,
        rating: property.rating ?? null,
        reviewCount: property.reviewCount ?? null,
        alternativeDates: property.alternativeDates,
        isFavorite: property.isFavorite ?? property.favoriteStatus,
        initialFavorite: property.favoriteStatus,
        canFavorite,
      })),
    }));
  }, [sections, canFavorite]);

  const searchLocationSections = useMemo(() => {
    if (mode !== "SEARCH") return [];
    return propertySections.filter((s) => s.priority < 100).slice(0, 3);
  }, [propertySections, mode]);

  const otherSections = useMemo(() => {
    if (mode !== "SEARCH") return [];
    return propertySections.filter((s) => s.priority >= 100);
  }, [propertySections, mode]);

  const uniquePastSections = useMemo(() => {
    const existingTitles = new Set([
      ...searchLocationSections.map((s) => s.title.toLowerCase()),
      ...(mode === "DEFAULT" ? propertySections.map((s) => s.title.toLowerCase()) : []),
    ]);
    const activeCity = (
      activeContext?.city ||
      activeContext?.displayName ||
      searchContext?.city ||
      searchContext?.displayName ||
      ""
    )
      .trim()
      .toLowerCase();

    return pastSearchSections
      .filter((s) => {
        const normTitle = s.title.toLowerCase();
        if (existingTitles.has(normTitle)) return false;
        if (
          mode === "SEARCH" &&
          activeCity &&
          (normTitle.includes(activeCity) ||
            normTitle === `stays in ${activeCity}` ||
            normTitle === `stays near ${activeCity}`)
        ) {
          return false;
        }
        return true;
      })
      .slice(0, 4)
      .map((section) => ({
        ...section,
        cards: section.properties.map((property) => ({
          id: property.id,
          slug: property.slug,
          name: property.name || property.title,
          image: property.image || property.mainImage,
          imageUrl: property.imageUrl || property.mainImage,
          subtitle: [property.area, property.city].filter(Boolean).join(", ") || property.country || undefined,
          pricePerNight: property.pricePerNight ?? property.price,
          price: property.price,
          currency: property.currency,
          badge: property.badge,
          isGuestFavorite: property.isGuestFavorite,
          isSuperhost: property.isSuperhost,
          city: property.city,
          country: property.country,
          guests: property.maxGuests,
          propertyType: property.propertyType,
          averageRating: property.averageRating ?? property.rating ?? null,
          rating: property.rating ?? null,
          reviewCount: property.reviewCount ?? null,
          alternativeDates: property.alternativeDates,
          isFavorite: property.isFavorite ?? property.favoriteStatus,
          initialFavorite: property.favoriteStatus,
          canFavorite,
        })),
      }));
  }, [pastSearchSections, searchLocationSections, propertySections, mode, activeContext, searchContext, canFavorite]);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      {/* App Header */}
      <AppHeader />

      {/* Main Content */}
      <main className="homepage-main sm:mt-8 w-full flex-1 pb-16 sm:pb-[150px]">
        <Container>
          {/* Hero Section */}
          <HeroSection onSearch={handleSearch} isSearching={isNavigatingSearch} />

          {/* Continue Searching Bar - only show when user returns after closing session or closing tab */}
          {activeContext && showContinueSearchingBar && (
            <div className="mt-4 sm:mt-6 flex justify-center w-full">
              <ContinueSearchingBar
                context={activeContext}
                thumbnailUrl={continueSearchThumbnail}
              />
            </div>
          )}

       
          {/* Recently Viewed Client Section */}
          {recentlyViewed.length >= 2 && !propertySections.some((s) => s.id === "recently-viewed") && (
            <section className="mt-8 sm:mt-[92px]">
              <HomePropertySection
                title="Recently viewed"
                cards={recentlyViewed.map((item) => ({
                  id: item.id,
                  name: item.title,
                  image: item.mainImage,
                  imageUrl: item.mainImage,
                  subtitle: [item.area, item.city].filter(Boolean).join(", ") || item.country || undefined,
                  pricePerNight: item.price,
                  price: item.price,
                  city: item.city,
                  country: item.country,
                  guests: item.maxGuests,
                  propertyType: item.propertyType,
                  averageRating: item.rating ?? null,
                  rating: item.rating ?? null,
                  canFavorite,
                }))}
                seeAllHref="/listings"
              />
            </section>
          )}

          {/* Listing Sections Container */}
          <div className="mt-8 sm:mt-[92px] space-y-10 sm:space-y-[78px]">
            {propertySections.length === 0 ? (
              <div className="py-16 text-center space-y-4 max-w-lg mx-auto bg-zinc-50/80 rounded-3xl border border-zinc-200 p-8">
                <div className="w-14 h-14 bg-amber-100/70 rounded-full flex items-center justify-center mx-auto text-2xl">
                  🏡
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-zinc-900">
                    {mode === "SEARCH"
                      ? `No stays found matching your search in ${searchContext?.displayName ?? "this location"}`
                      : "Discover hand-picked stays on Homyz"}
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                    {mode === "SEARCH"
                      ? "Try expanding your date range, adjusting guest count, or exploring nearby destinations."
                      : "Search destinations, check-in dates, and guest capacity above to browse available vacation rentals and accommodations."}
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  {mode === "SEARCH" ? (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all cursor-pointer"
                    >
                      Clear search
                    </button>
                  ) : (
                    <Link
                      href="/listings"
                      className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all"
                    >
                      Browse all stays
                    </Link>
                  )}
                  <Link
                    href="/become-a-host"
                    className="rounded-full bg-amber-200 hover:bg-amber-300 text-amber-950 font-semibold text-xs px-6 py-2.5 transition-all"
                  >
                    Become a host
                  </Link>
                </div>
              </div>
            ) : mode === "SEARCH" ? (
              <>
                {/* 1. Latest searched location: 2-3 sections of that destination ONLY */}
                {searchLocationSections.map((section) => (
                  <HomePropertySection
                    key={section.id}
                    title={section.title}
                    cards={section.cards}
                    seeAllHref={section.seeAllHref}
                    previewImages={section.previewImages}
                    totalCount={section.totalCount}
                  />
                ))}

                {/* 2. Last-to-last search rows (1 row each for previous searches) */}
                {uniquePastSections.map((section) => (
                  <HomePropertySection
                    key={section.id}
                    title={section.title}
                    cards={section.cards}
                    seeAllHref={section.seeAllHref}
                    previewImages={section.previewImages}
                    totalCount={section.totalCount}
                  />
                ))}

                {/* 3. Others (Trending stays, etc.) */}
                {otherSections.map((section) => (
                  <HomePropertySection
                    key={section.id}
                    title={section.title}
                    cards={section.cards}
                    seeAllHref={section.seeAllHref}
                    previewImages={section.previewImages}
                    totalCount={section.totalCount}
                  />
                ))}
              </>
            ) : (
              <>
                {/* 1. Client activity rows (previous searches / suggestions based on user activity) always on top */}
                {uniquePastSections.map((section) => (
                  <HomePropertySection
                    key={section.id}
                    title={section.title}
                    cards={section.cards}
                    seeAllHref={section.seeAllHref}
                    previewImages={section.previewImages}
                    totalCount={section.totalCount}
                  />
                ))}

                {/* 2. Latest discovery rows (Popular homes, Villas, Top-rated, etc.) at the bottom of previous suggestion rows */}
                {propertySections.map((section) => (
                  <HomePropertySection
                    key={section.id}
                    title={section.title}
                    cards={section.cards}
                    seeAllHref={section.seeAllHref}
                    previewImages={section.previewImages}
                    totalCount={section.totalCount}
                  />
                ))}
              </>
            )}
          </div>

             {/* Trending Locations Destination Cards */}
          {trendingLocations.length > 0 && (
            <section className="mt-8 sm:mt-[92px]">
              <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
                <h2 className="text-[20px] sm:text-[22px] font-medium leading-7 sm:leading-8 tracking-[-.35px] text-[#1f1f1f]">
                  Trending destinations
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {trendingLocations.map((location) => (
                  <Link
                    key={location.id}
                    href={location.href}
                    className="group relative block overflow-hidden rounded-[22px] border border-zinc-200 bg-white transition-transform hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden">
                      <img
                        src={location.imageUrl}
                        alt={location.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/5" />
                      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                        <div className="text-base font-semibold leading-tight">{location.name}</div>
                        <div className="mt-1 text-[11px] text-white/80">{location.subtitle}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </Container>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
