import React, { Suspense } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { listingService } from "@/services/listing.service";
import type { SortBy } from "@/services/listing.service";
import { ListingsResultsClient } from "./listings-results-client";
import { ListingCard } from "@/components/listings/listing-card";
import { getSessionUser } from "@/lib/auth/session";
import { favoriteService } from "@/services/favorite.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stays & Vacation Rentals — Homyz",
  description:
    "Browse verified homes, villas, apartments, and vacation rentals on Homyz.",
};

interface SearchPageProps {
  searchParams: Promise<{
    city?: string;
    destination?: string;
    placeName?: string;
    fullAddress?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    placeId?: string;
    locationType?: string;
    checkIn?: string;
    startDate?: string;
    checkOut?: string;
    endDate?: string;
    guests?: string;
    propertyType?: string;
    minPrice?: string;
    maxPrice?: string;
    amenities?: string;
    bedrooms?: string;
    bathrooms?: string;
    beds?: string;
    instantBook?: string;
    sortBy?: string;
    page?: string;
    neLat?: string;
    neLng?: string;
    swLat?: string;
    swLng?: string;
  }>;
}

export default async function ListingsSearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;

  // Parse URL params
  const city = sp.city || sp.destination || undefined;
  const placeName = sp.placeName || sp.destination || sp.city || undefined;
  const lat = sp.lat ? parseFloat(sp.lat) : undefined;
  const lng = sp.lng ? parseFloat(sp.lng) : undefined;
  const radiusKm = sp.radius ? parseFloat(sp.radius) : undefined;
  const placeId = sp.placeId || undefined;
  const locationType = sp.locationType || undefined;
  const checkIn = sp.checkIn || sp.startDate || undefined;
  const checkOut = sp.checkOut || sp.endDate || undefined;
  const guests = sp.guests ? parseInt(sp.guests, 10) : undefined;
  const propertyType = sp.propertyType || undefined;
  const minPrice = sp.minPrice ? parseInt(sp.minPrice, 10) : undefined;
  const maxPrice = sp.maxPrice ? parseInt(sp.maxPrice, 10) : undefined;
  const amenities = sp.amenities ? sp.amenities.split(",").filter(Boolean) : undefined;
  const bedrooms = sp.bedrooms ? parseInt(sp.bedrooms, 10) : undefined;
  const bathrooms = sp.bathrooms ? parseInt(sp.bathrooms, 10) : undefined;
  const beds = sp.beds ? parseInt(sp.beds, 10) : undefined;
  const instantBook = sp.instantBook === "true" ? true : undefined;
  const sortBy = (sp.sortBy as SortBy) || undefined;
  const page = sp.page ? parseInt(sp.page, 10) : 1;

  // Map bounds (for map-based search)
  const mapBounds =
    sp.neLat && sp.neLng && sp.swLat && sp.swLng
      ? {
          neLat: parseFloat(sp.neLat),
          neLng: parseFloat(sp.neLng),
          swLat: parseFloat(sp.swLat),
          swLng: parseFloat(sp.swLng),
        }
      : undefined;

  const LIMIT = 20;

  let result = { items: [] as Awaited<ReturnType<typeof listingService.searchPublicListings>>["items"], total: 0, page: 1, totalPages: 1, priceRange: undefined as { min: number; max: number } | undefined };
  try {
    const res = await listingService.searchPublicListings({
      lat: typeof lat === "number" && !isNaN(lat) ? lat : undefined,
      lng: typeof lng === "number" && !isNaN(lng) ? lng : undefined,
      radiusKm: typeof radiusKm === "number" && !isNaN(radiusKm) ? radiusKm : undefined,
      placeId,
      locationType,
      city,
      checkIn,
      checkOut,
      guests,
      propertyType,
      minPrice,
      maxPrice,
      amenities,
      bedrooms,
      bathrooms,
      beds,
      instantBook,
      sortBy,
      mapBounds,
      page,
      limit: LIMIT,
    });
    result = {
      items: res.items,
      total: res.total,
      page: res.page ?? page,
      totalPages: res.totalPages ?? 1,
      priceRange: res.priceRange,
    };
  } catch (err) {
    console.error("Search query failed:", err);
  }

  // Load favorites for logged-in users (only for the items on this page)
  let favoriteIds = new Set<string>();
  try {
    const user = await getSessionUser();
    if (user?.id && result.items.length > 0) {
      favoriteIds = await favoriteService.getFavoriteListingIds(
        user.id,
        result.items.map((i) => i.id),
      );
    }
  } catch {
    // favorites are non-critical
  }

  const currentFilters = {
    city,
    placeName,
    lat,
    lng,
    radiusKm,
    placeId,
    locationType,
    checkIn,
    checkOut,
    guests,
    propertyType,
    minPrice,
    maxPrice,
    amenities,
    bedrooms,
    bathrooms,
    beds,
    instantBook,
    sortBy,
  };

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 py-8">
        <Container>
          {/* Page Header */}
          <div className="pb-6 border-b border-zinc-200/80 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              {placeName ? `Stays in ${placeName}` : city ? `Stays in ${city}` : "All available stays"}
            </h1>
            <p className="text-xs text-zinc-500 font-normal mt-1">
              {result.total} {result.total === 1 ? "stay" : "stays"} available
              {checkIn && checkOut ? ` · ${checkIn} to ${checkOut}` : ""}
              {guests ? ` · ${guests} ${guests === 1 ? "guest" : "guests"}` : ""}
            </p>
          </div>

          {/* Interactive client section (<ListingCard /> rendered in grid) */}
          <Suspense
            fallback={
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-[22px] border border-zinc-100 overflow-hidden animate-pulse">
                    <div className="aspect-[4/3] bg-zinc-200 w-full" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3.5 bg-zinc-200 rounded w-3/4" />
                      <div className="h-3 bg-zinc-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <ListingsResultsClient
              listings={result.items}
              total={result.total}
              page={result.page}
              totalPages={result.totalPages}
              priceRange={result.priceRange}
              currentFilters={currentFilters}
              favoriteIds={favoriteIds}
            />
          </Suspense>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
