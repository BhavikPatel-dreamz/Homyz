"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface SavedProperty {
  id: string;
  title: string;
  location: string;
  rating: number;
  reviewsCount: number;
  pricePerNight: number;
  image: string;
  category: string;
}

const INITIAL_SAVED_PROPERTIES: SavedProperty[] = [
  {
    id: "prop-1",
    title: "Villa Breeze Malibu",
    location: "Malibu, California",
    rating: 4.95,
    reviewsCount: 38,
    pricePerNight: 420,
    image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=600&q=80",
    category: "Beach",
  },
  {
    id: "prop-2",
    title: "Alpine Loft Haven",
    location: "Aspen, Colorado",
    rating: 4.92,
    reviewsCount: 24,
    pricePerNight: 350,
    image: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
    category: "Mountain",
  },
  {
    id: "prop-3",
    title: "Seaside Bungalow",
    location: "Miami Beach, Florida",
    rating: 4.88,
    reviewsCount: 52,
    pricePerNight: 280,
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80",
    category: "Beach",
  },
  {
    id: "prop-4",
    title: "Modern City Penthouse",
    location: "New York, NY",
    rating: 4.98,
    reviewsCount: 65,
    pricePerNight: 510,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80",
    category: "City",
  },
];

export function SavedListingsView() {
  const [properties, setProperties] = useState<SavedProperty[]>(INITIAL_SAVED_PROPERTIES);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const filteredProperties = properties.filter((p) => {
    if (categoryFilter === "ALL") return true;
    return p.category === categoryFilter;
  });

  const handleToggleHeart = (id: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:mb-8">
        <div>
          <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
            Saved Listings
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#727272] sm:text-base sm:leading-6">
            Properties and villas you have saved for upcoming getaways.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-full border border-[#D7D7D7] bg-[#F5F5F5] p-1 w-fit">
          {[
            { id: "ALL", label: `All (${properties.length})` },
            { id: "Beach", label: "Beach" },
            { id: "Mountain", label: "Mountain" },
            { id: "City", label: "City" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                categoryFilter === cat.id
                  ? "bg-white text-[#1F1F1F] shadow-2xs font-bold"
                  : "text-[#727272] hover:text-[#1F1F1F]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filteredProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 py-16 text-center my-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[#1F1F1F]">No saved listings here</h3>
          <p className="mt-1 text-xs text-[#727272] max-w-xs">
            Browse through our top destinations and save your dream villas by tapping the heart icon.
          </p>
          <Link
            href="/"
            className="mt-4 rounded-full bg-[#FCDF9C] px-5 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F7D37D] transition-colors"
          >
            Explore Listings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProperties.map((item) => (
            <article key={item.id} className="group flex flex-col">
              <div className="relative aspect-[288/256] w-full overflow-hidden rounded-[24px] border border-[#727272] bg-[#F5F3EE]">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Heart Unsave Button */}
                <button
                  type="button"
                  onClick={() => handleToggleHeart(item.id)}
                  aria-label={`Remove ${item.title} from saved listings`}
                  className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-xs transition-transform hover:scale-110 active:scale-95"
                >
                  <svg className="h-5 w-5 fill-rose-500 text-rose-500" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <h3 className="text-base font-semibold text-[#1F1F1F] truncate pr-2">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1 text-xs font-semibold text-[#1F1F1F] shrink-0">
                  <span>★</span>
                  <span>{item.rating}</span>
                </div>
              </div>

              <p className="mt-0.5 text-xs text-[#727272] truncate">
                {item.location}
              </p>

              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-sm font-semibold text-[#1F1F1F]">${item.pricePerNight}</span>
                <span className="text-xs text-[#727272]">/ night</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
