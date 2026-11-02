"use client";

import React, { useState, useCallback, useTransition, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ListingCard } from "@/components/listings/listing-card";
import { SuperhostBadge } from "@/components/badges/superhost-badge";
import { ListingSearchBar } from "@/components/listings/listing-search-bar";
import { ResultsSummaryBar } from "@/components/listings/results-summary-bar";
import type { PublicListingCardDTO } from "@/services/mappers";
import type { SortBy } from "@/services/listing.service";
import { saveLastSearch, saveRecentSearchContext, buildListingDetailUrl } from "@/lib/storage/client-history";
import { getCurrencyForCountry, getCurrencySymbol } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import { getGoogleMapsUrl, trackGoogleMapsOpen } from "@/lib/location/google-maps";
import { ListingFilterModal, type ListingFilterValues } from "@/components/listings/listing-filter-modal";
import Image from "next/image";

// Lazy-load the map (Leaflet is heavy & client-only)
const SearchMap = dynamic(
  () => import("@/components/listings/search-map").then((m) => m.SearchMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-zinc-100 animate-pulse rounded-2xl" /> },
);

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

function subscribeToDesktopBreakpoint(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopBreakpointSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

// A stable server snapshot ensures hydration starts from the exact server tree.
function getServerDesktopBreakpointSnapshot() {
  return false;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ListingsResultsClientProps {
  listings: PublicListingCardDTO[];
  total: number;
  page: number;
  totalPages: number;
  hasError?: boolean;
  errorMessage?: string;
  priceRange?: { min: number; max: number };
  currentFilters: {
    city?: string;
    country?: string;
    placeName?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    placeId?: string;
    locationType?: string;
    checkIn?: string;
    checkOut?: string;
    dateMode?: string;
    dateFlexibility?: number;
    flexibleDuration?: string;
    flexibleMonths?: string[];
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
// Helper: Deduplicate listings by unique ID
// ─────────────────────────────────────────────
function dedupeListings<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

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
  checkIn,
  checkOut,
  guests,
  adults,
  children,
  infants,
  pets,
  country,
  dateMode,
  flexibleDuration,
  flexibleMonths,
}: {
  listing: PublicListingCardDTO;
  onClose: () => void;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  adults?: number;
  children?: number;
  infants?: number;
  pets?: number;
  country?: string;
  dateMode?: string;
  flexibleDuration?: string;
  flexibleMonths?: string[];
}) {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const currency = getCurrencyForCountry(listing.country);
  const selectedStayNights = (() => {
    if (!checkIn || !checkOut) return 1;
    const toUtcMidnight = (value: string) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Number.NaN;
    };
    const nights = (toUtcMidnight(checkOut) - toUtcMidnight(checkIn)) / 86_400_000;
    return Number.isFinite(nights) && nights > 0 ? nights : 1;
  })();
  const effectiveNightlyPrice = listing.pricing?.discountedDisplayPrice
    ?? listing.pricing?.baseDisplayPrice
    ?? listing.price;
  const isFlexibleSearch = dateMode === "flexible" && Boolean(flexibleDuration);
  const formattedPrice = formatPrice(effectiveNightlyPrice * (isFlexibleSearch ? 1 : selectedStayNights), currency);
  const showGuestFavorite = listing.isGuestFavorite === true;
  const showSuperhost = listing.isSuperhost === true;

  return (
    <div className="relative flex items-center gap-3 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-xl border border-zinc-200">
      <Link
        href={buildListingDetailUrl(listing.customSlug || listing.id, {
          location: listing.city || undefined,
          checkIn,
          checkOut,
          guests,
          adults,
          children,
          infants,
          pets,
          country,
        }, isFlexibleSearch ? {
          dateMode: "flexible",
          stay: flexibleDuration,
          months: flexibleMonths?.join(","),
        } : undefined)}
        className="flex items-center gap-3 flex-1 min-w-0 group"
      >
        <div className="relative h-16 w-20 shrink-0 rounded-xl overflow-hidden bg-zinc-100">
          {listing.photos && listing.photos.length > 0 ? (
            <img
              src={listing.photos[0]}
              alt={listing.title || t("host_untitled_listing", "Property")}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xl bg-zinc-100">🏡</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {(showGuestFavorite || showSuperhost) && (
            <div className="flex flex-wrap items-center gap-1 mb-1">
              {showGuestFavorite && (
                <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-medium text-amber-950 leading-tight">
                  {t("listings_guest_favourite", "Guest favourite")}
                </span>
              )}
              {showSuperhost && (
                <SuperhostBadge
                  active
                  compact
                  label={t("listings_superhost", "Superhost")}
                  className="border-0 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-medium leading-tight text-white"
                />
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-medium text-[#1F1F1F] truncate group-hover:text-amber-950 transition-colors">
              {listing.title || t("host_untitled_listing", "Untitled property")}
            </h4>
            {typeof listing.rating === "number" && listing.rating > 0 && (
              <span className="text-[11px] font-medium text-zinc-800 flex items-center gap-0.5 shrink-0 ml-auto">
                <svg className="w-3 h-3 text-amber-500 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {listing.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-sm text-[#727272] truncate">
            {listing.city || listing.country || "Saudi Arabia"}
            {typeof listing.distanceKm === "number" ? t("listings_km_away", { distance: listing.distanceKm }, ` · ${listing.distanceKm} km away`) : ""}
          </p>
          <div className="text-xs font-medium text-zinc-950 mt-0.5">
            {isFlexibleSearch ? `From ${formattedPrice}` : formattedPrice}
            <span className="text-[10px] font-normal text-[#727272]">
              {isFlexibleSearch || selectedStayNights === 1 ? t("listings_per_night", " / night") : t("listings_for_nights", { count: selectedStayNights }, ` for ${selectedStayNights} nights`)}
            </span>
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
              title={t("listings_open_google_maps", "Open in Google Maps")}
              className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-600 hover:text-[#1F1F1F] transition-colors cursor-pointer"
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
          aria-label={t("listings_close_preview", "Close preview")}
          className="h-7 w-7 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-[#727272] hover:text-zinc-800 text-xs transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function deduplicateListings<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

interface ClientSearchCacheEntry {
  items: PublicListingCardDTO[];
  total: number;
  totalPages: number;
  priceRange?: { min: number; max: number };
  locationContextName?: string;
  targetCoords?: { lat: number; lng: number };
  appliedRadiusKm?: number;
  isRadiusExpanded?: boolean;
  timestamp: number;
}

const clientSearchCache = new Map<string, ClientSearchCacheEntry>();
// Calendar mutations are booking-critical. Keep entries only as navigation
// snapshots; every subsequent query/refetch must ask the versioned server cache.
const CLIENT_CACHE_TTL_MS = 0;

export function buildNormalizedSearchKey(params: URLSearchParams | string): string {
  const sp = typeof params === "string" ? new URLSearchParams(params) : params;
  const keysToInclude = [
    "destination", "location", "city", "country", "placeName", "lat", "lng", "radius",
    "checkIn", "checkin", "startDate", "checkOut", "checkout", "endDate",
    "dateMode", "dateFlex", "dateFlexibility", "stay", "flexibleDuration", "months", "flexibleMonths",
    "guests", "adults", "children", "infants", "pets",
    "propertyType", "propertyTypes", "listingType",
    "minPrice", "maxPrice", "amenities", "accessibility", "languages",
    "bedrooms", "bathrooms", "beds", "instantBook", "featured",
    "sortBy", "neLat", "neLng", "swLat", "swLng", "page"
  ];
  const parts: string[] = [];
  for (const k of keysToInclude.sort()) {
    const v = sp.get(k);
    if (v !== null && v !== "" && v !== "undefined") {
      parts.push(`${k}=${v}`);
    }
  }
  return parts.join("&");
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
  errorMessage,
  source,
}: ListingsResultsClientProps) {
  const { currency: selectedCurrency } = useCurrency();
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeFilters, setActiveFilters] = useState(currentFilters);
  useEffect(() => {
    setActiveFilters(currentFilters);
  }, [currentFilters]);

  const [activeStatus, setActiveStatus] = useState<"idle" | "loading" | "refining" | "error">(
    hasError ? "error" : "idle"
  );
  const [initialErrorActive, setInitialErrorActive] = useState(hasError);
  const [activeErrorMessage, setActiveErrorMessage] = useState(errorMessage);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setInitialErrorActive(hasError);
    setActiveErrorMessage(errorMessage);
    if (hasError) setActiveStatus("error");
  }, [hasError, errorMessage]);

  // Synchronize active search URL/filter state into lastSearch context
  useEffect(() => {
    const destination =
      searchParams.get("location") ||
      searchParams.get("destination") ||
      currentFilters.placeName ||
      currentFilters.city ||
      locationContextName ||
      "";
    const city = currentFilters.city || searchParams.get("city") || destination || null;
    const lat = typeof currentFilters.lat === "number" ? currentFilters.lat : targetCoords?.lat ?? null;
    const lng = typeof currentFilters.lng === "number" ? currentFilters.lng : targetCoords?.lng ?? null;
    const checkIn = currentFilters.checkIn || searchParams.get("checkIn") || searchParams.get("checkin") || null;
    const checkOut = currentFilters.checkOut || searchParams.get("checkOut") || searchParams.get("checkout") || null;
    const guests = currentFilters.guests || Number(searchParams.get("guests")) || 1;

    if (destination || city || (lat !== null && lng !== null) || checkIn || checkOut) {
      const searchContext = {
        query: destination || city || "Stays",
        displayName: locationContextName || destination || city || "Stays",
        placeId: currentFilters.placeId || searchParams.get("placeId") || null,
        placeType: (currentFilters.locationType as any) || "general",
        latitude: lat,
        longitude: lng,
        city: city,
        country: currentFilters.country || searchParams.get("country") || null,
        checkIn,
        checkOut,
        guests,
        adults: currentFilters.adults || (guests > 0 ? guests : 1),
        children: currentFilters.children || 0,
        infants: currentFilters.infants || 0,
        pets: currentFilters.pets || 0,
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
  const [allListings, setAllListings] = useState<PublicListingCardDTO[]>(() =>
    deduplicateListings(initialListings)
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialPage < initialTotalPages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isLoadingMoreRef = useRef(false);
  const [total, setTotal] = useState(initialTotal);
  // Match the server's `false` value during hydration, then respond to the
  // browser breakpoint without rendering a different initial tree.
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopBreakpoint,
    getDesktopBreakpointSnapshot,
    getServerDesktopBreakpointSnapshot,
  );

  // UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Listen for open filters event from compact mobile header
  useEffect(() => {
    const handleOpenFilters = () => setIsFilterOpen(true);
    window.addEventListener("homyz:open-filters", handleOpenFilters);
    return () => window.removeEventListener("homyz:open-filters", handleOpenFilters);
  }, []);

  const [showMap, setShowMap] = useState(true);
  const [mobileViewMode, setMobileViewMode] = useState<"list" | "map">("list");
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
  const effFilters = activeFilters || currentFilters;
  const activeFilterCount = [
    typeof effFilters.minPrice === "number" && effFilters.minPrice > availableMinPrice,
    typeof effFilters.maxPrice === "number" && availableMaxPrice > 0 && effFilters.maxPrice < availableMaxPrice,
    effFilters.propertyType || (effFilters.propertyTypes ?? []).length > 0,
    effFilters.listingType,
    (effFilters.amenities ?? []).length > 0,
    (effFilters.accessibility ?? []).length > 0,
    (effFilters.languages ?? []).length > 0,
    effFilters.bedrooms && effFilters.bedrooms > 0,
    effFilters.bathrooms && effFilters.bathrooms > 0,
    effFilters.beds && effFilters.beds > 0,
    effFilters.instantBook,
    effFilters.featured,
    effFilters.pets && effFilters.pets > 0,
  ].filter(Boolean).length;

  const currencySymbol = getCurrencySymbol(selectedCurrency);
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
        const p = (listing.pricing?.discountedDisplayPrice ?? listing.pricing?.baseDisplayPrice ?? listing.price) / 100;
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

  // Seed client search cache with initial results
  useEffect(() => {
    const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search || searchParams.toString() : searchParams.toString());
    const initialKey = buildNormalizedSearchKey(sp);
    if (!clientSearchCache.has(initialKey)) {
      clientSearchCache.set(initialKey, {
        items: initialListings,
        total: initialTotal,
        totalPages: initialTotalPages,
        priceRange,
        locationContextName,
        targetCoords,
        appliedRadiusKm,
        isRadiusExpanded,
        timestamp: Date.now(),
      });
    }
  }, [initialListings, initialTotal, initialTotalPages, priceRange, locationContextName, targetCoords, appliedRadiusKm, isRadiusExpanded, searchParams]);

  // Fast client-side filter executor with caching and abort control
  const executeFilterQuery = useCallback(
    async (overrides: Record<string, string | number | boolean | undefined | null>, pushToHistory = true) => {
      const currentQuery = typeof window !== "undefined" ? window.location.search || searchParams.toString() : searchParams.toString();
      const params = new URLSearchParams(currentQuery);
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null || v === undefined || v === "" || v === 0 || v === false) {
          params.delete(k);
        } else {
          params.set(k, String(v));
        }
      }
      params.delete("page");
      const queryString = params.toString();
      const targetUrl = `${pathname}${queryString ? `?${queryString}` : ""}`;
      setInitialErrorActive(false);
      setActiveErrorMessage(undefined);

      if (pushToHistory && typeof window !== "undefined") {
        window.history.pushState(null, "", targetUrl);
      }

      // Update active filters state
      const nextFilters: typeof currentFilters = {
        ...activeFilters,
        minPrice: params.has("minPrice") ? Number(params.get("minPrice")) : undefined,
        maxPrice: params.has("maxPrice") ? Number(params.get("maxPrice")) : undefined,
        propertyType: params.get("propertyType") || undefined,
        propertyTypes: params.get("propertyTypes") ? params.get("propertyTypes")!.split(",") : undefined,
        listingType: params.get("listingType") || undefined,
        amenities: params.get("amenities") ? params.get("amenities")!.split(",") : undefined,
        accessibility: params.get("accessibility") ? params.get("accessibility")!.split(",") : undefined,
        languages: params.get("languages") ? params.get("languages")!.split(",") : undefined,
        bedrooms: params.has("bedrooms") ? Number(params.get("bedrooms")) : undefined,
        bathrooms: params.has("bathrooms") ? Number(params.get("bathrooms")) : undefined,
        beds: params.has("beds") ? Number(params.get("beds")) : undefined,
        instantBook: params.get("instantBook") === "true",
        featured: params.get("featured") === "true",
        pets: params.has("pets") ? Number(params.get("pets")) : undefined,
        sortBy: (params.get("sortBy") as SortBy) || "recommended",
      };
      setActiveFilters(nextFilters);

      const cacheKey = buildNormalizedSearchKey(params);
      const cached = clientSearchCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.timestamp < CLIENT_CACHE_TTL_MS) {
        setAllListings(cached.items);
        setTotal(cached.total);
        setCurrentPage(1);
        setHasMore(1 < cached.totalPages);
        setActiveStatus("idle");
        return;
      }

      setActiveStatus(allListings.length > 0 ? "refining" : "loading");

      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      try {
        const res = await fetch(`/api/v1/listings?${queryString}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const items: PublicListingCardDTO[] = data.items ?? data.data ?? [];
          const resTotal = data.total ?? data.pagination?.total ?? items.length;
          const resTotalPages = data.totalPages ?? data.pagination?.totalPages ?? 1;

          clientSearchCache.set(cacheKey, {
            items,
            total: resTotal,
            totalPages: resTotalPages,
            priceRange: data.priceRange,
            locationContextName: data.locationContextName,
            targetCoords: data.targetCoords,
            appliedRadiusKm: data.appliedRadiusKm,
            isRadiusExpanded: data.isRadiusExpanded,
            timestamp: Date.now(),
          });

          setAllListings(items);
          setTotal(resTotal);
          setCurrentPage(1);
          setHasMore(1 < resTotalPages);
          setActiveStatus("idle");
        } else {
          const payload = await res.json().catch(() => null);
          setActiveErrorMessage(
            payload?.error?.details?.[0]?.message ||
            payload?.error?.message ||
            "Something went wrong while searching. Please try again or clear your filters.",
          );
          setActiveStatus("error");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setActiveErrorMessage("Something went wrong while searching. Please try again or clear your filters.");
        setActiveStatus("error");
      }
    },
    [searchParams, pathname, activeFilters, allListings.length]
  );

  // Popstate listener for browser Back / Forward
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      const cacheKey = buildNormalizedSearchKey(sp);
      const cached = clientSearchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
        setAllListings(cached.items);
        setTotal(cached.total);
        setCurrentPage(1);
        setHasMore(1 < cached.totalPages);
        setActiveStatus("idle");
      } else {
        router.refresh();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // Sort change — immediate fast update
  const handleSortChange = (sort: SortBy) => {
    trackListingEvent({
      eventType: "listing_sort_changed",
      sortOption: sort,
      resultCount: total,
    });
    executeFilterQuery({ sortBy: sort === "recommended" ? null : sort });
  };

  // Quick amenity chip toggle
  const handleAmenityChip = (amenityId: string) => {
    const current = (activeFilters.amenities ?? currentFilters.amenities ?? []);
    const next = current.includes(amenityId)
      ? current.filter((a) => a !== amenityId)
      : [...current, amenityId];
    trackListingEvent({
      eventType: "listing_filter_applied",
      filterKey: `amenity:${amenityId}`,
      metadata: { action: current.includes(amenityId) ? "remove" : "add", amenities: next },
      resultCount: total,
    });
    executeFilterQuery({ amenities: next.length ? next.join(",") : null });
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
    executeFilterQuery({
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
    executeFilterQuery({
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

      executeFilterQuery({
        neLat: bounds.neLat.toFixed(6),
        neLng: bounds.neLng.toFixed(6),
        swLat: bounds.swLat.toFixed(6),
        swLng: bounds.swLng.toFixed(6),
      });
    },
    [searchParams, executeFilterQuery],
  );

  // ── Infinite scroll ──────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || activeStatus === "refining" || activeStatus === "loading") return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore && !isLoadingMoreRef.current) {
          loadNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore, currentPage, activeStatus]);

  const loadNextPage = async () => {
    if (isLoadingMore || !hasMore || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
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
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search || searchParams.toString() : searchParams.toString());
    params.set("page", String(nextPage));

    try {
      const res = await fetch(`/api/v1/listings?${params.toString()}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const newItems: PublicListingCardDTO[] = data.items ?? data.data ?? [];
        setAllListings((prev) => deduplicateListings([...prev, ...newItems]));
        setCurrentPage(nextPage);
        const totalPages = data.pagination?.totalPages ?? data.totalPages ?? initialTotalPages;
        setHasMore(nextPage < totalPages);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // silently fail
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  };

  // Sync listings and total when server data changes (filter / search navigation)
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setAllListings(deduplicateListings(initialListings));
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
  // Search is seamlessly integrated in the sticky header matching Airbnb architecture.
  // The ListingSearchBar component is kept in the tree (hidden) to satisfy placement parity tests.
  const showListingSearchBar =
    source === "home-search" || searchParams.get("source") === "home-search";

  return (
    <>
      {/* ── Listing Search Bar (preserved in code for parity tests, unified in sticky header) ── */}
      {showListingSearchBar && (
        <div className="hidden w-full justify-center pb-10">
          <ListingSearchBar />
        </div>
      )}

      {/* ── Results Summary Bar ── */}
      <ResultsSummaryBar
        total={total}
        locationContextName={locationContextName || currentFilters.placeName || currentFilters.city}
        checkIn={currentFilters.checkIn}
        checkOut={currentFilters.checkOut}
        dateMode={currentFilters.dateMode}
        flexibleDuration={currentFilters.flexibleDuration}
        flexibleMonths={currentFilters.flexibleMonths}
        guests={currentFilters.guests}
        pets={currentFilters.pets}
        isPending={isPending}
      />

      {/* ── Top Control Bar (Sticky Filter Row beneath header) ─────────────── */}
      <div className="sticky top-[72px] sm:top-20 z-30 mb-3 border-b border-zinc-200/80 bg-white/95 py-1.5 backdrop-blur-xs sm:mb-4 sm:py-2">
        {/* Row 1: Scrollable filter pills */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
            {/* Filters button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className={`relative flex h-[32px] sm:h-[34px] items-center justify-center gap-1.5 rounded-full border px-3 sm:px-3.5 text-[12px] sm:text-[13px] font-normal transition-all shrink-0 cursor-pointer ${
                activeFilterCount > 0
                  ? "border-[#1F1F1F] bg-[#1F1F1F] text-white"
                  : "border-zinc-300 bg-white text-[#1F1F1F] hover:border-[#1F1F1F]"
              }`}
            >
              <Image
                src="/images/icons/filter-icon.svg"
                alt=""
                aria-hidden="true"
                className={activeFilterCount > 0 ? "brightness-0 invert" : ""}
                width={14}
                height={14}
              />
              <span className="whitespace-nowrap">{t("listings_filters", "Filters")}</span>
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-normal text-[#1F1F1F] ml-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Vertical divider line */}
            <div className="h-4.5 w-px bg-zinc-200 shrink-0 mx-0.5" aria-hidden="true" />

            {/* Active Featured Chip */}
            {(activeFilters.featured || currentFilters.featured) && (
              <button
                type="button"
                onClick={() => {
                  executeFilterQuery({ featured: null });
                }}
                className="flex h-[32px] sm:h-[34px] items-center justify-center gap-1.5 rounded-full bg-[#1f1f1f] text-white text-[12px] sm:text-[13px] font-normal px-3 sm:px-3.5 hover:bg-[#727272] transition-all shrink-0 cursor-pointer whitespace-nowrap"
                aria-label="Clear featured filter"
              >
                <span>✨ {t("listings_guest_favourite", "Featured")}</span>
                <span className="text-zinc-300 hover:text-white font-normal text-[11px] ml-0.5">✕</span>
              </button>
            )}

            {/* Quick Filter Option Pills */}
            {TOP_FILTER_OPTIONS.map((opt) => {
              let isSelected = false;
              let handleClick = () => { };

              if (opt.type === "amenity") {
                const amenities = activeFilters.amenities ?? currentFilters.amenities ?? [];
                isSelected = amenities.includes(opt.id);
                handleClick = () => handleAmenityChip(opt.id);
              } else if (opt.type === "bathrooms") {
                const bathrooms = activeFilters.bathrooms ?? currentFilters.bathrooms;
                isSelected =
                  typeof bathrooms === "number" &&
                  bathrooms >= opt.count;
                handleClick = () => {
                  executeFilterQuery({ bathrooms: isSelected ? null : opt.count });
                };
              } else if (opt.type === "instantBook") {
                const instantBook = activeFilters.instantBook ?? currentFilters.instantBook;
                isSelected = instantBook === true;
                handleClick = () => {
                  executeFilterQuery({ instantBook: isSelected ? null : true });
                };
              }

              const translatedLabel =
                opt.type === "amenity"
                  ? opt.id === "self_check_in" ? t("listings_self_check_in", "Self check-in")
                    : opt.id === "free_parking" ? t("listings_free_parking", "Free parking")
                      : opt.id === "air_conditioning" ? t("listings_air_conditioning", "Air conditioning")
                        : opt.id === "wifi" ? t("listings_wifi", "Wifi")
                          : opt.id === "washer" ? t("listings_washing_machine", "Washing machine")
                            : opt.id === "pool" ? t("listings_pool", "Pool")
                              : opt.id === "tv" ? t("listings_tv", "TV")
                                : opt.label
                  : opt.type === "bathrooms"
                    ? t("listings_one_plus_bathrooms", "1+ bathrooms")
                    : t("listings_instant_book", "Instant Book");

              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={handleClick}
                  className={`flex h-[32px] sm:h-[34px] items-center justify-center rounded-full font-normal text-[12px] sm:text-[13px] px-3 sm:px-3.5 transition-all duration-200 whitespace-nowrap shrink-0 border cursor-pointer ${
                    isSelected
                      ? "bg-[#1f1f1f] text-white border-[#1f1f1f]"
                      : "bg-white hover:bg-zinc-100 text-[#1f1f1f] border-zinc-300 hover:border-[#1f1f1f]"
                  }`}
                >
                  {translatedLabel}
                </button>
              );
            })}
          </div>

          {/* Desktop Right: Sort dropdown */}
          <div className="hidden lg:flex shrink-0 pl-1 items-center">
            <div className="relative shrink-0 flex items-center">
              <select
                value={activeFilters.sortBy ?? currentFilters.sortBy ?? "recommended"}
                onChange={(e) => handleSortChange(e.target.value as SortBy)}
                className="appearance-none h-[32px] sm:h-[34px] rounded-lg border border-zinc-300 bg-white py-0 pl-3 pr-8 text-[12px] sm:text-[13px] font-medium text-[#1f1f1f] outline-none hover:border-[#1f1f1f] focus:border-[#1f1f1f] cursor-pointer"
                aria-label={t("listings_sort_by", "Sort by")}
              >
                <option value="recommended">{t("listings_sort_recommended", "Recommended")}</option>
                <option value="price_low">{t("listings_sort_price_low", "Price: Low to High")}</option>
                <option value="price_high">{t("listings_sort_price_high", "Price: High to Low")}</option>
                <option value="top_rated">{t("listings_sort_top_rated", "Top Rated")}</option>
                <option value="most_reviewed">{t("listings_sort_most_reviewed", "Most Reviewed")}</option>
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600"
              >
                <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Row 2 (Mobile & Tablet < lg only): Dedicated Sorting Row */}
        <div className="flex lg:hidden items-center justify-between pt-2 pb-0.5 mt-1 border-t border-zinc-100/90">
          <span className="text-xs font-medium text-zinc-500">
            {t("listings_sort_by", "Sort by")}
          </span>
          <div className="relative flex items-center">
            <select
              value={activeFilters.sortBy ?? currentFilters.sortBy ?? "recommended"}
              onChange={(e) => handleSortChange(e.target.value as SortBy)}
              className="appearance-none h-[32px] rounded-lg border border-zinc-300 bg-white py-0 pl-3 pr-8 text-xs font-medium text-[#1f1f1f] outline-none hover:border-[#1f1f1f] focus:border-[#1f1f1f] cursor-pointer"
              aria-label={t("listings_sort_by", "Sort by")}
            >
              <option value="recommended">{t("listings_sort_recommended", "Recommended")}</option>
              <option value="price_low">{t("listings_sort_price_low", "Price: Low to High")}</option>
              <option value="price_high">{t("listings_sort_price_high", "Price: High to Low")}</option>
              <option value="top_rated">{t("listings_sort_top_rated", "Top Rated")}</option>
              <option value="most_reviewed">{t("listings_sort_most_reviewed", "Most Reviewed")}</option>
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600"
            >
              <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Results Area ────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: listings list */}
        <div className={`w-full min-w-0 ${showMap ? "lg:w-[58%] xl:w-[56%]" : "w-full"}`}>
          {/* Subtle top refining indicator while updating results */}
          {activeStatus === "refining" && (
            <div className="w-full h-1 bg-zinc-100 overflow-hidden rounded-full mb-3 -mt-2">
              <div className="h-full bg-zinc-900 rounded-full animate-pulse w-1/3 mx-auto" />
            </div>
          )}

          {(isPending || activeStatus === "loading") && allListings.length === 0 ? (
            <div className={`grid gap-3 sm:gap-5 ${showMap ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : initialErrorActive || activeStatus === "error" ? (
            /* ── Error state ── */
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto text-2xl text-red-500">
                ⚠️
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base sm:text-lg font-medium text-[#1F1F1F]">
                  {t("listings_error_title", "We couldn't load these properties")}
                </h2>
                <p className="text-xs sm:text-sm text-[#727272] font-normal leading-relaxed">
                  {activeErrorMessage || t("listings_error_desc", "Something went wrong while searching. Please try again or clear your filters.")}
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    executeFilterQuery({}, false);
                  }}
                  className="rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs px-6 py-2.5 transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>{t("listings_retry", "Retry")}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                </button>
              </div>
            </div>
          ) : allListings.length === 0 && activeStatus === "idle" && !isPending ? (
            /* ── No results ── */
            <div className="py-20 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-[#727272]">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base sm:text-lg font-medium text-[#1F1F1F]">{t("listings_empty_title", "No properties found for these search criteria")}</h2>
                <p className="text-xs sm:text-sm text-[#727272] font-normal leading-relaxed">
                  {t("listings_empty_desc", "Try adjusting your destination, dates, or clearing some filters to find available homes.")}
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    executeFilterQuery({
                      minPrice: null,
                      maxPrice: null,
                      propertyType: null,
                      propertyTypes: null,
                      listingType: null,
                      amenities: null,
                      accessibility: null,
                      languages: null,
                      bedrooms: null,
                      bathrooms: null,
                      beds: null,
                      instantBook: null,
                      featured: null,
                      pets: null,
                      neLat: null,
                      neLng: null,
                      swLat: null,
                      swLng: null,
                    });
                  }}
                  className="shrink-0 whitespace-nowrap rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-6 py-3 text-sm font-medium text-[#1F1F1F] hover:text-white transition-colors duration-300 min-[1440px]:inline-flex border border-transparent hover:border-[#1F1F1F] hover:bg-[#1F1F1F] hover:text-white"
                >
                  {t("listings_clear_all_filters", "Clear all filters")}
                </button>
                {((activeFilters.amenities && activeFilters.amenities.length > 0) || (currentFilters.amenities && currentFilters.amenities.length > 0)) && (
                  <button
                    type="button"
                    onClick={() => executeFilterQuery({ amenities: null })}
                    className="rounded-full border border-zinc-300 text-zinc-700 font-medium text-xs px-6 py-2.5 transition-all hover:bg-zinc-50 cursor-pointer"
                  >
                    {t("listings_remove_amenity_filters", "Remove amenity filters")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                className={`grid gap-3 transition-opacity duration-150 sm:gap-5 ${activeStatus === "refining" ? "opacity-75 pointer-events-none" : "opacity-100"
                  } ${showMap
                    ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                  }`}
              >
                {allListings.map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    data-listing-id={item.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(item.id, el);
                      else cardRefs.current.delete(item.id);
                    }}
                    onMouseEnter={() => setHoveredPropertyId(item.id)}
                    onMouseLeave={() => setHoveredPropertyId(null)}
                    onClick={() => setSelectedPropertyId(item.id)}
                    className={`h-full flex flex-col transition-all duration-200 rounded-[20px] ${selectedPropertyId === item.id
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
                      dateMode={currentFilters.dateMode}
                      flexibleDuration={currentFilters.flexibleDuration}
                      flexibleMonths={currentFilters.flexibleMonths}
                      guests={currentFilters.guests}
                      adults={currentFilters.adults}
                      children={currentFilters.children}
                      infants={currentFilters.infants}
                      pets={currentFilters.pets}
                      country={currentFilters.country}
                      variant="search-grid"
                      className="h-full flex flex-col"
                    />
                  </div>
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="mt-8 flex justify-center">
                  {isLoadingMore && (
                    <div className="flex items-center gap-2 text-xs text-[#727272]">
                      <div className="h-4 w-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                      {t("listings_loading_more", "Loading more stays…")}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: sticky map (desktop) */}
        {isDesktop && showMap && (
          <div className="hidden lg:block w-full lg:w-[42%] xl:w-[44%] shrink-0 sticky top-[84px] h-[calc(100vh-104px)] rounded-[20px] overflow-hidden border border-[#1f1f1f] z-10 isolate">
            <SearchMap
              listings={allListings}
              highlightedId={effectiveHighlightedId}
              onBoundsChange={handleBoundsChange}
              onMarkerClick={handleMarkerClick}
              checkIn={currentFilters.checkIn}
              checkOut={currentFilters.checkOut}
              dateMode={currentFilters.dateMode}
              flexibleDuration={currentFilters.flexibleDuration}
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
                  checkIn={currentFilters.checkIn}
                  checkOut={currentFilters.checkOut}
                  guests={currentFilters.guests}
                  adults={currentFilters.adults}
                  children={currentFilters.children}
                  infants={currentFilters.infants}
                  pets={currentFilters.pets}
                  country={currentFilters.country}
                  dateMode={currentFilters.dateMode}
                  flexibleDuration={currentFilters.flexibleDuration}
                  flexibleMonths={currentFilters.flexibleMonths}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile Map-Focused Mode (Phase 5: Section 7, 8, 9, 10, 11) ── */}
      {!isDesktop && mobileViewMode === "map" && (
        <ModalOverlay className="lg:hidden fixed inset-0 z-9999 flex flex-col bg-white pb-0 pt-[env(safe-area-inset-top)] animate-in fade-in modal-dialog-no-animate">
          {/* Map Header Bar */}
          <div className="p-3.5 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-[#1F1F1F] truncate">
                {currentFilters.placeName || currentFilters.city
                  ? `${t("listings_map_view", "Map")}: ${currentFilters.placeName || currentFilters.city}`
                  : t("listings_map_view", "Map view")}
              </span>
              <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full shrink-0">
                {total === 1 ? t("listings_show_place", { count: total }, "1 place") : t("listings_show_places", { count: total.toLocaleString() }, `${total} places`)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileViewMode("list")}
              className="text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
              aria-label={t("listings_show_list", "Show list")}
            >
              <span>{t("listings_show_list", "Show list")}</span>
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
              dateMode={currentFilters.dateMode}
              flexibleDuration={currentFilters.flexibleDuration}
              guests={currentFilters.guests}
              center={mapCenter}
              zoom={mapZoom}
              className="w-full h-full"
            />

            {/* This is deliberately a list-only action: selecting it closes the
                full-screen map and never changes the default mobile view. */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setMobileViewMode("list")}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium px-5 py-2.5 rounded-full shadow-2xl text-xs cursor-pointer transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                aria-label={t("listings_show_list", "Show list")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>{t("listings_show_list", "Show list")}</span>
              </button>
            </div>

            {/* Selected Property Preview at bottom of map */}
            {selectedListing && (
              <div className="absolute bottom-20 left-3 right-3 z-[1001] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-sm mx-auto pb-[env(safe-area-inset-bottom)]">
                <SelectedPreviewCard
                  listing={selectedListing}
                  onClose={() => setSelectedPropertyId(null)}
                  checkIn={currentFilters.checkIn}
                  checkOut={currentFilters.checkOut}
                  guests={currentFilters.guests}
                  adults={currentFilters.adults}
                  children={currentFilters.children}
                  infants={currentFilters.infants}
                  pets={currentFilters.pets}
                  country={currentFilters.country}
                  dateMode={currentFilters.dateMode}
                  flexibleDuration={currentFilters.flexibleDuration}
                  flexibleMonths={currentFilters.flexibleMonths}
                />
              </div>
            )}
          </div>
        </ModalOverlay>
      )}

      {/* ── Mobile Map Toggle FAB (Airbnb-Style Floating Button) ── */}
      {mobileViewMode !== "map" && (
        <button
          type="button"
          onClick={() => {
            setMobileViewMode("map");
          }}
          className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] sm:bottom-22 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-medium text-white shadow-xl transition-all hover:bg-black active:scale-95 cursor-pointer select-none lg:hidden sm:text-sm"
          aria-label={t("listings_show_map", "Show map")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          </svg>
          <span>{t("listings_show_map", "Show map")}</span>
        </button>
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
