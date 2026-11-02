"use client";

import React, { useState, memo } from "react";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import Link from "next/link";
import { useCurrency } from "@/lib/currency-context";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  toPropertyCardPricingViewModel,
  type PropertyCardPricingViewModel,
} from "@/lib/booking/property-card-pricing";
import { SuperhostBadge } from "@/components/badges/superhost-badge";

export interface PropertyCardData {
  id: string;
  slug?: string | null;
  name: string;
  image?: string | null;
  imageUrl?: string | null;
  subtitle?: string;
  pricePerNight?: number | string | null;
  price?: string | number;
  currency?: string;
  isFavorite?: boolean;
  initialFavorite?: boolean;
  canFavorite?: boolean;
  isGuestFavorite?: boolean;
  isSuperhost?: boolean;
  badge?: "guest_favorite" | "superhost" | "featured" | null;
  averageRating?: number | string | null;
  rating?: string | number | null;
  reviewCount?: number | null;
  reviewsCount?: number | null;
  city?: string | null;
  country?: string | null;
  guests?: number;
  propertyType?: string | null;
  alternativeDates?: string | null;
  discounts?: unknown;
  isNewListing?: boolean;
  createdAt?: string | Date | null;
  pricing?: PropertyCardPricingViewModel;
  href?: string;
  priority?: boolean;
}

function PropertyCardComponent({
  id,
  slug,
  name,
  image,
  imageUrl,
  subtitle,
  pricePerNight,
  price,
  rating,
  averageRating,
  reviewCount,
  reviewsCount,
  badge,
  isGuestFavorite,
  isSuperhost,
  city,
  country,
  guests,
  propertyType,
  currency,
  alternativeDates,
  discounts,
  isNewListing,
  createdAt,
  pricing: propPricing,
  href,
  priority,
}: PropertyCardData) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [imageError, setImageError] = useState(false);

  const rawPrice = pricePerNight ?? price;
  const formattedPrice =
    typeof rawPrice === "number" ? formatPrice(rawPrice, currency) : rawPrice;

  const cardPricing =
    propPricing ??
    toPropertyCardPricingViewModel(
      {
        id,
        price: typeof rawPrice === "number" ? rawPrice : Number(rawPrice) || 0,
        country,
        discounts,
        isNewListing,
        createdAt,
      },
      {
        currency,
      },
    );

  const displaySubtitle =
    subtitle ||
    (city ? `${city}${country ? `, ${country}` : ""}` : country || "Location unavailable");

  const rawImage = image || imageUrl;
  const displayImage = rawImage && !imageError ? rawImage : null;

  // Rating resolution
  const resolvedRating = averageRating ?? rating;
  const numericRating =
    resolvedRating != null && !isNaN(Number(resolvedRating)) && Number(resolvedRating) > 0
      ? Number(resolvedRating)
      : null;
  const resolvedReviews = reviewCount ?? reviewsCount ?? null;

  // Guest Favorite belongs to the listing while Superhost belongs to its
  // authoritative host. They are independent recognitions, so render both
  // when both persisted flags are present.
  const showGuestFavorite = isGuestFavorite === true;
  const showSuperhost = isSuperhost === true;
  const showFeatured = !showGuestFavorite && !showSuperhost && badge === "featured";
  const targetHref = href || `/listings/${slug || id}`;

  return (
    <Link
      href={targetHref}
      className="group block h-full cursor-pointer bg-transparent transition-all duration-200"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-zinc-100 sm:rounded-[20px]">
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name || "Property photo"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={displayImage}
            onError={() => setImageError(true)}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...(priority ? ({ fetchPriority: "high" } as any) : {})}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#727272] bg-zinc-50">
            <span className="text-3xl mb-1">🏡</span>
            <span className="text-xs font-medium text-[#727272]">Photo preview</span>
          </div>
        )}

        {/* Badges: Only rendered when qualified by backend formula */}
        {(showGuestFavorite || showSuperhost || showFeatured) && (
          <div className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[calc(100%-3rem)] flex-wrap items-center gap-1 sm:left-3 sm:top-3">
            {showGuestFavorite && (
              <span className="inline-flex h-7 items-center rounded-full bg-white/95 px-2.5 text-[10px] font-medium text-[#1F1F1F] shadow-xs backdrop-blur-sm sm:px-3 sm:text-xs">
                {t("home_guest_favorite") || "Guest favorite"}
              </span>
            )}

            {showSuperhost && (
              <SuperhostBadge
                active
                compact
                label={t("home_superhost") || "Superhost"}
                className="h-[26px] border-0 bg-[#1F1F1F]/80 px-2 py-0.5 text-[10.5px] font-medium text-white shadow-xs backdrop-blur-md sm:px-2.5 sm:py-1 sm:text-xs"
              />
            )}

            {showFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-medium text-[#1F1F1F] shadow-xs border border-white/60 h-[26px]">
                {t("home_featured")}
              </span>
            )}
          </div>
        )}


        {/* Heart Favorite Button (reusable) */}
        <WishlistButton listingId={id} className="right-1.5 top-1.5 h-9 w-9 sm:right-2 sm:top-2" />
      </div>

      <div className="px-0.5 pt-2 text-[#1f1f1f] sm:px-1 sm:pt-2.5">
        {/* Clickable Property Name */}
        <h3 className="truncate text-[13px] font-medium leading-[1.25] text-[#1f1f1f] transition-colors group-hover:text-amber-950 sm:text-sm">
          {name || "Untitled stay"}
        </h3>
        {alternativeDates ? (
          <p className="mt-1 inline-block truncate rounded-sm border border-amber-200/60 bg-amber-50/90 px-1.5 py-0.5 text-[10px] font-normal text-amber-800 sm:text-xs">
            🗓️ {alternativeDates}
          </p>
        ) : (
          <p className="mt-1 truncate text-[11px] font-normal leading-normal text-[#727272] sm:text-xs">
            {displaySubtitle}
          </p>
        )}
        <div className="mt-1 min-w-0 text-[11px] font-normal leading-normal text-[#1f1f1f] sm:text-xs">
          {/* Price per night */}
          {cardPricing.hasDiscount && cardPricing.discountedDisplayPrice != null ? (
            <span className="flex min-w-0 items-baseline gap-1 truncate font-normal text-[#1F1F1F]">
              <span className="line-through text-[#727272] font-normal text-[10px] sm:text-xs leading-4">
                {formatPrice(cardPricing.baseDisplayPrice, currency)}
              </span>
              <span className="font-medium">{formatPrice(cardPricing.discountedDisplayPrice, currency)}</span>
              <span className="font-normal text-[#1f1f1f] text-[10px] sm:text-xs leading-4"> / night</span>
            </span>
          ) : (
            <span className="block truncate font-normal text-[#1F1F1F]">
              <span className="font-medium">{formattedPrice}</span>
              <span className="font-normal text-[#1f1f1f] text-[10px] sm:text-xs leading-4"> / night</span>
            </span>
          )}


          {/* Rating: Star icon + average rating + review count (zero fake ratings) */}
          {numericRating !== null ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-normal text-[#1f1f1f] sm:text-xs">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-amber-500"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>
                {numericRating.toFixed(1)}
                {resolvedReviews != null && resolvedReviews > 0 ? (
                  <span className="text-[#1f1f1f] font-normal"> ({resolvedReviews})</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="mt-1 block truncate text-[11px] font-normal text-[#727272] sm:text-xs">
              {guests ? t("home_up_to_guests", { count: guests }) : propertyType || "Stay"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
