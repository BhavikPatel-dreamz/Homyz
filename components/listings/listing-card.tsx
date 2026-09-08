"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PublicListingDTO } from "@/services/mappers";

export interface ListingCardProps {
  listing: PublicListingDTO | {
    id: string;
    title: string;
    city?: string | null;
    country?: string | null;
    price: number;
    photos?: string[];
    guests?: number;
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
    propertyType?: string | null;
    listingType?: string | null;
    isFeatured?: boolean;
    rating?: number | null;
    reviewsCount?: number;
  };
  className?: string;
}

export function ListingCard({ listing, className = "" }: ListingCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const coverPhoto = Array.isArray(listing.photos) && listing.photos.length > 0 && !imageError
    ? listing.photos[0]
    : null;

  const formattedPrice = Math.round(listing.price / 100);
  const locationString = listing.city
    ? `${listing.city}${listing.country ? `, ${listing.country}` : ""}`
    : listing.country || "Saudi Arabia";

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <Link
      href={`/listings/${listing.id}`}
      className={`group block overflow-hidden rounded-[22px] border border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md transition-all duration-200 text-left ${className}`}
    >
      {/* Media Aspect Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={listing.title || "Listing preview"}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-400">
            <span className="text-3xl mb-1">🏡</span>
            <span className="text-xs font-medium text-zinc-400">Photo preview</span>
          </div>
        )}

        {/* Real Featured Badge (Only if real) */}
        {listing.isFeatured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-zinc-900 shadow-xs border border-white/60">
            Featured
          </span>
        )}

        {/* Favorite Heart Button */}
        <button
          type="button"
          aria-label="Save to favorites"
          onClick={toggleFavorite}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/70 backdrop-blur-xs text-zinc-800 transition-transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xs"
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
      </div>

      {/* Card Body */}
      <div className="p-3.5 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 truncate group-hover:text-amber-950 transition-colors">
            {listing.title || "Untitled property"}
          </h3>
          {/* Rating only rendered if real numeric rating exists */}
          {typeof listing.rating === "number" && listing.rating > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 shrink-0">
              <svg className="w-3.5 h-3.5 text-amber-500 fill-current" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {listing.rating.toFixed(1)}
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-500 font-normal truncate">
          {locationString}
        </p>

        <p className="text-[11px] text-zinc-400 font-normal truncate">
          {listing.propertyType || "Home"} · {listing.guests || 1} {listing.guests === 1 ? "guest" : "guests"}
        </p>

        <div className="pt-1 flex items-baseline gap-1 text-xs">
          <span className="font-semibold text-zinc-950 text-sm">
            SAR {formattedPrice}
          </span>
          <span className="text-zinc-500 font-normal">/ night</span>
        </div>
      </div>
    </Link>
  );
}
