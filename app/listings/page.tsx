import React, { Suspense } from "react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/dashboard/app-header";
import { Footer } from "@/components/dashboard/footer";
import { Container } from "@/components/ui";
import { listingService } from "@/services/listing.service";
import type { SortBy } from "@/services/listing.service";
import { ListingsResultsClient } from "./listings-results-client";
import { getSessionUser } from "@/lib/auth/session";
import { favoriteService } from "@/services/favorite.service";
import { parsePublicListingSort } from "@/lib/listings/public-sort";
import { cookies } from "next/headers";
import { LAST_SEARCH_COOKIE, parseServerLastSearch } from "@/lib/storage/client-history";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stays & Vacation Rentals — Homyz",
  description:
    "Browse verified homes, villas, apartments, and vacation rentals on Homyz.",
};

interface SearchPageProps {
  searchParams: Promise<{
    location?: string;
    city?: string;
    destination?: string;
    placeName?: string;
    fullAddress?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    placeId?: string;
    locationType?: string;
    checkin?: string;
    checkIn?: string;
    startDate?: string;
    checkout?: string;
    checkOut?: string;
    endDate?: string;
    guests?: string;
    adults?: string;
    children?: string;
    infants?: string;
    pets?: string;
    propertyType?: string;
    propertyTypes?: string;
    listingType?: string;
    minPrice?: string;
    maxPrice?: string;
    amenities?: string;
    accessibility?: string;
    languages?: string;
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
    north?: string;
    south?: string;
    east?: string;
    west?: string;
    source?: string;
  }>;
}

export default async function ListingsSearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;

  const cookieStore = await cookies();
  const serverLastSearch = parseServerLastSearch(cookieStore.get(LAST_SEARCH_COOKIE)?.value);

  // Parse URL params
  const destination = sp.location || sp.destination || sp.city || undefined;
  const city = sp.city || sp.location || sp.destination || undefined;
  const placeName = sp.placeName || sp.location || sp.destination || sp.city || undefined;
  const lat = sp.lat ? parseFloat(sp.lat) : undefined;
  const lng = sp.lng ? parseFloat(sp.lng) : undefined;
  const radiusKm = sp.radius ? parseFloat(sp.radius) : undefined;
  const placeId = sp.placeId || undefined;
  const locationType = sp.locationType || undefined;
  const checkIn = sp.checkIn || sp.checkin || sp.startDate || serverLastSearch?.checkIn || undefined;
  const checkOut = sp.checkOut || sp.checkout || sp.endDate || serverLastSearch?.checkOut || undefined;
  const guests = sp.guests ? parseInt(sp.guests, 10) : serverLastSearch?.guests || undefined;
  const adults = sp.adults ? parseInt(sp.adults, 10) : serverLastSearch?.adults || undefined;
  const children = sp.children ? parseInt(sp.children, 10) : serverLastSearch?.children || undefined;
  const infants = sp.infants ? parseInt(sp.infants, 10) : serverLastSearch?.infants || undefined;
  const pets = sp.pets ? parseInt(sp.pets, 10) : serverLastSearch?.pets || undefined;
  const propertyType = sp.propertyType || undefined;
  const propertyTypes = sp.propertyTypes ? sp.propertyTypes.split(",").filter(Boolean) : undefined;
  const listingType = sp.listingType || undefined;
  const minPrice = sp.minPrice ? parseInt(sp.minPrice, 10) : undefined;
  const maxPrice = sp.maxPrice ? parseInt(sp.maxPrice, 10) : undefined;
  const amenities = sp.amenities ? sp.amenities.split(",").filter(Boolean) : undefined;
  const accessibility = sp.accessibility ? sp.accessibility.split(",").filter(Boolean) : undefined;
  const languages = sp.languages ? sp.languages.split(",").filter(Boolean) : undefined;
  const bedrooms = sp.bedrooms ? parseInt(sp.bedrooms, 10) : undefined;
  const bathrooms = sp.bathrooms ? parseInt(sp.bathrooms, 10) : undefined;
  const beds = sp.beds ? parseInt(sp.beds, 10) : undefined;
  const instantBook = sp.instantBook === "true" ? true : undefined;
  const featured = sp.featured === "true" ? true : undefined;
  const sortBy: SortBy | undefined = parsePublicListingSort(sp.sortBy);
  const page = sp.page ? parseInt(sp.page, 10) : 1;

  // Map bounds (for map-based search, supports both neLat/neLng/swLat/swLng and north/east/south/west)
  const rawNorth = sp.neLat || sp.north;
  const rawEast = sp.neLng || sp.east;
  const rawSouth = sp.swLat || sp.south;
  const rawWest = sp.swLng || sp.west;
  const mapBounds =
    rawNorth && rawEast && rawSouth && rawWest
      ? {
          neLat: parseFloat(rawNorth),
          neLng: parseFloat(rawEast),
          swLat: parseFloat(rawSouth),
          swLng: parseFloat(rawWest),
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

  let hasError = false;
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
      propertyTypes,
      listingType,
      minPrice,
      maxPrice,
      amenities,
      accessibilityFeatures: accessibility,
      languages,
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
    hasError = true;
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
    propertyTypes,
    listingType,
    minPrice,
    maxPrice,
    amenities,
    accessibility,
    languages,
    bedrooms,
    bathrooms,
    beds,
    instantBook,
    featured,
    sortBy,
  };

  const displayLocation = result.locationContextName || placeName || city;

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      <AppHeader />

      <main className="w-full flex-1 lg:py-20 py-10">
        <Container>          

          {/* Interactive client section (<ListingCard /> rendered in grid) */}
          <Suspense
            fallback={
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left section skeleton */}
                <div className="w-full lg:w-[58%] xl:w-[56%] min-w-0">
                  <div className="pb-4 border-b border-zinc-200/80 mb-5 animate-pulse">
                    <div className="h-7 w-72 bg-zinc-200 rounded-md mb-2" />
                    <div className="h-4 w-48 bg-zinc-200 rounded-md" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-[20px] border border-[#1f1f1f] overflow-hidden animate-pulse">
                        <div className="aspect-[4/3] bg-zinc-200 w-full" />
                        <div className="p-3.5 space-y-2">
                          <div className="h-3.5 bg-zinc-200 rounded w-3/4" />
                          <div className="h-3 bg-zinc-200 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right sticky map skeleton (Desktop) */}
                <div className="hidden lg:block w-full lg:w-[42%] xl:w-[44%] shrink-0 h-[calc(100vh-104px)] rounded-[20px] border border-[#1f1f1f] bg-zinc-100 animate-pulse" />
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
              hasError={hasError}
              source={sp.source}
            />
          </Suspense>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
