"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { HeroSection } from "./hero-section";
import { HomePropertySection } from "./category-carousel";
import { Footer } from "@/components/dashboard/footer";
import type { HomepageSection } from "@/services/homepage.service";
import { Container } from "../ui";

export interface HomeViewProps {
  sections?: HomepageSection[];
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

export function HomeView({ sections = [], canFavorite = false }: HomeViewProps) {
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
    if (params.destination && !staticValues.has(params.destination)) {
      sp.set("destination", params.destination.trim());
      sp.set("city", (params.city || params.destination).trim());
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

    if (params.guestDetails) {
      const totalGuests = (params.guestDetails.adults || 0) + (params.guestDetails.children || 0);
      if (totalGuests > 0) sp.set("guests", String(totalGuests));
      if (params.guestDetails.adults > 0) sp.set("adults", String(params.guestDetails.adults));
      if (params.guestDetails.children > 0) sp.set("children", String(params.guestDetails.children));
      if (params.guestDetails.infants > 0) sp.set("infants", String(params.guestDetails.infants));
      if (params.guestDetails.pets > 0) sp.set("pets", String(params.guestDetails.pets));
    } else if (params.guests) {
      // Parse "2 guests" → "2"
      const n = parseInt(params.guests, 10);
      if (n > 0) sp.set("guests", String(n));
    }

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
