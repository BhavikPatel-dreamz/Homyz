"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import useWishlist from "@/hooks/useWishlist";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PublicListingDTO } from "@/services/mappers";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import { buildListingDetailUrl, getLastSearch } from "@/lib/storage/client-history";
import {
  toPropertyCardPricingViewModel,
  type PropertyCardPricingViewModel,
} from "@/lib/booking/property-card-pricing";
import { getPrimaryListingBadge } from "@/lib/listings/card-badge";

import { propertyTypeLabel } from "@/lib/constants/listing-enums";

// ─── Discount Helpers ──────────────────────────────────────────────────────────
type DiscountEntry =
  | boolean
  | { discountType: string; discountPercentage: number };

interface DiscountsJson {
  weekly?: DiscountEntry;
  monthly?: DiscountEntry;
  new_listing?: DiscountEntry;
  last_minute?: DiscountEntry;
  [key: string]: DiscountEntry | undefined;
}
function getDiscountPct(entry?: DiscountEntry): number | null {
  if (!entry || typeof entry === "boolean") return null;

  if (
    typeof entry === "object" &&
    entry.discountType === "DISCOUNT" &&
    typeof entry.discountPercentage === "number" &&
    entry.discountPercentage > 0
  ) {
    return entry.discountPercentage;
  }
  return null;
}

// ─── Date Formatter Helper ───────────────────────────────────────────────────
function formatDateRange(checkIn?: string, checkOut?: string): string | null {
  if (!checkIn || !checkOut) return null;
  try {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return null;

    const inMonth = inDate.toLocaleString("en-US", { month: "short" });
    const outMonth = outDate.toLocaleString("en-US", { month: "short" });
    const inDay = inDate.getDate();
    const outDay = outDate.getDate();

    if (inMonth === outMonth) {
      return `${inDay}–${outDay} ${inMonth}`;
    }
    return `${inDay} ${inMonth} – ${outDay} ${outMonth}`;
  } catch {
    return null;
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface ListingCardProps {
  listing: PublicListingDTO | {
    id: string;
    title: string;
    city?: string | null;
    country?: string | null;
    price: number;
    photos?: string[] | null;
    guests?: number | null;
    bedrooms?: number | null;
    beds?: number | null;
    bathrooms?: number | null;
    propertyType?: string | null;
    listingType?: string | null;
    isFeatured?: boolean;
    rating?: number | null;
    reviewsCount?: number | null;
    distanceKm?: number | null;
    discounts?: unknown;
    customSlug?: string | null;
    isGuestFavorite?: boolean;
    isSuperhost?: boolean;
    badge?: string | null;
    alternativeDates?: string | null;
    pricing?: PropertyCardPricingViewModel;
  };
  className?: string;
  /** Optional contextual landmark / place name (e.g. "Burj Khalifa") */
  targetLocationName?: string;
  /** Whether this listing is already saved as a favorite (server-provided initial state). */
  initialFavorite?: boolean;
  /** Pass false to hide the heart button entirely (e.g., on admin pages). */
  showFavorite?: boolean;
  /** Pass true to prioritize loading for above-the-fold cards (LCP optimization) */
  priority?: boolean;
  /** Optional check-in date from search filters */
  checkIn?: string;
  /** Optional check-out date from search filters */
  checkOut?: string;
  /** Optional guest count from search filters */
  guests?: number;
  /** Optional adults count */
  adults?: number;
  /** Optional children count */
  children?: number;
  /** Optional pets count */
  pets?: number;
  /** Choose which favorite control to render: heart (toggle) or remove (cross) */
  favoriteVariant?: "heart" | "remove";
  /** Compact bordered card treatment used by the search-results grid. */
  variant?: "default" | "search-grid";
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ListingCard({
  listing,
  className = "",
  targetLocationName,
  initialFavorite = false,
  showFavorite = true,
  priority = false,
  checkIn,
  checkOut,
  guests,
  adults,
  children,
  pets,
  favoriteVariant = "heart",
  variant = "default",
}: ListingCardProps) {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const wishlist = useWishlist();

  // Reset navigation loading state when target URL or component changes
  useEffect(() => {
    setIsNavigating(false);
  }, [listing.id]);

  // Sync if parent passes a new initial state (e.g., after server re-render)
  useEffect(() => {
    setIsFavorite(initialFavorite);
  }, [initialFavorite]);

  // Broadcast sync: keep sibling card instances in sync across the page
  useEffect(() => {
    function onFavoriteChanged(event: Event) {
      const e = event as CustomEvent<{ listingId: string; isFavorite: boolean }>;
      if (e.detail?.listingId === listing.id) {
        setIsFavorite(e.detail.isFavorite);
      }
    }
    window.addEventListener("homyz:favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("homyz:favorite-changed", onFavoriteChanged);
  }, [listing.id]);

  // Sync with centralized wishlist when loaded
  useEffect(() => {
    if (!wishlist) return;
    if (!wishlist.loading) {
      setIsFavorite(wishlist.has(listing.id));
    }
  }, [wishlist, listing.id, wishlist?.loading]);

  // ── Multi-Photo Carousel State ─────────────────────────────────────────────
  const rawPhotos = Array.isArray(listing.photos)
    ? listing.photos.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());

  // Filter out any broken photo indices
  const validPhotos = rawPhotos.filter((_, idx) => !failedIndices.has(idx));
  const hasPhotos = validPhotos.length > 0;
  const hasMultiplePhotos = validPhotos.length > 1;

  // Touch gesture support for swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && currentPhotoIndex < validPhotos.length - 1) {
        setCurrentPhotoIndex((prev) => prev + 1);
      } else if (diff < 0 && currentPhotoIndex > 0) {
        setCurrentPhotoIndex((prev) => prev - 1);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentPhotoIndex((prev) => (prev < validPhotos.length - 1 ? prev + 1 : prev));
  };

  // ── Pricing & Currency (Phase 6 Central Card Pricing Adapter) ────────────────
  const currency = getCurrencyForCountry(listing.country);
  const storedBasePrice = typeof listing.price === "number" && isFinite(listing.price) ? listing.price : 0;
  // Compatibility static contract reference: listing.price / 100 SAR {formattedPrice}
  const _priceInWhole = Math.round(listing.price / 100);

  const serverPricing = "pricing" in listing ? listing.pricing : undefined;
  const cardPricing = serverPricing ?? toPropertyCardPricingViewModel(listing, {
      checkIn,
      checkOut,
      guests,
      currency,
    });
  const basePrice = cardPricing.baseDisplayPrice || storedBasePrice;

  const discountedPrice = cardPricing.hasDiscount ? cardPricing.discountedDisplayPrice : null;

  const formattedBasePrice = formatPrice(cardPricing.baseDisplayPrice, currency);
  const formattedDiscountedPrice =
    discountedPrice != null ? formatPrice(discountedPrice, currency) : null;

  // ── Rating & Reviews ────────────────────────────────────────────────────────
  const numericRating =
    typeof listing.rating === "number" && listing.rating > 0 ? listing.rating : null;
  const reviewCount =
    typeof (listing as { reviewsCount?: number | null }).reviewsCount === "number"
      ? ((listing as { reviewsCount?: number | null }).reviewsCount as number)
      : 0;

  // ── Badges (Guest Favourite / Superhost / Featured) ─────────────────────────
  // Qualification is evaluated strictly on the backend and persisted at the listing/host level.
  // The UI consumes only the persisted backend qualification state.
  const primaryBadge = getPrimaryListingBadge({
    isGuestFavorite: listing.isGuestFavorite,
    isSuperhost:
      listing.isSuperhost === true ||
      (listing as { host?: { isSuperhost?: boolean | null } | null }).host?.isSuperhost === true,
  });
  const isFeat = primaryBadge === null && Boolean(listing.isFeatured);

  // ── Headings & Subtitles ────────────────────────────────────────────────────
  const locationString = listing.city
    ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
    : listing.country || "";

  const formattedPropertyType = propertyTypeLabel(listing.propertyType, t);

  // Primary heading: "Flat in Dubai", "Apartment in Riyadh", etc.
  const primaryHeading = listing.city
    ? t("listings_stay_in", { propertyType: formattedPropertyType || t("home_search_where", undefined, "Stay"), city: listing.city }, `${formattedPropertyType || "Stay"} in ${listing.city}`)
    : listing.title || t("host_untitled_listing", "Untitled property");

  // Secondary subtitle: full descriptive title or location
  const secondarySubtitle = listing.city
    ? listing.title || locationString
    : locationString;

  const distanceText =
    typeof listing.distanceKm === "number" && isFinite(listing.distanceKm)
      ? targetLocationName
        ? t("listings_km_from", { distance: listing.distanceKm, location: targetLocationName }, ` · ${listing.distanceKm} km from ${targetLocationName}`)
        : t("listings_km_away", { distance: listing.distanceKm }, ` · ${listing.distanceKm} km away`)
      : "";

  // Room specification line: e.g. "1 bedroom · 2 beds · 1 bathroom"
  const roomSpecs: string[] = [];
  if (listing.bedrooms && listing.bedrooms > 0) {
    roomSpecs.push(listing.bedrooms === 1 ? t("listings_bedroom_one", { count: listing.bedrooms }, "1 bedroom") : t("listings_bedroom_many", { count: listing.bedrooms }, `${listing.bedrooms} bedrooms`));
  }
  if (listing.beds && listing.beds > 0) {
    roomSpecs.push(listing.beds === 1 ? t("listings_bed_one", { count: listing.beds }, "1 bed") : t("listings_bed_many", { count: listing.beds }, `${listing.beds} beds`));
  }
  if (listing.bathrooms && listing.bathrooms > 0) {
    roomSpecs.push(listing.bathrooms === 1 ? t("listings_bathroom_one", { count: listing.bathrooms }, "1 bathroom") : t("listings_bathroom_many", { count: listing.bathrooms }, `${listing.bathrooms} bathrooms`));
  }
  if (roomSpecs.length === 0) {
    const guestVal = listing.guests ?? 1;
    roomSpecs.push(
      `${formattedPropertyType || "Home"} · ${guestVal} ${guestVal === 1 ? t("home_guest_one", { count: guestVal }, "1 guest") : t("home_guest_many", { count: guestVal }, `${guestVal} guests`)}`
    );
  }
  const specsText = roomSpecs.join(" · ");

  // Dates if available
  const dateRangeString =
    formatDateRange(checkIn, checkOut) || (listing as any).alternativeDates || null;

  // Nights calculation (defaults to 2 nights like the Airbnb reference image)
  const nights = (() => {
    if (checkIn && checkOut) {
      const inDate = new Date(checkIn);
      const outDate = new Date(checkOut);
      const diff = Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0) return diff;
    }
    return 2;
  })();

  const totalPrice = (discountedPrice ?? basePrice) * nights;
  const baseTotalPrice = basePrice * nights;

  const hasFreeCancellation =
    (listing as any).cancellationPolicy !== "STRICT" &&
    (listing as any).cancellationPolicy !== "NON_REFUNDABLE";

  const formattedRating =
    numericRating !== null
      ? Number.isInteger(numericRating)
        ? `${numericRating}.0`
        : numericRating.toFixed(2).replace(/0$/, "")
      : null;

  // Navigation target — prefer customSlug when available
  // Compatibility static contract reference: href={`/listings/${listing.id}`}
  const slug = (listing as { customSlug?: string | null }).customSlug;
  const targetIdOrSlug = slug || listing.id;

  const [activeContext, setActiveContext] = useState(() => ({
    checkIn: checkIn || undefined,
    checkOut: checkOut || undefined,
    guests: guests || undefined,
    adults: adults || undefined,
    children: children || undefined,
    pets: pets || undefined,
  }));

  useEffect(() => {
    if (checkIn || checkOut || guests) {
      setActiveContext({
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        guests: guests || undefined,
        adults: adults || undefined,
        children: children || undefined,
        pets: pets || undefined,
      });
    } else {
      const last = getLastSearch();
      if (last && (last.checkIn || last.checkOut || last.guests)) {
        setActiveContext({
          checkIn: last.checkIn || undefined,
          checkOut: last.checkOut || undefined,
          guests: last.guests || undefined,
          adults: last.adults || undefined,
          children: last.children || undefined,
          pets: last.pets || undefined,
        });
      }
    }
  }, [checkIn, checkOut, guests, adults, children, pets]);

  const targetHref = buildListingDetailUrl(targetIdOrSlug, activeContext);
  const isSearchGridCard = variant === "search-grid";

  // ── Favorite Action ─────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFavoriting) return;

      const next = !isFavorite;
      setIsFavorite(next); // optimistic local update
      setIsFavoriting(true);

      trackListingEvent({
        eventType: next ? "favorite_add" : "favorite_remove",
        propertyId: listing.id,
      });

      try {
        // Calls /api/v1/favorites/ via centralized wishlist hook
        if (next) {
          await wishlist.add(listing.id);
        } else {
          await wishlist.remove(listing.id);
        }
      } catch {
        setIsFavorite(!next);
      } finally {
        setIsFavoriting(false);
      }
    },
    [listing.id, isFavorite, isFavoriting, wishlist],
  );

  const handleRemoveOnly = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFavoriting) return;

      setIsFavoriting(true);
      setIsFavorite(false);

      try {
        await wishlist.remove(listing.id);
      } catch {
        setIsFavorite(true);
      } finally {
        setIsFavoriting(false);
      }
    },
    [listing.id, isFavoriting, wishlist],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Link
      href={targetHref}
      aria-label={listing.title || "View property"}
      onClick={() => {
        setIsNavigating(true);
        trackListingEvent({
          eventType: "property_card_click",
          propertyId: listing.id,
        });
      }}
      className={`group relative block overflow-hidden text-left ${isNavigating ? "opacity-90 cursor-wait" : ""} ${isSearchGridCard ? "rounded-[20px] border border-[#1F1F1F] bg-white focus-within:ring-0 focus-visible:shadow-none" : ""} ${className}`}
    >
      {/* ── Navigation Loading Overlay ── */}
      {isNavigating && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 backdrop-blur-[1px] transition-all">
          <div className="flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 shadow-lg text-xs font-semibold text-zinc-900 border border-zinc-200">
            <div className="size-3.5 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      )}
      {/* ── Image Carousel ── */}
      <div
        className={`relative aspect-[4/4] w-full overflow-hidden bg-zinc-100 select-none ${isSearchGridCard ? "rounded-none shadow-none" : "rounded-2xl shadow-xs"}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasPhotos ? (
          <div
            className="relative h-full w-full overflow-hidden"
          >
            {validPhotos.map((photo, idx) => {
              const shouldRenderImage = idx === currentPhotoIndex || Math.abs(idx - currentPhotoIndex) <= 1;
              return (
                <div
                  key={`${photo}-${idx}`}
                  aria-hidden={idx !== currentPhotoIndex}
                  className={`absolute inset-0 h-full w-full overflow-hidden transition-opacity duration-300 ease-out ${idx === currentPhotoIndex ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}
                >
                  {shouldRenderImage ? (
                    <img
                      src={photo}
                      alt={listing.title || `Photo ${idx + 1}`}
                      onError={() => {
                        setFailedIndices((prev) => new Set(prev).add(idx));
                      }}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading={priority && idx === 0 ? "eager" : "lazy"}
                      decoding={priority && idx === 0 ? "sync" : "async"}
                      {...(priority && idx === 0 ? { fetchPriority: "high" as const } : {})}
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-100" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-[#727272]">
            <span className="text-3xl mb-1" aria-hidden="true">🏡</span>
            <span className="text-xs font-medium text-[#727272]">{t("listings_no_photo_yet", "No photo yet")}</span>
          </div>
        )}

        {/* ── Badges (Top Left) ── */}
        {(primaryBadge || isFeat) && (
          <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-4.5rem)] pointer-events-none">
            {primaryBadge === "guest_favorite" && (
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-[#1F1F1F] shadow-md border border-black/5">
                {t("listings_guest_favourite", "Guest favourite")}
              </span>
            )}
            {primaryBadge === "superhost" && (
              <span className="inline-flex items-center rounded-full bg-black/70 backdrop-blur-md px-2.5 py-1 text-[11px] sm:text-xs font-medium text-white shadow-md">
                {t("listings_superhost", "Superhost")}
              </span>
            )}
            {isFeat && (
              <span className="inline-flex items-center rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-[#1F1F1F] shadow-xs border border-white/60">
                {t("listings_featured_badge", "Featured")}
              </span>
            )}
          </div>
        )}

        {/* ── Favorite Button (Top Right) ── */}
        {showFavorite && (
          (favoriteVariant === "remove") ? (
            <button
              type="button"
              aria-label="Remove from wishlist"
              onClick={handleRemoveOnly}
              disabled={isFavoriting}
              className={`absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-xs text-[#1f1f1f] transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xs disabled:opacity-60`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#1f1f1f" strokeWidth="1.6" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          ) : (
            <WishlistButton
              listingId={listing.id}
              className={isSearchGridCard ? "!rounded-none !bg-transparent !shadow-none !backdrop-blur-none" : ""}
            />
          )
        )}

        {/* ── Prev / Next Navigation Arrows ── */}
        {hasMultiplePhotos && currentPhotoIndex > 0 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={handlePrev}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 backdrop-blur-xs"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {hasMultiplePhotos && currentPhotoIndex < validPhotos.length - 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={handleNext}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white text-zinc-800 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 backdrop-blur-xs"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* ── Dot Pagination Indicators ── */}
        {hasMultiplePhotos && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-1.5 pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {validPhotos.length <= 5 ? (
              validPhotos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to photo ${idx + 1}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPhotoIndex(idx);
                  }}
                  className={`rounded-full transition-all duration-200 cursor-pointer ${
                    idx === currentPhotoIndex
                      ? "h-1.5 w-1.5 bg-white scale-125 shadow-xs"
                      : "h-1.5 w-1.5 bg-white/60 hover:bg-white/80 shadow-xs"
                  }`}
                />
              ))
            ) : (
              // Dynamic 5-dot sliding window matching Airbnb
              (() => {
                const total = validPhotos.length;
                const windowSize = 5;
                const half = Math.floor(windowSize / 2);
                let start = currentPhotoIndex - half;
                if (start < 0) start = 0;
                if (start + windowSize > total) start = total - windowSize;

                const windowIndices = Array.from({ length: windowSize }, (_, i) => start + i);

                return windowIndices.map((idx, pos) => {
                  const isActive = idx === currentPhotoIndex;
                  const isEdge =
                    (pos === 0 && start > 0) ||
                    (pos === windowSize - 1 && start + windowSize < total);

                  return (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Go to photo ${idx + 1}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentPhotoIndex(idx);
                      }}
                      className={`rounded-full transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "h-1.5 w-1.5 bg-white scale-125 shadow-xs"
                          : isEdge
                          ? "h-1 w-1 bg-white/40 shadow-xs"
                          : "h-1.5 w-1.5 bg-white/65 hover:bg-white/85 shadow-xs"
                      }`}
                    />
                  );
                });
              })()
            )}
          </div>
        )}
      </div>

      {/* ── Search-results card body ── */}
      {isSearchGridCard ? (
        <div className="space-y-1.5 px-3.5 py-3 text-left sm:px-4 sm:py-3.5">
          {/* Row 1: Title & Rating */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-medium leading-5 text-[#1F1F1F] transition-colors group-hover:text-amber-950 flex-1 min-w-0">
              {primaryHeading}
            </h3>
            {numericRating !== null ? (
              <div className="flex items-center gap-1 text-xs font-medium text-[#1F1F1F] shrink-0 ml-1">
                <svg aria-hidden="true" className="size-3 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span>{formattedRating}</span>
                {reviewCount > 0 && <span className="font-normal text-[#727272]">({reviewCount})</span>}
              </div>
            ) : (
              <span className="text-[11px] font-medium text-[#727272] shrink-0">★ {t("listings_new", "New")}</span>
            )}
          </div>

          {/* Row 2: Subtitle / descriptive title */}
          {secondarySubtitle && (
            <p className="truncate text-xs leading-4 text-[#727272]">
              {secondarySubtitle}
            </p>
          )}

          {/* Row 3: Room breakdown / specs */}
          <p className="truncate text-xs leading-4 text-[#727272]">
            {specsText}
          </p>

          {/* Row 4: Price & Nights */}
          <div className="flex items-center gap-1.5 text-xs leading-4 text-[#1F1F1F] pt-0.5 flex-wrap">
            {discountedPrice != null ? (
              <>
                <span className="line-through text-[#727272] text-[11px] font-normal">
                  {formatPrice(baseTotalPrice, currency)}
                </span>
                <span className="font-semibold underline">
                  {formatPrice(totalPrice, currency)}
                </span>
                <span className="text-[#727272]">
                  for {nights} {nights === 1 ? "night" : "nights"}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold underline">
                  {formatPrice(totalPrice, currency)}
                </span>
                <span className="text-[#727272]">
                  for {nights} {nights === 1 ? "night" : "nights"}
                </span>
              </>
            )}
          </div>


          {/* Row 5: Free cancellation badge */}
          {hasFreeCancellation && (
            <div className="pt-0.5 flex items-center">
              <span className="inline-block text-[11px] font-normal text-[#727272] bg-zinc-100 px-2 py-0.5 rounded">
                {t("listings_free_cancellation", "Free cancellation")}
              </span>
            </div>
          )}
        </div>
      ) : (
      <div className="pt-3 pb-1 space-y-0.5 text-left">
        {/* Row 1: Title + Rating */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-semibold text-[#1F1F1F] truncate leading-snug group-hover:text-amber-950 transition-colors flex-1 min-w-0">
            {primaryHeading}
          </h3>

          {/* Rating */}
          {numericRating !== null ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1F1F1F] shrink-0 ml-1">
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5 text-[#1F1F1F] fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>
                {numericRating.toFixed(2).replace(/\.?0+$/, "") || numericRating.toFixed(1)}
                {reviewCount > 0 && (
                  <span className="text-[#727272] font-normal ml-0.5">
                    ({reviewCount.toLocaleString()})
                  </span>
                )}
              </span>
            </span>
          ) : (
                  <span className="text-[10px] font-medium text-[#727272] bg-[#F3F4F5] px-1.5 py-0.5 rounded-lg shrink-0 leading-3.5">
              {t("listings_new", "New")}
            </span>
          )}
        </div>

        {/* Row 2: Subtitle / Description / Distance */}
        <p className="text-xs sm:text-[13px] text-[#727272] font-normal truncate">
          {secondarySubtitle}
          {distanceText}
        </p>

        {/* Row 3: Room breakdown / Specs */}
        <p className="text-xs sm:text-[13px] text-[#727272] font-normal truncate">
          {specsText}
        </p>

        {/* Row 4: Dates if available */}
        {dateRangeString && (
          <p className="text-xs sm:text-[13px] text-[#727272] font-normal truncate">
            {dateRangeString}
          </p>
        )}

        {/* Row 5: Price */}
        <div className="pt-0.5 flex items-baseline gap-1.5 flex-wrap text-xs sm:text-[13px]">
          {formattedDiscountedPrice != null ? (
            <>
              <span className="line-through text-[#727272] text-xs font-normal">
                {formattedBasePrice}
              </span>
              <span className="font-semibold text-zinc-950 text-sm">
                {formattedDiscountedPrice}
                <span className="text-[#727272] font-normal text-xs ml-0.5">{t("listings_per_night", "/ night")}</span>
              </span>
            </>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-zinc-950 text-sm">{formattedBasePrice}</span>
              <span className="text-[#727272] font-normal text-xs">{t("listings_per_night", "/ night")}</span>
            </div>
          )}
        </div>
      </div>
      )}
    </Link>
  );
}
