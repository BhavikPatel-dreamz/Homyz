"use client";

import React from "react";
import useWishlist from "@/hooks/useWishlist";

export function WishlistButton({ listingId, className = "" }: { listingId: string; className?: string }) {
  const wishlist = useWishlist();
  const isFavorite = wishlist?.has(listingId) ?? false;
  const isAdding = wishlist?.adding?.has(listingId) ?? false;
  const isRemoving = wishlist?.removeInFlight?.has(listingId) ?? false;
  const inFlight = isAdding || isRemoving;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inFlight) return;
    try {
      if (!isFavorite) {
        await wishlist.add(listingId);
      } else {
        await wishlist.remove(listingId);
      }
    } catch {
      // errors handled inside provider
    }
  };

  const aria = isFavorite ? "Remove from favorites" : "Save to favorites";

  return (
    <button
      type="button"
      aria-label={aria}
      aria-pressed={isFavorite}
      onClick={handleClick}
      disabled={inFlight}
      className={`absolute right-3 top-3 z-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-xs text-[#1f1f1f] transition-transform active:scale-95 cursor-pointer shadow-2xs disabled:opacity-60 ${className}`}
    >
      {isFavorite ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" strokeWidth="1.5" className="h-6 w-6 drop-shadow-md">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#1f1f1f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-[#1f1f1f] drop-shadow-xs">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )}
    </button>
  );
}

export default WishlistButton;
