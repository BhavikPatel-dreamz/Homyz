"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface PropertyCardData {
  id: string;
  name: string;
  subtitle?: string;
  price: string | number;
  rating?: string | number | null;
  badge?: "guest_favorite" | "superhost" | "featured" | null;
  imageUrl?: string | null;
  city?: string | null;
  country?: string | null;
  guests?: number;
  propertyType?: string | null;
}

export function PropertyCard({
  id,
  name,
  subtitle,
  price,
  rating,
  badge,
  imageUrl,
  city,
  country,
  guests,
  propertyType,
}: PropertyCardData) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const formattedPrice =
    typeof price === "number" ? `SAR ${Math.round(price / 100)}` : price;

  const displaySubtitle =
    subtitle ||
    (city ? `${city}${country ? `, ${country}` : ""}` : country || "Saudi Arabia");

  const displayImage = imageUrl && !imageError ? imageUrl : null;

  return (
    <Link
      href={`/listings/${id}`}
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

        {/* Real Badge (Only if real) */}
        {badge === "featured" && (
          <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-medium text-zinc-900 shadow-xs border border-white/60">
            Featured
          </span>
        )}

        {badge === "guest_favorite" && (
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
            Guest favorite
          </span>
        )}

        {badge === "superhost" && (
          <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 inline-flex items-center rounded-full bg-[#eca7b0] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10.5px] sm:text-xs font-normal text-white shadow-xs">
            Superhost
          </span>
        )}

        {/* Heart Favorite Button */}
        <button
          type="button"
          aria-label="Save property"
          onClick={toggleFavorite}
          className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white/70 backdrop-blur-xs text-[#1f1f1f] transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xs"
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
        <h3 className="truncate text-[13.5px] sm:text-base font-medium text-[#1f1f1f] leading-snug">
          {name || "Untitled stay"}
        </h3>
        <p className="truncate text-[11px] sm:text-xs font-normal text-zinc-500 leading-normal mt-0.5 sm:mt-1">
          {displaySubtitle}
        </p>
        <div className="flex items-center justify-between text-[11px] sm:text-xs font-normal text-[#1f1f1f] leading-normal mt-0.5 whitespace-nowrap truncate">
          <span className="font-semibold">{formattedPrice}</span>
          {/* Rating only displayed if genuine rating exists */}
          {rating && Number(rating) > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 text-amber-500"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {Number(rating).toFixed(1)}
            </span>
          ) : (
            <span className="text-[10px] text-zinc-400 font-normal">
              {propertyType || "Stay"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

