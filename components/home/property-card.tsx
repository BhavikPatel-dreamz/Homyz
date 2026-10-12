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
import { getPrimaryListingBadge } from "@/lib/listings/card-badge";

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

  const primaryBadge = getPrimaryListingBadge({ isGuestFavorite, isSuperhost });
  const showFeatured = primaryBadge === null && badge === "featured";
  const targetHref = href || `/listings/${slug || id}`;

  return (
    <Link
      href={targetHref}
      className="group block cursor-pointer overflow-hidden rounded-[20px] border border-zinc-200 bg-white transition-all duration-200"
    >
      <div className="relative aspect-[233/246] w-full overflow-hidden bg-zinc-100">
        {displayImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name || "Property photo"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={displayImage}
            onError={() => setImageError(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#727272] bg-zinc-50">
            <span className="text-3xl mb-1">🏡</span>
            <span className="text-xs font-medium text-[#727272]">Photo preview</span>
          </div>
        )}

        {/* Badges: Only rendered when qualified by backend formula */}
        {(primaryBadge || showFeatured) && (
          <div className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 z-20 flex flex-wrap items-center gap-1.5 max-w-[calc(100%-4.25rem)] pointer-events-none">
            {primaryBadge === "guest_favorite" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ECA7B0] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-medium text-white shadow-xs backdrop-blur-md h-[26px]">
                {t("home_guest_favorite") || "Guest favorite"}
              </span>
            )}

            {primaryBadge === "superhost" && (
              <span className="inline-flex items-center rounded-full bg-[#1F1F1F]/80 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-medium text-white shadow-xs h-[26px]">
                {t("home_superhost") || "Superhost"}
              </span>
            )}

            {showFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/60 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-medium text-[#1F1F1F] shadow-xs border border-white/60 h-[26px]">
                {t("home_featured")}
              </span>
            )}
          </div>
        )}


        {/* Heart Favorite Button (reusable) */}
        <WishlistButton listingId={id} className="right-2.5 top-2.5 sm:right-3 sm:top-3 h-6 w-6 sm:h-7 sm:w-7" />
      </div>

      <div className="px-3 py-2.5 sm:px-3.5 sm:py-3 text-[#1f1f1f]">
        {/* Clickable Property Name */}
        <h3 className="truncate text-[13.5px] sm:text-base font-medium text-[#1f1f1f] leading-snug group-hover:text-amber-950 transition-colors">
          {name || "Untitled stay"}
        </h3>
        {alternativeDates ? (
          <p className="truncate text-[11px] sm:text-xs font-medium text-amber-800 bg-amber-50/90 border border-amber-200/60 px-1.5 py-0.5 rounded-sm mt-0.5 sm:mt-1 inline-block">
            🗓️ {alternativeDates}
          </p>
        ) : (
          <p className="truncate text-[11px] sm:text-xs font-normal text-[#727272] leading-normal mt-0.5 sm:mt-1">
            {displaySubtitle}
          </p>
        )}
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-normal text-[#1f1f1f] leading-normal mt-0.5 whitespace-nowrap truncate">
          {/* Price per night */}
          {cardPricing.hasDiscount && cardPricing.discountedDisplayPrice != null ? (
            <span className="font-semibold text-[#1F1F1F] flex items-baseline gap-1">
              <span className="line-through text-[#727272] font-normal text-[10px] sm:text-[11px]">
                {formatPrice(cardPricing.baseDisplayPrice, currency)}
              </span>
              <span>{formatPrice(cardPricing.discountedDisplayPrice, currency)}</span>
              <span className="font-normal text-[#727272] text-[11px] sm:text-xs"> / night</span>
            </span>
          ) : (
            <span className="font-semibold text-[#1F1F1F]">
              {formattedPrice}
              <span className="font-normal text-[#727272] text-[11px] sm:text-xs"> / night</span>
            </span>
          )}


          {/* Rating: Star icon + average rating + review count (zero fake ratings) */}
          {numericRating !== null ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 shrink-0">
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
                  <span className="text-[#727272] font-normal"> ({resolvedReviews})</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="text-[10px] text-[#727272] font-normal">
              {guests ? t("home_up_to_guests", { count: guests }) : propertyType || "Stay"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
