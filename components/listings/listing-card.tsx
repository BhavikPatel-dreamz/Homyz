"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatListingPrice, getCurrencyForCountry } from "@/lib/currency";
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
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ListingCard({
  listing,
  className = "",
  targetLocationName,
  initialFavorite = false,
  showFavorite = true,
  priority = false,
}: ListingCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isFavoriting, setIsFavoriting] = useState(false);

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

  // ── Derived display values ──────────────────────────────────────────────────
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const coverPhoto = photos.length > 0 && !imageError ? photos[0] : null;

  const currency = getCurrencyForCountry(listing.country);
  const basePrice = typeof listing.price === "number" && isFinite(listing.price) ? listing.price : 0;

  // Discount parsing
  const rawDiscounts = (listing as { discounts?: unknown }).discounts as DiscountsJson | null | undefined;
  const weeklyPct = getDiscountPct(rawDiscounts?.weekly);
  const monthlyPct = getDiscountPct(rawDiscounts?.monthly);
  // Priority: weekly > monthly
  const activePct = weeklyPct ?? monthlyPct ?? null;
  const discountedPrice = activePct != null ? basePrice * (1 - activePct / 100) : null;

  const formattedBasePrice = formatListingPrice(basePrice, currency);
  const formattedDiscountedPrice =
    discountedPrice != null ? formatListingPrice(discountedPrice, currency) : null;

  const discountLabel =
    weeklyPct != null ? "Weekly discount" : monthlyPct != null ? "Monthly discount" : null;

  // Rating
  const numericRating =
    typeof listing.rating === "number" && listing.rating > 0 ? listing.rating : null;
  const reviewCount =
    typeof (listing as { reviewsCount?: number | null }).reviewsCount === "number"
      ? ((listing as { reviewsCount?: number | null }).reviewsCount as number)
      : 0;

  // Location
  const locationString = listing.city
    ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
    : listing.country || "";

  // Navigation target — prefer customSlug when available
  const slug = (listing as { customSlug?: string | null }).customSlug;
  const targetHref = `/listings/${slug || listing.id}`;

  // ── Favorite action ─────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFavoriting) return;

      const next = !isFavorite;
      setIsFavorite(next); // optimistic
      setIsFavoriting(true);

      trackListingEvent({
        eventType: next ? "favorite_add" : "favorite_remove",
        propertyId: listing.id,
      });

      try {
        const res = await fetch(`/api/v1/favorites/${listing.id}`, {
          method: next ? "POST" : "DELETE",
          credentials: "same-origin",
        });

        if (res.status === 401) {
          // Not authenticated — revert and redirect to login, preserving return URL
          setIsFavorite(!next);
          const returnUrl =
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : targetHref;
          router.push(`/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
          return;
        }

        if (!res.ok) {
          setIsFavorite(!next); // revert on any other error
          return;
        }

        // Broadcast to sync any other instances of the same card on page
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("homyz:favorite-changed", {
              detail: { listingId: listing.id, isFavorite: next },
            }),
          );
        }
      } catch {
        setIsFavorite(!next); // revert on network error
      } finally {
        setIsFavoriting(false);
      }
    },
    [listing.id, isFavorite, isFavoriting, targetHref, router],
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
      className={`group block overflow-hidden rounded-[22px] border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md transition-all duration-200 text-left ${className}`}
    >
      {/* ── Image ── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={listing.title || "Property photo"}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            {...(priority ? { fetchPriority: "high" as const } : {})}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-400">
            <span className="text-3xl mb-1" aria-hidden="true">🏡</span>
            <span className="text-xs font-medium text-zinc-400">No photo yet</span>
          </div>
        )}

        {/* Featured Badge */}
        {listing.isFeatured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-zinc-900 shadow-xs border border-white/60">
            Featured
          </span>
        )}

        {/* Guest Favorite / Superhost: Backend gap — isGuestFavorite and isSuperhost
            are NOT yet in PublicListingDTO (not in Prisma schema).
            These badges will be rendered here once the backend field is added. */}

        {/* Favorite Heart */}
        {showFavorite && (
          <button
            type="button"
            aria-label={
              isFavorite
                ? `Remove ${listing.title || "property"} from favorites`
                : `Save ${listing.title || "property"} to favorites`
            }
            aria-pressed={isFavorite}
            onClick={toggleFavorite}
            disabled={isFavoriting}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 backdrop-blur-xs text-zinc-800 transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xs disabled:opacity-60"
          >
            {isFavorite ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="#f43f5e"
                stroke="#f43f5e"
                strokeWidth="1.5"
                className="h-4 w-4 drop-shadow-xs"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-zinc-700"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── Card Body ── */}
      <div className="p-3.5 space-y-1">
        {/* Row 1: Title + Rating */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 truncate leading-snug group-hover:text-amber-950 transition-colors flex-1 min-w-0">
            {listing.title || "Untitled property"}
          </h3>

          {/* Rating (only when real data exists) */}
          {numericRating !== null ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 shrink-0">
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5 text-amber-500 fill-current"
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
            /* No reviews yet — show "New" label instead of fake 0.0 */
            <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full shrink-0">
              New
            </span>
          )}
        </div>

        {/* Row 2: Location + distance */}
        <p className="text-xs text-zinc-500 font-normal truncate">
          {locationString}
          {typeof listing.distanceKm === "number" && isFinite(listing.distanceKm)
            ? targetLocationName
              ? ` · ${listing.distanceKm} km from ${targetLocationName}`
              : ` · ${listing.distanceKm} km away`
            : ""}
        </p>

        {/* Row 3: Property type + guest capacity */}
        <p className="text-xs text-zinc-500 font-normal truncate">
          {listing.propertyType || "Home"} · {listing.guests ?? 1}{" "}
          {(listing.guests ?? 1) === 1 ? "guest" : "guests"}
        </p>

        {/* Row 4: Price (with discount if applicable) */}
        <div className="pt-1.5 space-y-0.5">
          {formattedDiscountedPrice != null ? (
            <>
              {/* Crossed-out original + active discounted price */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="line-through text-zinc-400 text-xs font-normal">
                  {formattedBasePrice}
                </span>
                <span className="font-semibold text-zinc-950 text-sm">
                  {formattedDiscountedPrice}
                  <span className="text-zinc-500 font-normal text-xs ml-0.5">/ night</span>
                </span>
              </div>
              {/* Discount label pill */}
              {discountLabel && (
                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 rounded-full">
                  {discountLabel} · {activePct}% off
                </span>
              )}
            </>
          ) : (
            /* No active discount — plain price */
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-zinc-950 text-sm">{formattedBasePrice}</span>
              <span className="text-zinc-500 font-normal text-xs">/ night</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
