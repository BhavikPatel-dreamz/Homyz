"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { HeroSection } from "./hero-section";
import { HomePropertySection } from "./category-carousel";
import { Footer } from "@/components/dashboard/footer";
import type { HomepageSection, TrendingLocation } from "@/services/homepage.service";
import { Container } from "../ui";

export interface HomeViewProps {
  sections?: HomepageSection[];
  trendingLocations?: TrendingLocation[];
  canFavorite?: boolean;
  /** @deprecated Homepage data is now grouped into server-provided sections. */
  initialListings?: Array<{
    id: string;
    title: string;
    city?: string | null;
    country?: string | null;
    price: number;
  }>;
}

export function HomeView({ sections = [], trendingLocations = [], canFavorite = false }: HomeViewProps) {
  const router = useRouter();

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

    router.push(`/listings?${sp.toString()}`);
  };

  const propertySections = useMemo(() => sections.map((section) => ({
    ...section,
    cards: section.properties.map((property) => ({
      id: property.id,
      name: property.title,
      subtitle: property.area || property.city || property.country || undefined,
      price: property.price,
      badge: property.featured ? ("featured" as const) : null,
      imageUrl: property.mainImage,
      city: property.city,
      country: property.country,
      guests: property.maxGuests,
      propertyType: property.propertyType,
      rating: null,
      initialFavorite: property.favoriteStatus,
      canFavorite,
    })),
  })), [sections]);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      {/* App Header */}
      <AppHeader />

      {/* Main Content */}
      <main className="homepage-main sm:mt-8 w-full flex-1 pb-16 sm:pb-[150px]">
        <Container>
          {/* Hero Section */}
          <HeroSection onSearch={handleSearch} />

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

          {/* Listing Sections Container */}
          <div className="mt-8 sm:mt-[92px] space-y-10 sm:space-y-[78px]">
            {propertySections.length === 0 ? (
              <div className="py-16 text-center space-y-4 max-w-lg mx-auto bg-zinc-50/80 rounded-3xl border border-zinc-200 p-8">
                <div className="w-14 h-14 bg-amber-100/70 rounded-full flex items-center justify-center mx-auto text-2xl">
                  🏡
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-zinc-900">
                    Discover hand-picked stays on Homyz
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-normal">
                    Search destinations, check-in dates, and guest capacity above to browse available vacation rentals and accommodations.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <Link
                    href="/listings"
                    className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all"
                  >
                    Browse all stays
                  </Link>
                  <Link
                    href="/become-a-host"
                    className="rounded-full bg-amber-200 hover:bg-amber-300 text-amber-950 font-semibold text-xs px-6 py-2.5 transition-all"
                  >
                    Become a host
                  </Link>
                </div>
              </div>
            ) : (
              <>
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
        </Container>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
