"use client";

import React, { useState, useCallback, useTransition, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ListingCard } from "@/components/listings/listing-card";
import type { PublicListingDTO } from "@/services/mappers";
import type { SortBy } from "@/services/listing.service";
import { saveLastSearch } from "@/lib/storage/client-history";

// Lazy-load the map (Leaflet is heavy & client-only)
const SearchMap = dynamic(
  () => import("@/components/listings/search-map").then((m) => m.SearchMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-zinc-100 animate-pulse rounded-2xl" /> },
);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ListingsResultsClientProps {
  listings: PublicListingDTO[];
  total: number;
  page: number;
  totalPages: number;
  priceRange?: { min: number; max: number };
  currentFilters: {
    city?: string;
    placeName?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    placeId?: string;
    locationType?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    amenities?: string[];
    bedrooms?: number;
    bathrooms?: number;
    beds?: number;
    instantBook?: boolean;
    featured?: boolean;
    sortBy?: SortBy;
  };
  favoriteIds?: Set<string>;
  locationContextName?: string;
  targetCoords?: { lat: number; lng: number };
  appliedRadiusKm?: number;
  isRadiusExpanded?: boolean;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "top_rated", label: "Top Rated" },
  { value: "most_reviewed", label: "Most Reviewed" },
];

const PROPERTY_TYPES = [
  "Villa",
  "Apartment",
  "Studio",
  "Chalet",
  "Townhouse",
  "Duplex",
  "Penthouse",
];

const QUICK_AMENITIES = [
  { id: "wifi", label: "Wi-Fi" },
  { id: "pool", label: "Pool" },
  { id: "air_conditioning", label: "Air conditioning" },
  { id: "kitchen", label: "Kitchen" },
  { id: "free_parking", label: "Free parking" },
  { id: "workspace", label: "Dedicated workspace" },
];

// ─────────────────────────────────────────────
// Skeleton Card
// ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-[22px] border border-zinc-100 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-zinc-200 w-full" />
      <div className="p-3.5 space-y-2">
        <div className="h-3.5 bg-zinc-200 rounded w-3/4" />
        <div className="h-3 bg-zinc-200 rounded w-1/2" />
        <div className="h-3 bg-zinc-200 rounded w-2/3" />
        <div className="h-4 bg-zinc-200 rounded w-1/3 mt-1" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export function ListingsResultsClient({
  listings: initialListings,
  total: initialTotal,
  page: initialPage,
  totalPages: initialTotalPages,
  priceRange,
  currentFilters,
  favoriteIds = new Set(),
  locationContextName,
  targetCoords,
  appliedRadiusKm,
  isRadiusExpanded,
}: ListingsResultsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Synchronize active search URL/filter state into lastSearch context
  useEffect(() => {
    const destination =
      searchParams.get("destination") ||
      currentFilters.placeName ||
      currentFilters.city ||
      locationContextName ||
      "";
    const city = currentFilters.city || searchParams.get("city") || destination || null;
    const lat = typeof currentFilters.lat === "number" ? currentFilters.lat : targetCoords?.lat ?? null;
    const lng = typeof currentFilters.lng === "number" ? currentFilters.lng : targetCoords?.lng ?? null;

    if (destination || city || (lat !== null && lng !== null)) {
      saveLastSearch({
        query: destination || city || "Stays",
        displayName: locationContextName || destination || city || "Stays",
        placeId: currentFilters.placeId || searchParams.get("placeId") || null,
        placeType: (currentFilters.locationType as any) || "general",
        latitude: lat,
        longitude: lng,
        city: city,
        checkIn: currentFilters.checkIn || searchParams.get("checkIn") || null,
        checkOut: currentFilters.checkOut || searchParams.get("checkOut") || null,
        guests: currentFilters.guests || Number(searchParams.get("guests")) || 1,
        radiusKm: currentFilters.radiusKm || Number(searchParams.get("radius")) || undefined,
        filters: {
          minPrice: currentFilters.minPrice,
          maxPrice: currentFilters.maxPrice,
          propertyType: currentFilters.propertyType,
          amenities: currentFilters.amenities,
          bedrooms: currentFilters.bedrooms,
          bathrooms: currentFilters.bathrooms,
          beds: currentFilters.beds,
          instantBook: currentFilters.instantBook,
          featured: currentFilters.featured,
          sortBy: currentFilters.sortBy,
        },
      });
    }
  }, [
    searchParams,
    currentFilters,
    locationContextName,
    targetCoords,
  ]);

  const mapCenter: [number, number] | undefined =
    targetCoords
      ? [targetCoords.lat, targetCoords.lng]
      : typeof currentFilters.lat === "number" && typeof currentFilters.lng === "number"
      ? [currentFilters.lat, currentFilters.lng]
      : undefined;

  const mapZoom =
    appliedRadiusKm && appliedRadiusKm <= 6
      ? 14
      : appliedRadiusKm && appliedRadiusKm <= 15
      ? 12
      : appliedRadiusKm && appliedRadiusKm <= 35
      ? 11
      : 10;

  // All listings accumulated (for infinite scroll)
  const [allListings, setAllListings] = useState(initialListings);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialPage < initialTotalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total] = useState(initialTotal);

  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{ neLat: number; neLng: number; swLat: number; swLng: number } | null>(null);

  // Filter panel state — initialised from current URL params
  const [draftMinPrice, setDraftMinPrice] = useState<number>(
    currentFilters.minPrice ? Math.round(currentFilters.minPrice / 100) : 0,
  );
  const [draftMaxPrice, setDraftMaxPrice] = useState<number>(
    currentFilters.maxPrice
      ? Math.round(currentFilters.maxPrice / 100)
      : priceRange
      ? Math.round(priceRange.max / 100)
      : 5000,
  );
  const [draftPropertyType, setDraftPropertyType] = useState<string>(
    currentFilters.propertyType ?? "",
  );
  const [draftAmenities, setDraftAmenities] = useState<string[]>(
    currentFilters.amenities ?? [],
  );
  const [draftBedrooms, setDraftBedrooms] = useState<number>(currentFilters.bedrooms ?? 0);
  const [draftBathrooms, setDraftBathrooms] = useState<number>(currentFilters.bathrooms ?? 0);
  const [draftBeds, setDraftBeds] = useState<number>(currentFilters.beds ?? 0);
  const [draftInstantBook, setDraftInstantBook] = useState<boolean>(
    currentFilters.instantBook ?? false,
  );

  // Compute active filter count for badge
  const activeFilterCount = [
    currentFilters.minPrice && currentFilters.minPrice > 0,
    currentFilters.maxPrice && currentFilters.maxPrice > 0,
    currentFilters.propertyType,
    (currentFilters.amenities ?? []).length > 0,
    currentFilters.bedrooms && currentFilters.bedrooms > 0,
    currentFilters.bathrooms && currentFilters.bathrooms > 0,
    currentFilters.beds && currentFilters.beds > 0,
    currentFilters.instantBook,
    currentFilters.featured,
  ].filter(Boolean).length;

  // ── URL helpers ──────────────────────────────
  const buildUrl = useCallback(
    (overrides: Record<string, string | number | boolean | undefined | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null || v === undefined || v === "" || v === 0 || v === false) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      params.delete("page"); // Reset to page 1 on any filter change
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  // Sort change — immediate URL navigation
  const handleSortChange = (sort: SortBy) => {
    startTransition(() => {
      router.push(buildUrl({ sortBy: sort === "recommended" ? null : sort }));
    });
  };

  // Quick amenity chip toggle
  const handleAmenityChip = (amenityId: string) => {
    const current = (currentFilters.amenities ?? []);
    const next = current.includes(amenityId)
      ? current.filter((a) => a !== amenityId)
      : [...current, amenityId];
    startTransition(() => {
      router.push(buildUrl({ amenities: next.length ? next.join(",") : null }));
    });
  };

  // Apply filter panel
  const handleApplyFilters = () => {
    setIsFilterOpen(false);
    startTransition(() => {
      router.push(
        buildUrl({
          minPrice: draftMinPrice > 0 ? draftMinPrice * 100 : null,
          maxPrice: draftMaxPrice > 0 ? draftMaxPrice * 100 : null,
          propertyType: draftPropertyType || null,
          amenities: draftAmenities.length ? draftAmenities.join(",") : null,
          bedrooms: draftBedrooms > 0 ? draftBedrooms : null,
          bathrooms: draftBathrooms > 0 ? draftBathrooms : null,
          beds: draftBeds > 0 ? draftBeds : null,
          instantBook: draftInstantBook ? "true" : null,
        }),
      );
    });
  };

  // Clear filter panel
  const handleClearFilters = () => {
    setDraftMinPrice(0);
    setDraftMaxPrice(priceRange ? Math.round(priceRange.max / 100) : 5000);
    setDraftPropertyType("");
    setDraftAmenities([]);
    setDraftBedrooms(0);
    setDraftBathrooms(0);
    setDraftBeds(0);
    setDraftInstantBook(false);
  };

  // Map bounds changed — re-search with bounds
  const handleBoundsChange = useCallback(
    (bounds: { neLat: number; neLng: number; swLat: number; swLng: number }) => {
      setMapBounds(bounds);
      const params = new URLSearchParams(searchParams.toString());
      params.set("neLat", String(bounds.neLat.toFixed(6)));
      params.set("neLng", String(bounds.neLng.toFixed(6)));
      params.set("swLat", String(bounds.swLat.toFixed(6)));
      params.set("swLng", String(bounds.swLng.toFixed(6)));
      params.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, searchParams, router],
  );

  // ── Infinite scroll ──────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          loadNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore, currentPage]);

  const loadNextPage = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const nextPage = currentPage + 1;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));

    try {
      const res = await fetch(`/api/v1/listings?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        const newItems: PublicListingDTO[] = data.items ?? data.data ?? [];
        setAllListings((prev) => [...prev, ...newItems]);
        setCurrentPage(nextPage);
        const totalPages = data.pagination?.totalPages ?? data.totalPages ?? initialTotalPages;
        setHasMore(nextPage < totalPages);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Sync listings when server data changes (filter navigation)
  useEffect(() => {
    setAllListings(initialListings);
    setCurrentPage(initialPage);
    setHasMore(initialPage < initialTotalPages);
  }, [initialListings, initialPage, initialTotalPages]);

  // ── Stepper helper ───────────────────────────
  function Stepper({
    value,
    onChange,
    min = 0,
    max = 10,
    label,
  }: {
    value: number;
    onChange: (n: number) => void;
    min?: number;
    max?: number;
    label: string;
  }) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:bg-zinc-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
          </svg>
        </button>
        <span className="min-w-[1.5rem] text-center text-sm font-medium tabular-nums">
          {value === 0 ? "Any" : value === max ? `${max}+` : value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 disabled:opacity-40 hover:bg-zinc-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5v14" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────
  return (
    <>
      {/* ── Top Control Bar ─────────────── */}
      <div className="flex items-center gap-2 pb-5 overflow-x-auto no-scrollbar">
        {/* Sort */}
        <select
          value={currentFilters.sortBy ?? "recommended"}
          onChange={(e) => handleSortChange(e.target.value as SortBy)}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-zinc-900 cursor-pointer shrink-0"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Filters button */}
        <button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          className="relative flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:border-zinc-400 transition-colors shrink-0"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-3.5 w-3.5"
          >
            <path d="M4 6h16M8 12h8M11 18h2" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Active Featured Chip */}
        {currentFilters.featured && (
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                router.push(buildUrl({ featured: null }));
              });
            }}
            className="flex items-center gap-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold px-3.5 py-1.5 shadow-2xs hover:bg-zinc-800 transition-all shrink-0 cursor-pointer"
            aria-label="Clear featured filter"
          >
            <span>✨ Featured</span>
            <span className="text-zinc-400 hover:text-white font-bold text-xs ml-0.5">✕</span>
          </button>
        )}

        {/* Quick amenity chips */}
        {QUICK_AMENITIES.map((am) => {
          const isSelected = (currentFilters.amenities ?? []).includes(am.id);
          return (
            <button
              key={am.id}
              type="button"
              onClick={() => handleAmenityChip(am.id)}
              className={`rounded-full text-xs font-medium px-3.5 py-1.5 transition-all whitespace-nowrap shrink-0 ${
                isSelected
                  ? "bg-amber-300 text-amber-950 font-semibold border border-amber-400 shadow-2xs"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {am.label}
            </button>
          );
        })}
      </div>

      {/* ── Results Area ────────────────── */}
      <div className="flex gap-6 items-start">
        {/* Left: listings list */}
        <div className={`flex-1 min-w-0 ${showMap ? "lg:max-w-[55%]" : ""}`}>
          {/* Result count */}
          <p className="text-xs text-zinc-500 font-normal mb-5">
            {isPending ? (
              <span className="inline-block h-3 w-32 bg-zinc-200 rounded animate-pulse" />
            ) : (
              <>
                {total} {total === 1 ? "stay" : "stays"} found
                {currentFilters.city ? ` in ${currentFilters.city}` : ""}
              </>
            )}
          </p>

          {isPending ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : allListings.length === 0 ? (
            /* ── No results ── */
            <div className="py-20 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-xl text-zinc-400">
                🔍
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-zinc-900">No stays match your search</h2>
                <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                  Try adjusting your destination, dates, or clearing some filters to find available
                  homes.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <a
                  href="/listings"
                  className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all inline-block"
                >
                  Clear all filters
                </a>
                {currentFilters.amenities && currentFilters.amenities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => router.push(buildUrl({ amenities: null })))}
                    className="rounded-full border border-zinc-300 text-zinc-700 font-semibold text-xs px-6 py-2.5 transition-all hover:bg-zinc-50"
                  >
                    Remove amenity filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                className={`grid gap-5 ${
                  showMap
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                }`}
              >
                {allListings.map((item) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHighlightedId(item.id)}
                    onMouseLeave={() => setHighlightedId(null)}
                  >
                    <ListingCard
                      listing={item}
                      initialFavorite={favoriteIds.has(item.id)}
                      targetLocationName={locationContextName}
                    />
                  </div>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="mt-8 flex justify-center">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <div className="h-4 w-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                      Loading more stays…
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: sticky map (desktop) */}
        {showMap && (
          <div className="hidden lg:block sticky top-20 w-[45%] shrink-0 h-[calc(100vh-120px)] rounded-2xl overflow-hidden border border-zinc-200">
            <SearchMap
              listings={allListings}
              highlightedId={highlightedId}
              onBoundsChange={handleBoundsChange}
              checkIn={currentFilters.checkIn}
              checkOut={currentFilters.checkOut}
              guests={currentFilters.guests}
              center={mapCenter}
              zoom={mapZoom}
              className="w-full h-full"
            />
          </div>
        )}
      </div>

      {/* Mobile map view */}
      {showMap && (
        <div className="lg:hidden fixed inset-0 z-20 bg-white flex flex-col pt-16 pb-20">
          <div className="p-3 border-b border-zinc-100 flex items-center justify-between bg-white">
            <span className="text-xs font-semibold text-zinc-900">
              {currentFilters.placeName || currentFilters.city
                ? `Map: ${currentFilters.placeName || currentFilters.city}`
                : "Map view"}
            </span>
            <button
              type="button"
              onClick={() => setShowMap(false)}
              className="text-xs font-medium text-zinc-600 bg-zinc-100 px-3 py-1 rounded-full"
            >
              Close map
            </button>
          </div>
          <div className="flex-1 relative">
            <SearchMap
              listings={allListings}
              highlightedId={highlightedId}
              onBoundsChange={handleBoundsChange}
              checkIn={currentFilters.checkIn}
              checkOut={currentFilters.checkOut}
              guests={currentFilters.guests}
              center={mapCenter}
              zoom={mapZoom}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* ── Map Toggle FAB (mobile / hide map button) ── */}
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-zinc-900 text-white px-5 py-2.5 text-sm font-semibold shadow-xl hover:bg-zinc-800 transition-colors"
      >
        {showMap ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            Show list
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            </svg>
            Show map
          </>
        )}
      </button>

      {/* ── Filter Panel Modal ───────────── */}
      {isFilterOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
          onClick={() => setIsFilterOpen(false)}
        >
          <div
            className="relative w-full sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-zinc-900">Filters</h2>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"
                aria-label="Close filters"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Price Range */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Price range (SAR / night)</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 mb-1 block">Min</label>
                    <input
                      type="number"
                      value={draftMinPrice}
                      min={0}
                      onChange={(e) => setDraftMinPrice(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                      placeholder="0"
                    />
                  </div>
                  <span className="text-zinc-400 text-sm mt-4">—</span>
                  <div className="flex-1">
                    <label className="text-xs text-zinc-500 mb-1 block">Max</label>
                    <input
                      type="number"
                      value={draftMaxPrice}
                      min={0}
                      onChange={(e) => setDraftMaxPrice(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-900"
                      placeholder="5000"
                    />
                  </div>
                </div>
              </div>

              {/* Property type */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Property type</h3>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDraftPropertyType(draftPropertyType === type ? "" : type)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                        draftPropertyType === type
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rooms & beds */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">Rooms & beds</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">Bedrooms</span>
                  <Stepper value={draftBedrooms} onChange={setDraftBedrooms} label="bedrooms" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">Beds</span>
                  <Stepper value={draftBeds} onChange={setDraftBeds} label="beds" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">Bathrooms</span>
                  <Stepper value={draftBathrooms} onChange={setDraftBathrooms} label="bathrooms" />
                </div>
              </div>

              {/* Amenities */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMENITIES.map((am) => {
                    const active = draftAmenities.includes(am.id);
                    return (
                      <button
                        key={am.id}
                        type="button"
                        onClick={() =>
                          setDraftAmenities(
                            active
                              ? draftAmenities.filter((a) => a !== am.id)
                              : [...draftAmenities, am.id],
                          )
                        }
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "bg-amber-300 text-amber-950 border border-amber-400"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        {am.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instant Book toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Instant Book</p>
                  <p className="text-xs text-zinc-500">No approval needed — book immediately</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draftInstantBook}
                  onClick={() => setDraftInstantBook((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    draftInstantBook ? "bg-zinc-900" : "bg-zinc-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      draftInstantBook ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-6 py-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-semibold text-zinc-700 underline hover:text-zinc-900"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="rounded-full bg-zinc-900 text-white px-7 py-2.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Show results
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}

