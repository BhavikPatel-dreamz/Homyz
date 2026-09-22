"use client";

import React, { useState, useEffect, memo } from "react";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import useWishlist from "@/hooks/useWishlist";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatListingPrice } from "@/lib/currency";
import { useLanguage } from "@/lib/i18n/language-context";

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
  isFavorite: propFavorite,
  initialFavorite = false,
  canFavorite = false,
  currency,
  alternativeDates,
}: PropertyCardData) {
  const { t } = useLanguage();
  const router = useRouter();
  const isAuthenticated = canFavorite;

  const [isFavorite, setIsFavorite] = useState(
    propFavorite !== undefined ? propFavorite : initialFavorite,
  );
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Sync state if prop changes from parent hydration
  useEffect(() => {
    if (propFavorite !== undefined) {
      setIsFavorite(propFavorite);
    }
  }, [propFavorite]);

  const wishlist = useWishlist();

  // Sync with centralized wishlist when loaded
  useEffect(() => {
    if (!wishlist) return;
    if (!wishlist.loading) {
      setIsFavorite(wishlist.has(id));
    }
  }, [wishlist, id, wishlist?.loading]);

  // Keep all duplicate card instances for this property in sync across the page
  useEffect(() => {
    function onFavoriteChanged(event: Event) {
      const customEvent = event as CustomEvent<{ listingId: string; isFavorite: boolean }>;
      if (customEvent.detail && customEvent.detail.listingId === id) {
        setIsFavorite(customEvent.detail.isFavorite);
      }
    }
    window.addEventListener("homyz:favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("homyz:favorite-changed", onFavoriteChanged);
  }, [id]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFavoriting) return;

    if (!isAuthenticated) {
      const currentUrl =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : `/listings/${slug || id}`;
      router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`);
      return;
    }

    const nextFavorite = !isFavorite;
    setIsFavoriting(true);
    setIsFavorite(nextFavorite);
    try {
      if (nextFavorite) {
        await wishlist.add(id);
      } else {
        await wishlist.remove(id);
      }
    } catch {
      setIsFavorite(!nextFavorite);
    } finally {
      setIsFavoriting(false);
    }
  };

  const rawPrice = pricePerNight ?? price;
  const formattedPrice =
    typeof rawPrice === "number" ? formatListingPrice(rawPrice, currency) : rawPrice;

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

  // Badge resolution: backend controlled formula
  const showGuestFavorite = isGuestFavorite ?? (badge === "guest_favorite");
  const showSuperhost = !showGuestFavorite && (isSuperhost ?? (badge === "superhost"));
  const showFeatured = !showGuestFavorite && !showSuperhost && badge === "featured";

  const targetHref = `/listings/${slug || id}`;

  return (
    <Link
      href={targetHref}
      className="group block cursor-pointer overflow-hidden rounded-[20px] sm:rounded-[22px] border border-zinc-200 bg-white hover:bg-[#FCDF9C]/30 hover:border-zinc-300 transition-all duration-200"
    >
      <div className="relative aspect-[233/246] w-full overflow-hidden bg-zinc-100">
        {displayImage ? (
          <img
            alt={name || "Property photo"}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            src={displayImage}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-50">
            <span className="text-3xl mb-1">🏡</span>
            <span className="text-xs font-medium text-zinc-400">Photo preview</span>
          </div>
        )}

        {/* Badges: Only rendered when qualified by backend formula */}
        {showFeatured && (
          <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-medium text-zinc-900 shadow-xs border border-white/60">
            {t("home_featured")}
          </span>
        )}

        {showGuestFavorite && (
          <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-normal text-[#1f1f1f] shadow-xs backdrop-blur-md">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="white"
              stroke="#eba900"
              strokeWidth="2"
              strokeLinejoin="round"
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {t("home_guest_favorite")}
          </span>
        )}

        {showSuperhost && (
          <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 inline-flex items-center rounded-full bg-[#eca7b0] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-normal text-white shadow-xs">
            {t("home_superhost")}
          </span>
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
          <p className="truncate text-[11px] sm:text-xs font-normal text-zinc-500 leading-normal mt-0.5 sm:mt-1">
            {displaySubtitle}
          </p>
        )}
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-normal text-[#1f1f1f] leading-normal mt-0.5 whitespace-nowrap truncate">
          {/* Price per night */}
          <span className="font-semibold text-zinc-900">
            {formattedPrice}
            <span className="font-normal text-zinc-500 text-[11px] sm:text-xs"> / night</span>
          </span>

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
                  <span className="text-zinc-500 font-normal"> ({resolvedReviews})</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="text-[10px] text-zinc-400 font-normal">
              {guests ? t("home_up_to_guests", { count: guests }) : propertyType || "Stay"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export const PropertyCard = memo(PropertyCardComponent);
