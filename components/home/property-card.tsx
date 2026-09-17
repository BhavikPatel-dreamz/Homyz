"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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

export function PropertyCard({
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
  const { data: session } = useSession();
  const isAuthenticated = canFavorite || Boolean(session?.user);

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
    setIsFavorite(nextFavorite);
    setIsFavoriting(true);

    try {
      const response = await fetch(`/api/v1/favorites/${id}`, {
        method: nextFavorite ? "POST" : "DELETE",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        setIsFavorite(!nextFavorite);
        router.push(`/login?callbackUrl=${encodeURIComponent(`/listings/${slug || id}`)}`);
        return;
      }
      if (!response.ok) {
        setIsFavorite(!nextFavorite);
        return;
      }

      // Broadcast favorite change to keep any duplicate card instances in sync
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("homyz:favorite-changed", {
            detail: { listingId: id, isFavorite: nextFavorite },
          }),
        );
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

        {/* Heart Favorite Button */}
        <button
          type="button"
          aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
          aria-pressed={isFavorite}
          onClick={toggleFavorite}
          disabled={isFavoriting}
          className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white/70 backdrop-blur-xs text-[#1f1f1f] transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xs disabled:opacity-60"
        >
          {isFavorite ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="#f43f5e"
              stroke="#f43f5e"
              strokeWidth="1.5"
              className="h-4.5 w-4.5 sm:h-5 sm:w-5 drop-shadow-sm"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1f1f1f"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-[#1f1f1f] drop-shadow-xs"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </button>
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
