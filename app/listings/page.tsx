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
    adults?: string;
    children?: string;
    infants?: string;
    pets?: string;
    propertyType?: string;
    minPrice?: string;
    maxPrice?: string;
    amenities?: string;
    bedrooms?: string;
    bathrooms?: string;
    beds?: string;
    instantBook?: string;
    featured?: string;
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
  const destination = sp.destination || sp.city || undefined;
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
  const adults = sp.adults ? parseInt(sp.adults, 10) : undefined;
  const children = sp.children ? parseInt(sp.children, 10) : undefined;
  const infants = sp.infants ? parseInt(sp.infants, 10) : undefined;
  const pets = sp.pets ? parseInt(sp.pets, 10) : undefined;
  const propertyType = sp.propertyType || undefined;
  const minPrice = sp.minPrice ? parseInt(sp.minPrice, 10) : undefined;
  const maxPrice = sp.maxPrice ? parseInt(sp.maxPrice, 10) : undefined;
  const amenities = sp.amenities ? sp.amenities.split(",").filter(Boolean) : undefined;
  const bedrooms = sp.bedrooms ? parseInt(sp.bedrooms, 10) : undefined;
  const bathrooms = sp.bathrooms ? parseInt(sp.bathrooms, 10) : undefined;
  const beds = sp.beds ? parseInt(sp.beds, 10) : undefined;
  const instantBook = sp.instantBook === "true" ? true : undefined;
  const featured = sp.featured === "true" ? true : undefined;
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

  let result: Awaited<ReturnType<typeof listingService.searchPublicListings>> = {
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
    priceRange: undefined,
  };

  try {
    const res = await listingService.searchPublicListings({
      destination,
      lat: typeof lat === "number" && !isNaN(lat) ? lat : undefined,
      lng: typeof lng === "number" && !isNaN(lng) ? lng : undefined,
      radiusKm: typeof radiusKm === "number" && !isNaN(radiusKm) ? radiusKm : undefined,
      placeId,
      locationType,
      city,
      placeName,
      checkIn,
      checkOut,
      guests,
      adults,
      children,
      infants,
      pets,
      propertyType,
      minPrice,
      maxPrice,
      amenities,
      bedrooms,
      bathrooms,
      beds,
      instantBook,
      featured,
      sortBy,
      mapBounds,
      page,
      limit: LIMIT,
    });
    result = res;
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
    adults,
    children,
    infants,
    pets,
    propertyType,
    minPrice,
    maxPrice,
    amenities,
    bedrooms,
    bathrooms,
    beds,
    instantBook,
    featured,
    sortBy,
  };

  const displayLocation = result.locationContextName || placeName || city;
  const isNearLandmark =
    locationType === "landmark" ||
    locationType === "station" ||
    locationType === "airport" ||
    locationType === "beach" ||
    locationType === "mall" ||
    locationType === "current_location" ||
    locationType === "poi";

  const headerTitle = featured
    ? displayLocation
      ? `Featured stays in ${displayLocation}`
      : "Featured stays"
    : displayLocation
    ? isNearLandmark
      ? `Stays near ${displayLocation}`
      : `Stays in ${displayLocation}`
    : checkIn && checkOut
    ? "Available stays"
    : "All available stays";

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 py-8">
        <Container>
          {/* Page Header */}
          <div className="pb-6 border-b border-zinc-200/80 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              {headerTitle}
            </h1>
            <p className="text-xs text-zinc-500 font-normal mt-1">
              {result.total} {result.total === 1 ? "stay" : "stays"} available
              {checkIn && checkOut ? ` · ${checkIn} to ${checkOut}` : ""}
              {guests ? ` · ${guests} ${guests === 1 ? "guest" : "guests"}` : ""}
              {pets ? ` · ${pets} ${pets === 1 ? "pet" : "pets"}` : ""}
            </p>
          </div>

          {/* Adaptive Radius Expansion Notice Banner */}
          {result.isRadiusExpanded && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200/80 px-4 py-3 text-amber-900 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-200/70 text-amber-900">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="text-xs sm:text-sm font-medium">
                We expanded your search to <span className="font-bold">{result.appliedRadiusKm} km</span> around <span className="font-bold">{displayLocation}</span> to bring you the best available verified stays.
              </div>
            </div>
          )}

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
              page={result.page ?? page}
              totalPages={result.totalPages ?? 1}
              priceRange={result.priceRange}
              currentFilters={currentFilters}
              favoriteIds={favoriteIds}
              locationContextName={displayLocation}
              targetCoords={result.targetCoords}
              appliedRadiusKm={result.appliedRadiusKm}
              isRadiusExpanded={result.isRadiusExpanded}
            />
          </Suspense>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
