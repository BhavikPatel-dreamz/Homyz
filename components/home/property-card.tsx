"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface PropertyCardData {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  rating: string | number;
  badge?: "guest_favorite" | "superhost";
  imageUrl: string;
}

export function PropertyCard({
  id,
  name,
  subtitle,
  price,
  rating,
  badge = "guest_favorite",
  imageUrl,
}: PropertyCardData) {
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-2.5">
        <img
          alt={name || "Apartment interior"}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          src={imageUrl}
        />

        {/* Badge */}
        {badge === "guest_favorite" && (
          <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-[10px] font-semibold px-2 py-0.5 rounded-full text-gray-800 shadow-sm flex items-center gap-1">
            <i className="fa-solid fa-star text-amber-500 text-[8px]"></i> Guest favorite
          </span>
        )}

        {badge === "superhost" && (
          <span className="absolute top-2.5 left-2.5 bg-[#FDE2E4] text-[#E0245E] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Superhost
          </span>
        )}

        {/* Heart Favorite Button */}
        <button
          type="button"
          aria-label="Save property"
          onClick={toggleFavorite}
          className="absolute top-2.5 right-2.5 text-white drop-shadow hover:scale-110 transition cursor-pointer"
        >
          {isFavorite ? (
            <i className="fa-solid fa-heart text-lg text-rose-500 drop-shadow-md"></i>
          ) : (
            <i className="fa-regular fa-heart text-lg"></i>
          )}
        </button>
      </div>

      <h3 className="font-medium text-xs text-gray-900 truncate" title={name}>
        {name}
      </h3>
      <p className="text-[11px] text-gray-500 truncate" title={subtitle}>
        {subtitle}
      </p>

      <div className="flex items-center justify-between mt-1 text-xs">
        <span className="text-gray-900 font-semibold">{price}</span>
        <span className="flex items-center gap-1 text-[11px] text-gray-800">
          <i className="fa-solid fa-star text-[10px] text-black"></i> {rating}
        </span>
      </div>
    </div>
  );
}
