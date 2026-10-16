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
import { publicListingSearchFiltersSchema } from "@/lib/validation/public-listing-search";

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
    country?: string;
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

  const firstPresent = (...values: Array<string | undefined>) => values.find((value) => value !== undefined);
  const numberParam = (value: string | undefined): number | undefined => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed ? Number(trimmed) : Number.NaN;
  };

  // An explicitly supplied URL value always wins over persisted state, including
  // invalid values. That lets validation display a correction instead of silently
  // falling back to an older, unrelated search.
  const destination = firstPresent(sp.location, sp.destination, sp.city);
  const city = firstPresent(sp.city, sp.location, sp.destination);
  const country = sp.country !== undefined ? sp.country : serverLastSearch?.country || undefined;
  const placeName = firstPresent(sp.placeName, sp.location, sp.destination, sp.city);
  const lat = numberParam(sp.lat);
  const lng = numberParam(sp.lng);
  const radiusKm = numberParam(sp.radius);
  const placeId = sp.placeId || undefined;
  const locationType = sp.locationType || undefined;
  const explicitCheckIn = firstPresent(sp.checkIn, sp.checkin, sp.startDate);
  const explicitCheckOut = firstPresent(sp.checkOut, sp.checkout, sp.endDate);
  const checkIn = explicitCheckIn !== undefined ? explicitCheckIn : serverLastSearch?.checkIn || undefined;
  const checkOut = explicitCheckOut !== undefined ? explicitCheckOut : serverLastSearch?.checkOut || undefined;
  const guests = sp.guests !== undefined ? numberParam(sp.guests) : serverLastSearch?.guests || undefined;
  const adults = sp.adults !== undefined ? numberParam(sp.adults) : serverLastSearch?.adults || undefined;
  const children = sp.children !== undefined ? numberParam(sp.children) : serverLastSearch?.children || undefined;
  const infants = sp.infants !== undefined ? numberParam(sp.infants) : serverLastSearch?.infants || undefined;
  const pets = sp.pets !== undefined ? numberParam(sp.pets) : serverLastSearch?.pets || undefined;
  const propertyType = sp.propertyType || undefined;
  const propertyTypes = sp.propertyTypes ? sp.propertyTypes.split(",").filter(Boolean) : undefined;
  const listingType = sp.listingType || undefined;
  const minPrice = numberParam(sp.minPrice);
  const maxPrice = numberParam(sp.maxPrice);
  const amenities = sp.amenities ? sp.amenities.split(",").filter(Boolean) : undefined;
  const accessibility = sp.accessibility ? sp.accessibility.split(",").filter(Boolean) : undefined;
  const languages = sp.languages ? sp.languages.split(",").filter(Boolean) : undefined;
  const bedrooms = numberParam(sp.bedrooms);
  const bathrooms = numberParam(sp.bathrooms);
  const beds = numberParam(sp.beds);
  const instantBook = sp.instantBook === "true" ? true : undefined;
  const featured = sp.featured === "true" ? true : undefined;
  const sortBy: SortBy | undefined = parsePublicListingSort(sp.sortBy);
  const page = sp.page !== undefined ? numberParam(sp.page) : 1;

  // Map bounds (for map-based search, supports both neLat/neLng/swLat/swLng and north/east/south/west)
  const rawNorth = firstPresent(sp.neLat, sp.north);
  const rawEast = firstPresent(sp.neLng, sp.east);
  const rawSouth = firstPresent(sp.swLat, sp.south);
  const rawWest = firstPresent(sp.swLng, sp.west);
  const hasSomeMapBounds = [rawNorth, rawEast, rawSouth, rawWest].some((value) => value !== undefined);
  const hasAllMapBounds = [rawNorth, rawEast, rawSouth, rawWest].every((value) => value !== undefined);
  const mapBounds = hasAllMapBounds
    ? {
        neLat: numberParam(rawNorth),
        neLng: numberParam(rawEast),
        swLat: numberParam(rawSouth),
        swLng: numberParam(rawWest),
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

  let hasError = hasSomeMapBounds && !hasAllMapBounds;
  let errorMessage = hasError ? "All four map bounds must be provided together." : undefined;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  const userPromise = getSessionUser().catch(() => null);
  const searchFilters = {
    destination,
    country,
    lat,
    lng,
    radiusKm,
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
  };
  const searchValidation = publicListingSearchFiltersSchema.safeParse(searchFilters);
  const searchPromise = !hasError && searchValidation.success
    ? listingService.searchPublicListings(searchValidation.data)
    : Promise.reject(
        hasError
          ? new Error(errorMessage)
          : searchValidation.error,
      );

  try {
    const [resolvedUser, res] = await Promise.all([userPromise, searchPromise]);
    user = resolvedUser;
    result = res;
  } catch (err) {
    console.error("Search query failed:", err);
    hasError = true;
    if (searchValidation.success === false) {
      errorMessage = searchValidation.error.issues[0]?.message || "Please correct your search and try again.";
    }
  }

  // Load favorites for logged-in users (only for the items on this page)
  let favoriteIds = new Set<string>();
  if (user?.id && result.items.length > 0) {
    try {
      favoriteIds = await favoriteService.getFavoriteListingIds(
        user.id,
        result.items.map((i) => i.id),
      );
    } catch {
      // favorites are non-critical
    }
  }

  const currentFilters = {
    city,
    country,
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

  const displayLocation = result.locationContextName || placeName || city || country;

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
              page={result.page ?? page ?? 1}
              totalPages={result.totalPages ?? 1}
              priceRange={result.priceRange}
              currentFilters={currentFilters}
              favoriteIds={favoriteIds}
              locationContextName={displayLocation}
              targetCoords={result.targetCoords}
              appliedRadiusKm={result.appliedRadiusKm}
              isRadiusExpanded={result.isRadiusExpanded}
              hasError={hasError}
              errorMessage={errorMessage}
              source={sp.source}
            />
          </Suspense>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
