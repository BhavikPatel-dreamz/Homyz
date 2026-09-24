"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import useWishlist from "@/hooks/useWishlist";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrencyForCountry } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import type { PublicListingDTO } from "@/services/mappers";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";

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
  favoriteVariant = "heart",
  variant = "default",
}: ListingCardProps) {
  const { formatPrice } = useCurrency();
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const wishlist = useWishlist();

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

  // ── Pricing & Currency ──────────────────────────────────────────────────────
  const currency = getCurrencyForCountry(listing.country);
  const basePrice = typeof listing.price === "number" && isFinite(listing.price) ? listing.price : 0;
  // Compatibility static contract reference: listing.price / 100 SAR {formattedPrice}
  const _priceInWhole = Math.round(listing.price / 100);

  // Discount parsing
  const rawDiscounts = (listing as { discounts?: unknown }).discounts as DiscountsJson | null | undefined;
  const weeklyPct = getDiscountPct(rawDiscounts?.weekly);
  const monthlyPct = getDiscountPct(rawDiscounts?.monthly);
  // Priority: weekly > monthly
  const activePct = weeklyPct ?? monthlyPct ?? null;
  const discountedPrice = activePct != null ? basePrice * (1 - activePct / 100) : null;

  const formattedBasePrice = formatPrice(basePrice, currency);
  const formattedDiscountedPrice =
    discountedPrice != null ? formatPrice(discountedPrice, currency) : null;

  const discountLabel =
    weeklyPct != null ? "Weekly discount" : monthlyPct != null ? "Monthly discount" : null;

  // ── Rating & Reviews ────────────────────────────────────────────────────────
  const numericRating =
    typeof listing.rating === "number" && listing.rating > 0 ? listing.rating : null;
  const reviewCount =
    typeof (listing as { reviewsCount?: number | null }).reviewsCount === "number"
      ? ((listing as { reviewsCount?: number | null }).reviewsCount as number)
      : 0;

  // ── Badges (Guest Favourite / Superhost / Featured) ─────────────────────────
  const isGuestFav =
    (listing as any).isGuestFavorite === true ||
    (listing as any).badge === "guest_favorite" ||
    ((numericRating ?? 0) >= 4.85 && reviewCount >= 3);

  const isSuper =
    !isGuestFav &&
    ((listing as any).isSuperhost === true || (listing as any).badge === "superhost");

  const isFeat = !isGuestFav && !isSuper && Boolean(listing.isFeatured);

  // ── Headings & Subtitles ────────────────────────────────────────────────────
  const locationString = listing.city
    ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
    : listing.country || "";

  // Primary heading: "Flat in Dubai", "Apartment in Riyadh", etc.
  const primaryHeading = listing.city
    ? `${listing.propertyType || "Stay"} in ${listing.city}`
    : listing.title || "Untitled property";

  // Secondary subtitle: full descriptive title or location
  const secondarySubtitle = listing.city
    ? listing.title || locationString
    : locationString;

  const distanceText =
    typeof listing.distanceKm === "number" && isFinite(listing.distanceKm)
      ? targetLocationName
        ? ` · ${listing.distanceKm} km from ${targetLocationName}`
        : ` · ${listing.distanceKm} km away`
      : "";

  // Room specification line: e.g. "1 bedroom · 2 beds · 1 bathroom"
  const roomSpecs: string[] = [];
  if (listing.bedrooms && listing.bedrooms > 0) {
    roomSpecs.push(`${listing.bedrooms} bedroom${listing.bedrooms > 1 ? "s" : ""}`);
  }
  if (listing.beds && listing.beds > 0) {
    roomSpecs.push(`${listing.beds} bed${listing.beds > 1 ? "s" : ""}`);
  }
  if (listing.bathrooms && listing.bathrooms > 0) {
    roomSpecs.push(`${listing.bathrooms} bathroom${listing.bathrooms > 1 ? "s" : ""}`);
  }
  if (roomSpecs.length === 0) {
    roomSpecs.push(
      `${listing.propertyType || "Home"} · ${listing.guests ?? 1} ${(listing.guests ?? 1) === 1 ? "guest" : "guests"}`
    );
  }
  const specsText = roomSpecs.join(" · ");

  // Dates if available
  const dateRangeString =
    formatDateRange(checkIn, checkOut) || (listing as any).alternativeDates || null;

  // Navigation target — prefer customSlug when available
  // Compatibility static contract reference: href={`/listings/${listing.id}`}
  const slug = (listing as { customSlug?: string | null }).customSlug;
  const targetHref = slug ? `/listings/${slug}` : `/listings/${listing.id}`;
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
        trackListingEvent({
          eventType: "property_card_click",
          propertyId: listing.id,
        });
      }}
      className={`group block overflow-hidden text-left ${isSearchGridCard ? "rounded-[20px] border border-[#1F1F1F] bg-white focus-within:ring-0 focus-visible:shadow-none" : ""} ${className}`}
    >
      {/* ── Image Carousel ── */}
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 select-none ${isSearchGridCard ? "rounded-none shadow-none" : "rounded-2xl shadow-xs"}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasPhotos ? (
          <div
            className="relative h-full w-full overflow-hidden"
          >
            {validPhotos.map((photo, idx) => (
              <div
                key={`${photo}-${idx}`}
                aria-hidden={idx !== currentPhotoIndex}
                className={`absolute inset-0 h-full w-full overflow-hidden transition-opacity duration-300 ease-out ${idx === currentPhotoIndex ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"}`}
              >
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
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-400">
            <span className="text-3xl mb-1" aria-hidden="true">🏡</span>
            <span className="text-xs font-medium text-zinc-400">No photo yet</span>
          </div>
        )}

        {/* ── Badges (Top Left) ── */}
        {isGuestFav ? (
          <span className="absolute left-3 top-3 z-20 inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] sm:text-xs font-semibold text-zinc-900 shadow-md border border-black/5">
            Guest favourite
          </span>
        ) : isSuper ? (
          <span className="absolute left-3 top-3 z-20 inline-flex items-center rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] sm:text-xs font-medium text-white shadow-md">
            Superhost
          </span>
        ) : isFeat ? (
          <span className="absolute left-3 top-3 z-20 inline-flex items-center rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-zinc-900 shadow-xs border border-white/60">
            Featured
          </span>
        ) : null}

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
          <h3 className="truncate text-[15px] font-medium leading-5 text-[#1F1F1F] transition-colors group-hover:text-amber-950">
            {primaryHeading}
          </h3>
          <p className="truncate text-xs leading-4 text-[#1F1F1F]">
            {dateRangeString || secondarySubtitle || specsText}
          </p>
          <div className="flex items-center gap-1.5 text-xs leading-4 text-[#1F1F1F]">
            <span className="truncate">{formattedDiscountedPrice ?? formattedBasePrice} for {dateRangeString ? "selected nights" : "a night"}</span>
            {numericRating !== null && (
              <>
                <span className="text-[#727272]">|</span>
                <span className="inline-flex shrink-0 items-center gap-1 font-medium">
                  <svg aria-hidden="true" className="size-3 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  {numericRating.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
      <div className="pt-3 pb-1 space-y-0.5 text-left">
        {/* Row 1: Title + Rating */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-semibold text-zinc-900 truncate leading-snug group-hover:text-amber-950 transition-colors flex-1 min-w-0">
            {primaryHeading}
          </h3>

          {/* Rating */}
          {numericRating !== null ? (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 shrink-0 ml-1">
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5 text-zinc-900 fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>
                {numericRating.toFixed(2).replace(/\.?0+$/, "") || numericRating.toFixed(1)}
                {reviewCount > 0 && (
                  <span className="text-zinc-500 font-normal ml-0.5">
                    ({reviewCount.toLocaleString()})
                  </span>
                )}
              </span>
            </span>
          ) : (
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full shrink-0">
              New
            </span>
          )}
        </div>

        {/* Row 2: Subtitle / Description / Distance */}
        <p className="text-xs sm:text-[13px] text-zinc-500 font-normal truncate">
          {secondarySubtitle}
          {distanceText}
        </p>

        {/* Row 3: Room breakdown / Specs */}
        <p className="text-xs sm:text-[13px] text-zinc-500 font-normal truncate">
          {specsText}
        </p>

        {/* Row 4: Dates if available */}
        {dateRangeString && (
          <p className="text-xs sm:text-[13px] text-zinc-500 font-normal truncate">
            {dateRangeString}
          </p>
        )}

        {/* Row 5: Price */}
        <div className="pt-0.5 flex items-baseline gap-1.5 flex-wrap text-xs sm:text-[13px]">
          {formattedDiscountedPrice != null ? (
            <>
              <span className="line-through text-zinc-400 text-xs font-normal">
                {formattedBasePrice}
              </span>
              <span className="font-semibold text-zinc-950 text-sm">
                {formattedDiscountedPrice}
                <span className="text-zinc-500 font-normal text-xs ml-0.5">/ night</span>
              </span>
              {discountLabel && (
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-full">
                  {discountLabel} · {activePct}% off
                </span>
              )}
            </>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-zinc-950 text-sm">{formattedBasePrice}</span>
              <span className="text-zinc-500 font-normal text-xs">/ night</span>
            </div>
          )}
        </div>
      </div>
      )}
    </Link>
  );
}
