"use client";

import React, { useState, useCallback, useTransition, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingSearchBar } from "@/components/listings/listing-search-bar";
import { ResultsSummaryBar } from "@/components/listings/results-summary-bar";
import type { PublicListingCardDTO } from "@/services/mappers";
import type { SortBy } from "@/services/listing.service";
import { saveLastSearch, saveRecentSearchContext } from "@/lib/storage/client-history";
import { formatListingPrice, getCurrencyForCountry, getCurrencySymbol } from "@/lib/currency";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import { getGoogleMapsUrl, trackGoogleMapsOpen } from "@/lib/location/google-maps";
import { ListingFilterModal, type ListingFilterValues } from "@/components/listings/listing-filter-modal";

// Lazy-load the map (Leaflet is heavy & client-only)
const SearchMap = dynamic(
  () => import("@/components/listings/search-map").then((m) => m.SearchMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-zinc-100 animate-pulse rounded-2xl" /> },
);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ListingsResultsClientProps {
  listings: PublicListingCardDTO[];
  total: number;
  page: number;
  totalPages: number;
  hasError?: boolean;
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
    adults?: number;
    children?: number;
    infants?: number;
    pets?: number;
    propertyType?: string;
    propertyTypes?: string[];
    listingType?: string;
    minPrice?: number;
    maxPrice?: number;
    amenities?: string[];
    accessibility?: string[];
    languages?: string[];
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
  /** "home-search" when user navigated here via a real search; undefined for See All / View All / direct links */
  source?: string;
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
  { id: "wifi", label: "Wifi" },
  { id: "pool", label: "Pool" },
  { id: "air_conditioning", label: "Air conditioning" },
  { id: "kitchen", label: "Kitchen" },
  { id: "free_parking", label: "Free parking" },
  { id: "self_check_in", label: "Self check-in" },
  { id: "washer", label: "Washing machine" },
  { id: "tv", label: "TV" },
  { id: "workspace", label: "Dedicated workspace" },
];

type QuickFilterOption =
  | { type: "amenity"; id: string; label: string }
  | { type: "bathrooms"; count: number; label: string }
  | { type: "instantBook"; label: string };

const TOP_FILTER_OPTIONS: QuickFilterOption[] = [
  { type: "amenity", id: "self_check_in", label: "Self check-in" },
  { type: "amenity", id: "free_parking", label: "Free parking" },
  { type: "bathrooms", count: 1, label: "1+ bathrooms" },
  { type: "amenity", id: "air_conditioning", label: "Air conditioning" },
  { type: "amenity", id: "wifi", label: "Wifi" },
  { type: "instantBook", label: "Instant Book" },
  { type: "amenity", id: "washer", label: "Washing machine" },
  { type: "amenity", id: "pool", label: "Pool" },
  { type: "amenity", id: "tv", label: "TV" },
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
// Selected Property Preview Card
// ─────────────────────────────────────────────
function SelectedPreviewCard({
  listing,
  onClose,
}: {
  listing: PublicListingCardDTO;
  onClose: () => void;
}) {
  const currency = getCurrencyForCountry(listing.country);
  const formattedPrice = formatListingPrice(listing.price, currency);

  return (
    <div className="relative flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-xl border border-zinc-200">
      <Link
        href={`/listings/${listing.customSlug || listing.id}`}
        className="flex items-center gap-3 flex-1 min-w-0 group"
      >
        <div className="relative h-16 w-20 shrink-0 rounded-xl overflow-hidden bg-zinc-100">
          {listing.photos && listing.photos.length > 0 ? (
            <img
              src={listing.photos[0]}
              alt={listing.title || "Property"}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xl bg-zinc-100">🏡</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold text-zinc-900 truncate group-hover:text-amber-950 transition-colors">
              {listing.title || "Untitled property"}
            </h4>
            {typeof listing.rating === "number" && listing.rating > 0 && (
              <span className="text-[11px] font-semibold text-zinc-800 flex items-center gap-0.5 shrink-0 ml-auto">
                <svg className="w-3 h-3 text-amber-500 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {listing.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 truncate">
            {listing.city || listing.country || "Saudi Arabia"}
            {typeof listing.distanceKm === "number" ? ` · ${listing.distanceKm} km away` : ""}
          </p>
          <div className="text-xs font-bold text-zinc-950 mt-0.5">
            {formattedPrice}
            <span className="text-[10px] font-normal text-zinc-500"> / night</span>
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1 self-start shrink-0">
        {(() => {
          const mapsUrl = getGoogleMapsUrl(listing);
          if (!mapsUrl) return null;
          return (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                trackGoogleMapsOpen(listing.id, "listing_marker_preview");
              }}
              aria-label={`Open ${listing.title || "property"} location in Google Maps`}
              title="Open in Google Maps"
              className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          );
        })()}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close preview"
          className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-800 text-xs transition-colors cursor-pointer"
        >
          ✕
        </button>
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
  hasError = false,
  source,
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
      const searchContext = {
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
      };
      saveLastSearch(searchContext);
      saveRecentSearchContext(searchContext);
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
      ? 13
      : 12;

  // All listings accumulated (for infinite scroll)
  const [allListings, setAllListings] = useState(initialListings);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialPage < initialTotalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  // Track desktop vs mobile/tablet breakpoint (lg: 1024px)
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [mobileViewMode, setMobileViewMode] = useState<"combined" | "map">("combined");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<{ neLat: number; neLng: number; swLat: number; swLng: number } | null>(null);

  // Card element refs for scroll-into-view
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Abort controller ref to protect against stale/race-condition infinite scroll queries
  const abortControllerRef = useRef<AbortController | null>(null);

  // Impression telemetry for property cards (fires once per card per session)
  const seenImpressionsRef = useRef<Set<string>>(new Set());

  // Search query tracking to emit listing_page_view and listing_no_results
  const prevSearchRef = useRef<string | null>(null);

  useEffect(() => {
    const currentQueryString = searchParams.toString();
    if (prevSearchRef.current !== currentQueryString) {
      prevSearchRef.current = currentQueryString;

      trackListingEvent({
        eventType: "listing_page_view",
        destination:
          searchParams.get("destination") ||
          currentFilters.placeName ||
          currentFilters.city ||
          locationContextName ||
          null,
        city: currentFilters.city || searchParams.get("city") || null,
        placeName: currentFilters.placeName || locationContextName || null,
        lat: typeof currentFilters.lat === "number" ? currentFilters.lat : targetCoords?.lat ?? null,
        lng: typeof currentFilters.lng === "number" ? currentFilters.lng : targetCoords?.lng ?? null,
        checkIn: currentFilters.checkIn || searchParams.get("checkIn") || null,
        checkOut: currentFilters.checkOut || searchParams.get("checkOut") || null,
        guestCount: currentFilters.guests || Number(searchParams.get("guests")) || 1,
        resultCount: total,
        sortOption: currentFilters.sortBy ?? "recommended",
      });

      if (total === 0) {
        trackListingEvent({
          eventType: "listing_no_results",
          destination:
            searchParams.get("destination") ||
            currentFilters.placeName ||
            currentFilters.city ||
            locationContextName ||
            null,
          checkIn: currentFilters.checkIn || null,
          checkOut: currentFilters.checkOut || null,
          guestCount: currentFilters.guests || 1,
          resultCount: 0,
        });
      }
    }
  }, [searchParams, currentFilters, locationContextName, targetCoords, total]);

  // Card impression observer: triggers property_card_view when entering viewport
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const listingId = target.getAttribute("data-listing-id");
            if (listingId && !seenImpressionsRef.current.has(listingId)) {
              seenImpressionsRef.current.add(listingId);
              trackListingEvent({
                eventType: "property_card_view",
                propertyId: listingId,
                resultCount: total,
              });
            }
          }
        }
      },
      { threshold: 0.2 },
    );

    cardRefs.current.forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [allListings, total]);

  // Derived effective highlight ID: hover takes temporary precedence, falls back to persistent selection
  const effectiveHighlightedId = hoveredPropertyId || selectedPropertyId;

  // Selected listing object for map preview card
  const selectedListing = selectedPropertyId
    ? allListings.find((l) => l.id === selectedPropertyId) || null
    : null;

  const handleMarkerClick = useCallback((listingId: string) => {
    setSelectedPropertyId(listingId);
    trackListingEvent({
      eventType: "map_marker_click",
      propertyId: listingId,
    });
    const cardEl = cardRefs.current.get(listingId);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

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
  const [draftListingType, setDraftListingType] = useState<string>(
    currentFilters.listingType ?? "",
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
  const [draftFeatured, setDraftFeatured] = useState<boolean>(
    currentFilters.featured ?? false,
  );
  const [draftPets, setDraftPets] = useState<boolean>(
    Boolean(currentFilters.pets && currentFilters.pets > 0),
  );
  const [draftStandout, setDraftStandout] = useState<string>("");
  const [draftAccessibility, setDraftAccessibility] = useState<string[]>([]);
  const [draftHostLanguages, setDraftHostLanguages] = useState<string[]>([]);
  const [showAllAmenities, setShowAllAmenities] = useState<boolean>(false);
  const [isAccessibilityOpen, setIsAccessibilityOpen] = useState<boolean>(false);
  const [isHostLanguageOpen, setIsHostLanguageOpen] = useState<boolean>(false);

  // Sync draft state when modal opens or URL filters change
  useEffect(() => {
    if (isFilterOpen) {
      setDraftMinPrice(currentFilters.minPrice ? Math.round(currentFilters.minPrice / 100) : 0);
      setDraftMaxPrice(
        currentFilters.maxPrice
          ? Math.round(currentFilters.maxPrice / 100)
          : priceRange
          ? Math.round(priceRange.max / 100)
          : 5000,
      );
      setDraftPropertyType(currentFilters.propertyType ?? "");
      setDraftListingType(currentFilters.listingType ?? "");
      setDraftAmenities(currentFilters.amenities ?? []);
      setDraftBedrooms(currentFilters.bedrooms ?? 0);
      setDraftBathrooms(currentFilters.bathrooms ?? 0);
      setDraftBeds(currentFilters.beds ?? 0);
      setDraftInstantBook(currentFilters.instantBook ?? false);
      setDraftFeatured(currentFilters.featured ?? false);
      setDraftPets(Boolean(currentFilters.pets && currentFilters.pets > 0));
      setDraftStandout(currentFilters.featured ? "guest_favourite" : "");
      setDraftAccessibility(currentFilters.accessibility ?? []);
      setDraftHostLanguages(currentFilters.languages ?? []);
    }
  }, [isFilterOpen, currentFilters, priceRange]);

  // Compute active filter count for badge
  const availableMinPrice = priceRange?.min ?? 0;
  const availableMaxPrice = priceRange?.max ?? 0;
  const activeFilterCount = [
    typeof currentFilters.minPrice === "number" && currentFilters.minPrice > availableMinPrice,
    typeof currentFilters.maxPrice === "number" && availableMaxPrice > 0 && currentFilters.maxPrice < availableMaxPrice,
    currentFilters.propertyType || (currentFilters.propertyTypes ?? []).length > 0,
    currentFilters.listingType,
    (currentFilters.amenities ?? []).length > 0,
    (currentFilters.accessibility ?? []).length > 0,
    (currentFilters.languages ?? []).length > 0,
    currentFilters.bedrooms && currentFilters.bedrooms > 0,
    currentFilters.bathrooms && currentFilters.bathrooms > 0,
    currentFilters.beds && currentFilters.beds > 0,
    currentFilters.instantBook,
    currentFilters.featured,
    currentFilters.pets && currentFilters.pets > 0,
  ].filter(Boolean).length;

  const activeCurrency = allListings[0]?.country ? getCurrencyForCountry(allListings[0].country) : "SAR";
  const currencySymbol = getCurrencySymbol(activeCurrency);
  const sliderMin = 0;
  const sliderMax = priceRange?.max ? Math.ceil(priceRange.max / 100) : 5000;

  const histogramBars = useMemo(() => {
    const NUM_BINS = 28;
    const minB = 0;
    const maxB = sliderMax > 0 ? sliderMax : 5000;
    const range = Math.max(100, maxB - minB);
    const step = range / NUM_BINS;

    const defaultCurve = [
      8, 12, 18, 26, 40, 56, 72, 88, 100, 92, 82, 74, 68, 58, 48, 40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4, 3,
    ];

    const counts = new Array(NUM_BINS).fill(0);
    let hasActualData = false;

    if (allListings && allListings.length > 0) {
      allListings.forEach((listing) => {
        const p = listing.price / 100;
        if (p >= minB && p <= maxB) {
          const binIdx = Math.min(NUM_BINS - 1, Math.max(0, Math.floor((p - minB) / step)));
          counts[binIdx] += 1;
          hasActualData = true;
        }
      });
    }

    const maxCount = hasActualData ? Math.max(...counts, 1) : 100;

    return Array.from({ length: NUM_BINS }).map((_, i) => {
      const binStart = minB + i * step;
      const binEnd = binStart + step;
      const heightPercent = hasActualData
        ? Math.max(12, Math.round((counts[i] / maxCount) * 85 + defaultCurve[i] * 0.15))
        : defaultCurve[i];

      const isSelected =
        binEnd >= (draftMinPrice || 0) &&
        binStart <= (draftMaxPrice || maxB);

      return {
        binStart,
        binEnd,
        heightPercent,
        isSelected,
      };
    });
  }, [allListings, sliderMax, draftMinPrice, draftMaxPrice]);

  const minPercent = Math.min(100, Math.max(0, ((draftMinPrice - sliderMin) / (sliderMax - sliderMin)) * 100));
  const maxPercent = Math.min(100, Math.max(0, ((draftMaxPrice - sliderMin) / (sliderMax - sliderMin)) * 100));

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
    trackListingEvent({
      eventType: "listing_sort_changed",
      sortOption: sort,
      resultCount: total,
    });
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
    trackListingEvent({
      eventType: "listing_filter_applied",
      filterKey: `amenity:${amenityId}`,
      metadata: { action: current.includes(amenityId) ? "remove" : "add", amenities: next },
      resultCount: total,
    });
    startTransition(() => {
      router.push(buildUrl({ amenities: next.length ? next.join(",") : null }));
    });
  };

  // Apply filter panel
  const handleApplyFilters = () => {
    setIsFilterOpen(false);
    trackListingEvent({
      eventType: "listing_filter_applied",
      filterKey: "filter_modal",
      metadata: {
        minPrice: draftMinPrice,
        maxPrice: draftMaxPrice,
        propertyType: draftPropertyType,
        listingType: draftListingType,
        amenities: draftAmenities,
        accessibility: draftAccessibility,
        languages: draftHostLanguages,
        bedrooms: draftBedrooms,
        bathrooms: draftBathrooms,
        beds: draftBeds,
        instantBook: draftInstantBook,
        featured: draftFeatured || Boolean(draftStandout),
      },
      resultCount: total,
    });
    startTransition(() => {
      router.push(
        buildUrl({
          minPrice: draftMinPrice > 0 ? draftMinPrice * 100 : null,
          maxPrice: draftMaxPrice > 0 ? draftMaxPrice * 100 : null,
          propertyType: draftPropertyType || null,
          listingType: draftListingType || null,
          amenities: draftAmenities.length ? draftAmenities.join(",") : null,
          accessibility: draftAccessibility.length ? draftAccessibility.join(",") : null,
          languages: draftHostLanguages.length ? draftHostLanguages.join(",") : null,
          bedrooms: draftBedrooms > 0 ? draftBedrooms : null,
          bathrooms: draftBathrooms > 0 ? draftBathrooms : null,
          beds: draftBeds > 0 ? draftBeds : null,
          instantBook: draftInstantBook ? "true" : null,
          featured: draftFeatured || draftStandout ? "true" : null,
          pets: draftPets ? 1 : null,
        }),
      );
    });
  };

  // Clear filter panel
  const handleClearFilters = () => {
    setDraftMinPrice(0);
    setDraftMaxPrice(priceRange ? Math.round(priceRange.max / 100) : 5000);
    setDraftPropertyType("");
    setDraftListingType("");
    setDraftAmenities([]);
    setDraftBedrooms(0);
    setDraftBathrooms(0);
    setDraftBeds(0);
    setDraftInstantBook(false);
    setDraftFeatured(false);
    setDraftPets(false);
    setDraftStandout("");
    setDraftAccessibility([]);
    setDraftHostLanguages([]);
  };

  const handleNewFilterApply = (filters: ListingFilterValues) => {
    const selectedMinPrice = filters.minPrice ?? Math.round(availableMinPrice / 100);
    const selectedMaxPrice = filters.maxPrice ?? Math.round(availableMaxPrice / 100);
    const absoluteMinPrice = Math.round(availableMinPrice / 100);
    const absoluteMaxPrice = Math.round(availableMaxPrice / 100);
    setIsFilterOpen(false);
    trackListingEvent({
      eventType: "listing_filter_applied",
      filterKey: "filter_modal",
      metadata: filters,
      resultCount: total,
    });
    startTransition(() => {
      router.push(buildUrl({
        minPrice: selectedMinPrice > absoluteMinPrice ? selectedMinPrice * 100 : null,
        maxPrice: absoluteMaxPrice > 0 && selectedMaxPrice < absoluteMaxPrice ? selectedMaxPrice * 100 : null,
        propertyType: null,
        propertyTypes: filters.propertyTypes.length ? filters.propertyTypes.join(",") : null,
        listingType: filters.listingType || null,
        amenities: filters.amenities.length ? filters.amenities.join(",") : null,
        accessibility: filters.accessibility.length ? filters.accessibility.join(",") : null,
        languages: filters.languages.length ? filters.languages.join(",") : null,
        bedrooms: filters.bedrooms || null,
        bathrooms: filters.bathrooms || null,
        beds: filters.beds || null,
        instantBook: filters.instantBook ? "true" : null,
        featured: filters.featured ? "true" : null,
        pets: filters.pets ? 1 : null,
      }));
    });
  };

  // Map bounds changed — re-search with bounds
  const handleBoundsChange = useCallback(
    (bounds: { neLat: number; neLng: number; swLat: number; swLng: number }) => {
      setMapBounds(bounds);
      trackListingEvent({
        eventType: "map_area_search",
        lat: (bounds.neLat + bounds.swLat) / 2,
        lng: (bounds.neLng + bounds.swLng) / 2,
        metadata: bounds,
      });
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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const nextPage = currentPage + 1;
    trackListingEvent({
      eventType: "load_more",
      metadata: { nextPage, currentCount: allListings.length },
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));

    try {
      const res = await fetch(`/api/v1/listings?${params.toString()}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const newItems: PublicListingCardDTO[] = data.items ?? data.data ?? [];
        setAllListings((prev) => [...prev, ...newItems]);
        setCurrentPage(nextPage);
        const totalPages = data.pagination?.totalPages ?? data.totalPages ?? initialTotalPages;
        setHasMore(nextPage < totalPages);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Sync listings and total when server data changes (filter / search navigation)
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setAllListings(initialListings);
    setCurrentPage(initialPage);
    setHasMore(initialPage < initialTotalPages);
    setTotal(initialTotal);
    // Clear or maintain selectedPropertyId if still present in new search result set
    setSelectedPropertyId((prev) => (prev && initialListings.some((l) => l.id === prev) ? prev : null));
  }, [initialListings, initialPage, initialTotalPages, initialTotal]);

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
  // Show the inline search bar only when the user arrived here via a real
  // search (homepage search bar or continue-searching bar). Do NOT show it
  // for See All / View All / category / direct /listings navigation.
  // We use the server-passed `source` prop (reliable) rather than
  // searchParams.get("source") which can be stale inside Suspense boundaries.
  const showListingSearchBar =
    source === "home-search" || searchParams.get("source") === "home-search";

  return (
    <>
      {/* ── Listing Search Bar (shown only for home-search entries) ── */}
      {showListingSearchBar && (
        <div className="w-full flex justify-center pb-6">
          <ListingSearchBar />
        </div>
      )}

      {/* ── Results Summary Bar ── */}
      <ResultsSummaryBar
        total={total}
        locationContextName={locationContextName || currentFilters.placeName || currentFilters.city}
        checkIn={currentFilters.checkIn}
        checkOut={currentFilters.checkOut}
        guests={currentFilters.guests}
        pets={currentFilters.pets}
        isPending={isPending}
      />

      {/* ── Mobile Map on Top (Phase 5: Section 2 & 3) ── */}
      {!isDesktop && mobileViewMode === "combined" && (
        <div className="block lg:hidden w-full h-[270px] sm:h-[320px] rounded-2xl overflow-hidden border border-zinc-200 shadow-xs relative mb-4">
          <SearchMap
            listings={allListings}
            highlightedId={effectiveHighlightedId}
            onBoundsChange={handleBoundsChange}
            onMarkerClick={handleMarkerClick}
            checkIn={currentFilters.checkIn}
            checkOut={currentFilters.checkOut}
            guests={currentFilters.guests}
            center={mapCenter}
            zoom={mapZoom}
            className="w-full h-full"
          />

          {/* Expand to Map-Focused Mode Button */}
          <button
            type="button"
            onClick={() => setMobileViewMode("map")}
            className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-200 shadow-md text-xs font-semibold text-zinc-800 hover:bg-zinc-100 flex items-center gap-1.5 cursor-pointer"
            aria-label="Expand to map-focused mode"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            <span>Focus map</span>
          </button>

          {/* Selected Property Preview (when a marker is tapped on mobile inline map) */}
          {selectedListing && (
            <div className="absolute bottom-12 left-3 right-3 z-[1000] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-sm mx-auto">
              <SelectedPreviewCard
                listing={selectedListing}
                onClose={() => setSelectedPropertyId(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Top Control Bar ─────────────── */}
      <div className="flex items-center justify-between gap-3 pb-5">
        {/* Left: Scrollable filter pills matching reference design */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1 min-w-0">
          {/* Filters button */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className={`relative flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium transition-all shrink-0 cursor-pointer ${
              activeFilterCount > 0
                ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
            }`}
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5 shrink-0"
              aria-hidden="true"
            >
              <path d="M1 3.5a.5.5 0 0 1 .5-.5h2.086a2 2 0 0 1 3.828 0H14.5a.5.5 0 0 1 0 1H7.414a2 2 0 0 1-3.828 0H1.5a.5.5 0 0 1-.5-.5zm0 4.5a.5.5 0 0 1 .5-.5h6.086a2 2 0 0 1 3.828 0H14.5a.5.5 0 0 1 0 1h-3.086a2 2 0 0 1-3.828 0H1.5a.5.5 0 0 1-.5-.5zm0 4.5a.5.5 0 0 1 .5-.5h1.086a2 2 0 0 1 3.828 0H14.5a.5.5 0 0 1 0 1H6.414a2 2 0 0 1-3.828 0H1.5a.5.5 0 0 1-.5-.5z" />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-zinc-900 ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Vertical divider line */}
          <div className="h-6 w-px bg-zinc-200 shrink-0 mx-1" aria-hidden="true" />

          {/* Active Featured Chip */}
          {currentFilters.featured && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  router.push(buildUrl({ featured: null }));
                });
              }}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 text-white text-xs sm:text-[13px] font-semibold px-3.5 py-2 shadow-2xs hover:bg-zinc-800 transition-all shrink-0 cursor-pointer"
              aria-label="Clear featured filter"
            >
              <span>✨ Featured</span>
              <span className="text-zinc-400 hover:text-white font-bold text-xs ml-0.5">✕</span>
            </button>
          )}

          {/* Quick Filter Option Pills */}
          {TOP_FILTER_OPTIONS.map((opt) => {
            let isSelected = false;
            let handleClick = () => {};

            if (opt.type === "amenity") {
              isSelected = (currentFilters.amenities ?? []).includes(opt.id);
              handleClick = () => handleAmenityChip(opt.id);
            } else if (opt.type === "bathrooms") {
              isSelected =
                typeof currentFilters.bathrooms === "number" &&
                currentFilters.bathrooms >= opt.count;
              handleClick = () => {
                startTransition(() => {
                  router.push(buildUrl({ bathrooms: isSelected ? null : opt.count }));
                });
              };
            } else if (opt.type === "instantBook") {
              isSelected = currentFilters.instantBook === true;
              handleClick = () => {
                startTransition(() => {
                  router.push(buildUrl({ instantBook: isSelected ? null : true }));
                });
              };
            }

            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={isSelected}
                onClick={handleClick}
                className={`rounded-full text-xs sm:text-[13px] px-4 py-2 transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900 text-white border-zinc-900 font-semibold shadow-xs"
                    : "bg-white text-zinc-800 border-zinc-200 hover:border-zinc-900 font-medium"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Right: Sort dropdown */}
        <div className="shrink-0 pl-1">
          <select
            value={currentFilters.sortBy ?? "recommended"}
            onChange={(e) => handleSortChange(e.target.value as SortBy)}
            className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs sm:text-[13px] font-medium text-zinc-800 outline-none hover:border-zinc-900 focus:border-zinc-900 cursor-pointer shrink-0"
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Results Area ────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: listings list */}
        <div className={`w-full min-w-0 ${showMap ? "lg:w-[56%] xl:w-[58%]" : "w-full"}`}>
          {isPending ? (
            <div className={`grid gap-5 ${showMap ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : hasError ? (
            /* ── Error state ── */
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto text-2xl text-red-500">
                ⚠️
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900">
                  We couldn&apos;t load these properties
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-normal leading-relaxed">
                  Something went wrong while searching. Please try again or clear your filters.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      router.refresh();
                    });
                  }}
                  className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>Retry</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </button>
              </div>
            </div>
          ) : allListings.length === 0 ? (
            /* ── No results ── */
            <div className="py-20 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-xl text-zinc-400">
                🔍
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900">No properties found for these search criteria</h2>
                <p className="text-xs sm:text-sm text-zinc-500 font-normal leading-relaxed">
                  Try adjusting your destination, dates, or clearing some filters to find available homes.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      router.push("/listings");
                    });
                  }}
                  className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs px-6 py-2.5 transition-all inline-block cursor-pointer"
                >
                  Clear all filters
                </button>
                {currentFilters.amenities && currentFilters.amenities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => router.push(buildUrl({ amenities: null })))}
                    className="rounded-full border border-zinc-300 text-zinc-700 font-semibold text-xs px-6 py-2.5 transition-all hover:bg-zinc-50 cursor-pointer"
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
                {allListings.map((item, index) => (
                  <div
                    key={item.id}
                    data-listing-id={item.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(item.id, el);
                      else cardRefs.current.delete(item.id);
                    }}
                    onMouseEnter={() => setHoveredPropertyId(item.id)}
                    onMouseLeave={() => setHoveredPropertyId(null)}
                    onClick={() => setSelectedPropertyId(item.id)}
                    className={`transition-all duration-200 rounded-[24px] ${
                      selectedPropertyId === item.id
                        ? "ring-2 ring-zinc-950 shadow-lg"
                        : ""
                    }`}
                  >
                    <ListingCard
                      listing={item}
                      initialFavorite={favoriteIds.has(item.id)}
                      targetLocationName={locationContextName}
                      priority={index < (isDesktop ? 4 : 2)}
                      checkIn={currentFilters.checkIn}
                      checkOut={currentFilters.checkOut}
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
        {isDesktop && showMap && (
          <div className="hidden lg:block w-full lg:w-[44%] xl:w-[42%] shrink-0 sticky top-[84px] h-[calc(100vh-104px)] rounded-2xl overflow-hidden border border-zinc-200 shadow-xs z-10 isolate relative">
            <SearchMap
              listings={allListings}
              highlightedId={effectiveHighlightedId}
              onBoundsChange={handleBoundsChange}
              onMarkerClick={handleMarkerClick}
              checkIn={currentFilters.checkIn}
              checkOut={currentFilters.checkOut}
              guests={currentFilters.guests}
              center={mapCenter}
              zoom={mapZoom}
              className="w-full h-full"
            />

            {/* Selected Property Preview on Desktop Map */}
            {selectedListing && (
              <div className="absolute bottom-14 left-4 right-4 z-[1000] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-sm">
                <SelectedPreviewCard
                  listing={selectedListing}
                  onClose={() => setSelectedPropertyId(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile Map-Focused Mode (Phase 5: Section 7, 8, 9, 10, 11) ── */}
      {!isDesktop && mobileViewMode === "map" && (
        <ModalOverlay className="lg:hidden fixed inset-0 z-40 bg-white flex flex-col pt-16 pb-6 animate-in fade-in">
          {/* Map Header Bar */}
          <div className="p-3.5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-zinc-900 truncate">
                {currentFilters.placeName || currentFilters.city
                  ? `Map: ${currentFilters.placeName || currentFilters.city}`
                  : "Map view"}
              </span>
              <span className="text-[11px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full shrink-0">
                {total} {total === 1 ? "place" : "places"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileViewMode("combined")}
              className="text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
              aria-label="Back to listings"
            >
              <span>List view</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Full Viewport Map */}
          <div className="flex-1 relative">
            <SearchMap
              listings={allListings}
              highlightedId={effectiveHighlightedId}
              onBoundsChange={handleBoundsChange}
              onMarkerClick={handleMarkerClick}
              checkIn={currentFilters.checkIn}
              checkOut={currentFilters.checkOut}
              guests={currentFilters.guests}
              center={mapCenter}
              zoom={mapZoom}
              className="w-full h-full"
            />

            {/* Floating Compact Result Indicator (Section 7, 8, 9) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setMobileViewMode("combined")}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-5 py-2.5 rounded-full shadow-2xl text-xs cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                aria-label={`Show ${total} ${total === 1 ? "place" : "places"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Show {total} {total === 1 ? "place" : "places"}</span>
              </button>
            </div>

            {/* Selected Property Preview at bottom of map (Section 10, 11, 12, 13) */}
            {selectedListing && (
              <div className="absolute bottom-20 left-3 right-3 z-[1001] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-sm mx-auto pb-[env(safe-area-inset-bottom)]">
                <SelectedPreviewCard
                  listing={selectedListing}
                  onClose={() => setSelectedPropertyId(null)}
                />
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Map Toggle FAB (mobile toggle / desktop expand) ── */}
      <button
        type="button"
        onClick={() => {
          if (isDesktop) {
            setShowMap((v) => !v);
          } else {
            setMobileViewMode((prev) => (prev === "map" ? "combined" : "map"));
          }
        }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-zinc-900 text-white px-5 py-2.5 text-sm font-semibold shadow-xl hover:bg-zinc-800 transition-all cursor-pointer"
        aria-label="Toggle map view"
      >
        <span className="hidden lg:inline-flex items-center gap-2">
          {showMap ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Hide map
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              </svg>
              Show map
            </>
          )}
        </span>
        <span className="inline-flex lg:hidden items-center gap-2">
          {mobileViewMode === "map" ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Show list
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              </svg>
              Map view
            </>
          )}
        </span>
      </button>

      {/* ── Filter Panel Modal ───────────── */}
      {false && isFilterOpen && (
        <ModalOverlay
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
          onClick={() => setIsFilterOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-t-[28px] sm:rounded-[28px] max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white z-10 shrink-0">
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100 transition-colors cursor-pointer text-zinc-700"
                aria-label="Close filters"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-zinc-900">Filters</h2>
              <div className="w-9" aria-hidden="true" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7 divide-y divide-zinc-200/80">
              {/* 1. Recommended for you — hidden */}
              {/* <div>
                <h3 className="text-base font-bold text-zinc-900 mb-3">Recommended for you</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button type="button" onClick={() => { const hasIt = draftAmenities.includes("self_check_in"); setDraftAmenities(hasIt ? draftAmenities.filter((a) => a !== "self_check_in") : [...draftAmenities, "self_check_in"]); }} className={`rounded-2xl border p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${draftAmenities.includes("self_check_in") ? "border-zinc-900 bg-zinc-50/80 ring-2 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-white"}`}><div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl mb-2">🔑</div><span className="text-xs sm:text-sm font-semibold text-zinc-900">Self check-in</span></button>
                  <button type="button" onClick={() => { const hasIt = draftAmenities.includes("free_parking"); setDraftAmenities(hasIt ? draftAmenities.filter((a) => a !== "free_parking") : [...draftAmenities, "free_parking"]); }} className={`rounded-2xl border p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${draftAmenities.includes("free_parking") ? "border-zinc-900 bg-zinc-50/80 ring-2 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-white"}`}><div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold mb-2">🅿️</div><span className="text-xs sm:text-sm font-semibold text-zinc-900">Free parking</span></button>
                  <button type="button" onClick={() => setDraftBathrooms((prev) => (prev >= 1 ? 0 : 1))} className={`rounded-2xl border p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${draftBathrooms >= 1 ? "border-zinc-900 bg-zinc-50/80 ring-2 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-white"}`}><div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-2">🚽</div><span className="text-xs sm:text-sm font-semibold text-zinc-900">1+ bathrooms</span></button>
                  <button type="button" onClick={() => { const hasIt = draftAmenities.includes("air_conditioning"); setDraftAmenities(hasIt ? draftAmenities.filter((a) => a !== "air_conditioning") : [...draftAmenities, "air_conditioning"]); }} className={`rounded-2xl border p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${draftAmenities.includes("air_conditioning") ? "border-zinc-900 bg-zinc-50/80 ring-2 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-white"}`}><div className="w-10 h-10 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl mb-2">❄️</div><span className="text-xs sm:text-sm font-semibold text-zinc-900">Air conditioning</span></button>
                </div>
              </div> */}

              {/* 2. Type of place — hidden */}
              {/* <div className="pt-6">
                <h3 className="text-base font-bold text-zinc-900 mb-1">Type of place</h3>
                <p className="text-xs sm:text-sm text-zinc-500 mb-3.5">Search rooms, entire homes, or any type of place</p>
                <div className="grid grid-cols-3 border border-zinc-200 rounded-xl p-1 bg-zinc-50">
                  {[{ id: "", label: "Any type" }, { id: "ROOM", label: "Room" }, { id: "ENTIRE_HOME", label: "Entire home" }].map((item) => { const active = draftListingType === item.id; return (<button key={item.id} type="button" onClick={() => setDraftListingType(item.id)} className={`py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all text-center cursor-pointer ${active ? "bg-white shadow-xs border border-zinc-200 text-zinc-950" : "text-zinc-600 hover:text-zinc-900"}`}>{item.label}</button>); })}
                </div>
              </div> */}

              {/* 3. Price range */}
              <div className="pt-6">
                <h3 className="text-base font-bold text-zinc-900 mb-1">Price range</h3>
                <p className="text-xs sm:text-sm text-zinc-500 mb-4">Trip price, includes all fees.</p>

                {/* Dynamic Price Histogram and Dual Slider */}
                <div className="relative pt-2 pb-6 px-1">
                  {/* Histogram bars */}
                  <div className="h-16 flex items-end gap-[3px] px-2 mb-0">
                    {histogramBars.map((bar, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-xs transition-colors duration-150 ${
                          bar.isSelected ? "bg-rose-500" : "bg-zinc-200"
                        }`}
                        style={{ height: `${bar.heightPercent}%` }}
                      />
                    ))}
                  </div>

                  {/* Dual Slider Track & Range Inputs */}
                  <div className="relative h-6 flex items-center px-1">
                    {/* Background Track Line */}
                    <div className="absolute left-2 right-2 h-1 bg-zinc-200 rounded-full" />

                    {/* Active Track Highlight */}
                    <div
                      className="absolute h-1 bg-rose-500 rounded-full pointer-events-none"
                      style={{
                        left: `${minPercent}%`,
                        width: `${Math.max(0, maxPercent - minPercent)}%`,
                      }}
                    />

                    {/* Min Range Slider */}
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={10}
                      value={draftMinPrice}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value), draftMaxPrice - 10);
                        setDraftMinPrice(Math.max(sliderMin, val));
                      }}
                      className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none cursor-pointer z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-300 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-105 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-zinc-300 [&::-moz-range-thumb]:shadow-md"
                      aria-label="Minimum price"
                    />

                    {/* Max Range Slider */}
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={10}
                      value={draftMaxPrice}
                      onChange={(e) => {
                        const val = Math.max(Number(e.target.value), draftMinPrice + 10);
                        setDraftMaxPrice(Math.min(sliderMax, val));
                      }}
                      className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none cursor-pointer z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-300 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-105 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-zinc-300 [&::-moz-range-thumb]:shadow-md"
                      aria-label="Maximum price"
                    />
                  </div>
                </div>

                {/* Min / Max Editable Inputs */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-2xl border border-zinc-300 px-3.5 py-2.5 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                    <label className="text-[11px] font-medium text-zinc-500 block">Minimum</label>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-semibold text-zinc-400">{currencySymbol}</span>
                      <input
                        type="number"
                        min={0}
                        value={draftMinPrice || ""}
                        onChange={(e) => setDraftMinPrice(Math.max(0, Number(e.target.value)))}
                        placeholder="0"
                        className="w-full text-sm font-semibold text-zinc-900 outline-none bg-transparent"
                      />
                    </div>
                  </div>
                  <span className="text-zinc-400 font-bold">—</span>
                  <div className="flex-1 rounded-2xl border border-zinc-300 px-3.5 py-2.5 focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 transition-all">
                    <label className="text-[11px] font-medium text-zinc-500 block">Maximum</label>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-semibold text-zinc-400">{currencySymbol}</span>
                      <input
                        type="number"
                        min={0}
                        value={draftMaxPrice || ""}
                        onChange={(e) => setDraftMaxPrice(Math.max(0, Number(e.target.value)))}
                        placeholder={String(sliderMax)}
                        className="w-full text-sm font-semibold text-zinc-900 outline-none bg-transparent"
                      />
                      <span className="text-sm font-semibold text-zinc-400">+</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Rooms and beds */}
              <div className="pt-6 space-y-4">
                <h3 className="text-base font-bold text-zinc-900">Rooms and beds</h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-medium text-zinc-800">Bedrooms</span>
                  <Stepper value={draftBedrooms} onChange={setDraftBedrooms} label="bedrooms" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-medium text-zinc-800">Beds</span>
                  <Stepper value={draftBeds} onChange={setDraftBeds} label="beds" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-medium text-zinc-800">Bathrooms</span>
                  <Stepper value={draftBathrooms} onChange={setDraftBathrooms} label="bathrooms" />
                </div>
              </div>

              {/* 5. Amenities */}
              <div className="pt-6 space-y-5">
                <h3 className="text-base font-bold text-zinc-900">Amenities</h3>

                {/* Popular */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Popular</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "wifi", label: "Wifi", icon: "📶" },
                      { id: "washer", label: "Washing machine", icon: "🧺" },
                      { id: "pool", label: "Pool", icon: "🏊" },
                      { id: "tv", label: "TV", icon: "📺" },
                      { id: "hair_dryer", label: "Hair dryer", icon: "💇" },
                      { id: "kitchen", label: "Kitchen", icon: "🍳" },
                    ].map((am) => {
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
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                              : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                          }`}
                        >
                          <span>{am.icon}</span>
                          <span>{am.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Essentials */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Essentials</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "dryer", label: "Tumble dryer", icon: "💨" },
                      { id: "air_conditioning", label: "Air conditioning", icon: "❄️" },
                      { id: "heating", label: "Heating", icon: "🔥" },
                      { id: "workspace", label: "Dedicated workspace", icon: "💻" },
                      { id: "iron", label: "Iron", icon: "👔" },
                    ].map((am) => {
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
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                              : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                          }`}
                        >
                          <span>{am.icon}</span>
                          <span>{am.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Features</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "hot_tub", label: "Hot tub", icon: "🛁" },
                      { id: "free_parking", label: "Free parking", icon: "🅿️" },
                      { id: "ev_charger", label: "EV charger", icon: "🔌" },
                      { id: "gym", label: "Gym", icon: "🏋️" },
                      { id: "bbq_grill", label: "BBQ grill", icon: "🍖" },
                      { id: "indoor_fireplace", label: "Indoor fireplace", icon: "🪵" },
                      ...(showAllAmenities
                        ? [
                            { id: "king_bed", label: "King bed", icon: "🛏️" },
                            { id: "cot", label: "Cot", icon: "👶" },
                            { id: "breakfast", label: "Breakfast", icon: "☕" },
                            { id: "smoking_allowed", label: "Smoking allowed", icon: "🚬" },
                          ]
                        : []),
                    ].map((am) => {
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
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                              : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                          }`}
                        >
                          <span>{am.icon}</span>
                          <span>{am.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showAllAmenities && (
                  <>
                    {/* Location */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Location</h4>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "beachfront", label: "Beachfront", icon: "🏖️" },
                          { id: "waterfront", label: "Waterfront", icon: "🌊" },
                        ].map((am) => {
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
                              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                                active
                                  ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                              }`}
                            >
                              <span>{am.icon}</span>
                              <span>{am.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Safety */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">Safety</h4>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "smoke_alarm", label: "Smoke alarm", icon: "🚨" },
                          { id: "carbon_monoxide_alarm", label: "Carbon monoxide alarm", icon: "⚠️" },
                        ].map((am) => {
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
                              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                                active
                                  ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                                  : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                              }`}
                            >
                              <span>{am.icon}</span>
                              <span>{am.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowAllAmenities((v) => !v)}
                  className="text-xs sm:text-sm font-semibold text-zinc-900 underline hover:text-zinc-600 transition-colors cursor-pointer"
                >
                  {showAllAmenities ? "Show less" : "Show more"}
                </button>
              </div>

              {/* 6. Booking options */}
              <div className="pt-6">
                <h3 className="text-base font-bold text-zinc-900 mb-3">Booking options</h3>
                <div className="flex flex-wrap gap-2.5">
                  {/* Instant Book */}
                  <button
                    type="button"
                    onClick={() => setDraftInstantBook((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                      draftInstantBook
                        ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                    }`}
                  >
                    <span>⚡</span>
                    <span>Instant Book</span>
                  </button>

                  {/* Self check-in */}
                  <button
                    type="button"
                    onClick={() => {
                      const hasIt = draftAmenities.includes("self_check_in");
                      setDraftAmenities(hasIt ? draftAmenities.filter((a) => a !== "self_check_in") : [...draftAmenities, "self_check_in"]);
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                      draftAmenities.includes("self_check_in")
                        ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                    }`}
                  >
                    <span>🔑</span>
                    <span>Self check-in</span>
                  </button>

                  {/* Allows pets */}
                  <button
                    type="button"
                    onClick={() => setDraftPets((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                      draftPets
                        ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                    }`}
                  >
                    <span>🐾</span>
                    <span>Allows pets</span>
                  </button>
                </div>
              </div>

              {/* 7. Standout stays — hidden */}
              {/* <div className="pt-6">
                <h3 className="text-base font-bold text-zinc-900 mb-3">Standout stays</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setDraftFeatured((v) => !v)} className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${draftFeatured ? "border-zinc-900 bg-zinc-50/80 ring-2 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-white"}`}><div className="flex items-center gap-3"><span className="text-2xl">🏆</span><div><h4 className="text-sm font-bold text-zinc-900">Guest favourite</h4><p className="text-xs text-zinc-500">The most loved homes on Homyz</p></div></div></button>
                  <button type="button" onClick={() => setDraftStandout((prev) => (prev === "luxe" ? "" : "luxe"))} className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${draftStandout === "luxe" ? "border-zinc-900 bg-zinc-50/80 ring-2 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400 bg-white"}`}><div className="flex items-center gap-3"><span className="text-2xl">💎</span><div><h4 className="text-sm font-bold text-zinc-900">Luxe</h4><p className="text-xs text-zinc-500">Luxury homes with elevated design</p></div></div></button>
                </div>
              </div> */}

              {/* 8. Property type */}
              <div className="pt-6">
                <h3 className="text-base font-bold text-zinc-900 mb-3">Property type</h3>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { id: "Villa", label: "House / Villa", icon: "🏠" },
                    { id: "Apartment", label: "Flat / Apartment", icon: "🏢" },
                    { id: "Chalet", label: "Guesthouse / Chalet", icon: "🏡" },
                    { id: "Hotel", label: "Hotel", icon: "🏨" },
                    { id: "Studio", label: "Studio", icon: "🛋️" },
                    { id: "Townhouse", label: "Townhouse", icon: "🏘️" },
                    { id: "Penthouse", label: "Penthouse", icon: "🏙️" },
                  ].map((pt) => {
                    const active = draftPropertyType.toLowerCase() === pt.id.toLowerCase();
                    return (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setDraftPropertyType(active ? "" : pt.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs sm:text-[13px] font-medium transition-all cursor-pointer ${
                          active
                            ? "border-zinc-900 bg-zinc-900 text-white font-semibold shadow-xs"
                            : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900"
                        }`}
                      >
                        <span>{pt.icon}</span>
                        <span>{pt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 9. Accessibility features — hidden */}
              {/* <div className="pt-6">
                ...accessibility content hidden...
              </div> */}


              {/* 10. Host language */}
              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => setIsHostLanguageOpen((v) => !v)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group"
                >
                  <h3 className="text-base font-bold text-zinc-900">Host language</h3>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-5 w-5 text-zinc-500 transition-transform ${isHostLanguageOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isHostLanguageOpen && (
                  <div className="mt-4 grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                    {[
                      "English", "Arabic", "French", "German", "Spanish", "Italian", "Russian",
                      "Chinese (Simplified)", "Japanese", "Korean", "Hindi", "Turkish", "Portuguese",
                      "Dutch", "Greek", "Hebrew", "Polish", "Swedish", "Indonesian", "Thai"
                    ].map((lang) => (
                      <label key={lang} className="flex items-center gap-3 text-xs sm:text-sm text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftHostLanguages.includes(lang)}
                          onChange={() => {
                            setDraftHostLanguages((prev) =>
                              prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                            );
                          }}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                        />
                        <span className="truncate">{lang}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-zinc-200 px-6 py-4 flex items-center justify-between gap-4 z-10 shrink-0">
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm font-semibold text-zinc-800 underline hover:text-zinc-950 transition-colors cursor-pointer"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="rounded-xl bg-zinc-900 text-white px-7 py-3 text-sm font-semibold hover:bg-zinc-800 transition-all shadow-xs cursor-pointer"
              >
                Show {total > 0 ? `${total.toLocaleString()} ` : ""}places
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {isFilterOpen && <ListingFilterModal
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleNewFilterApply}
        initialFilters={{
          minPrice: currentFilters.minPrice ? Math.round(currentFilters.minPrice / 100) : Math.round(availableMinPrice / 100),
          maxPrice: currentFilters.maxPrice ? Math.round(currentFilters.maxPrice / 100) : Math.round(availableMaxPrice / 100),
          propertyTypes: currentFilters.propertyTypes ?? (currentFilters.propertyType ? [currentFilters.propertyType] : []),
          listingType: currentFilters.listingType === "ROOM" ? "ROOM" : currentFilters.listingType ? "ENTIRE_PLACE" : "",
          amenities: currentFilters.amenities ?? [],
          accessibility: currentFilters.accessibility ?? [],
          languages: currentFilters.languages ?? [],
          bedrooms: currentFilters.bedrooms ?? 0,
          beds: currentFilters.beds ?? 0,
          bathrooms: currentFilters.bathrooms ?? 0,
          instantBook: currentFilters.instantBook ?? false,
          featured: currentFilters.featured ?? false,
          pets: Boolean(currentFilters.pets && currentFilters.pets > 0),
        }}
        availablePriceRange={priceRange}
        currencySymbol={currencySymbol}
        baseSearchParams={searchParams.toString()}
        currentTotal={total}
        isApplying={isPending}
      />}
    </>
  );
}
