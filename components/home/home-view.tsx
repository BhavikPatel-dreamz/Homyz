"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/dashboard/app-header";
import { HeroSection } from "./hero-section";
import { CategoryCarousel } from "./category-carousel";
import { Footer } from "@/components/dashboard/footer";
import { PropertyCardData } from "./property-card";
import { Container } from "../ui";

export interface HomeViewProps {
  initialListings?: Array<{
    id: string;
    title: string;
    city?: string | null;
    country?: string | null;
    price: number;
    photos?: string[];
    guests?: number;
    propertyType?: string | null;
    isFeatured?: boolean;
  }>;
}

export function HomeView({ initialListings = [] }: HomeViewProps) {
  const router = useRouter();

  const handleSearch = (params: {
    destination: string;
    checkIn: string;
    checkOut: string;
    guests: string;
    guestDetails?: { adults: number; children: number; infants: number; pets: number };
  }) => {
    const sp = new URLSearchParams();
    if (params.destination && params.destination !== "Recent searches") {
      sp.set("city", params.destination);
    }
    if (params.checkIn) sp.set("checkIn", params.checkIn);
    if (params.checkOut) sp.set("checkOut", params.checkOut);
    if (params.guestDetails) {
      const totalGuests = (params.guestDetails.adults || 0) + (params.guestDetails.children || 0);
      if (totalGuests > 0) sp.set("guests", String(totalGuests));
    }
    router.push(`/listings?${sp.toString()}`);
  };

  const cards: PropertyCardData[] = useMemo(() => {
    return initialListings.map((l) => ({
      id: l.id,
      name: l.title || "Untitled stay",
      subtitle: l.city ? `${l.city}${l.country ? `, ${l.country}` : ""}` : l.country || "Saudi Arabia",
      price: l.price,
      rating: null, // genuine ratings only
      badge: l.isFeatured ? ("featured" as const) : null,
      imageUrl: Array.isArray(l.photos) && l.photos.length > 0 ? l.photos[0] : null,
      city: l.city,
      country: l.country,
      guests: l.guests,
      propertyType: l.propertyType,
    }));
  }, [initialListings]);

  // Group listings logically
  const featuredCards = useMemo(() => cards.filter((c) => c.badge === "featured"), [cards]);
  const riyadhCards = useMemo(() => cards.filter((c) => /riyadh/i.test(c.city || "")), [cards]);
  const jeddahCards = useMemo(() => cards.filter((c) => /jeddah/i.test(c.city || "")), [cards]);
  const otherCards = useMemo(() => {
    const usedIds = new Set([...riyadhCards, ...jeddahCards].map((c) => c.id));
    return cards.filter((c) => !usedIds.has(c.id));
  }, [cards, riyadhCards, jeddahCards]);

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
            {cards.length === 0 ? (
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
                {featuredCards.length > 0 && (
                  <CategoryCarousel title="Featured stays on Homyz" cards={featuredCards} />
                )}

                {riyadhCards.length > 0 && (
                  <CategoryCarousel title="Popular stays in Riyadh" cards={riyadhCards} />
                )}

                {jeddahCards.length > 0 && (
                  <CategoryCarousel title="Coastal homes in Jeddah" cards={jeddahCards} />
                )}

                {otherCards.length > 0 && (
                  <CategoryCarousel
                    title={riyadhCards.length > 0 || jeddahCards.length > 0 ? "More homes to explore" : "Popular homes"}
                    cards={otherCards}
                  />
                )}
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
