"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ListingCard } from "@/components/listings/listing-card";

type ListingSummary = React.ComponentProps<typeof ListingCard>["listing"];

export interface FavoriteItem {
  id: string;
  listingId: string;
  createdAt: string;
  listing: ListingSummary | null;
}

interface SavedListingsViewProps {
  initialFavorites?: FavoriteItem[];
}

export function SavedListingsView({ initialFavorites }: SavedListingsViewProps) {
  const [items, setItems] = useState<FavoriteItem[]>(initialFavorites || []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialFavorites);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Keep state in sync if SSR prop updates
  useEffect(() => {
    if (initialFavorites) {
      setItems(initialFavorites);
      setIsLoading(false);
    }
  }, [initialFavorites]);

  // Fetch latest favorites from API to guarantee freshly synced DB state
  const refreshFavorites = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/v1/favorites?include=cards", {
        signal,
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.items)) {
          setItems(data.items);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Failed to load wishlist items:", err);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // If we didn't receive initial server data, fetch immediately
    if (!initialFavorites) {
      const controller = new AbortController();
      refreshFavorites(controller.signal);
      return () => controller.abort();
    }
  }, [initialFavorites, refreshFavorites]);

  // Reactive listener: synchronize when a listing is favorited/unfavorited anywhere
  useEffect(() => {
    function onFavoriteChanged(e: Event) {
      const ev = e as CustomEvent<{ listingId: string; isFavorite: boolean; items?: FavoriteItem[] }>;
      if (!ev?.detail) return;

      if (Array.isArray(ev.detail.items)) {
        setItems(ev.detail.items);
      } else if (ev.detail.listingId) {
        if (!ev.detail.isFavorite) {
          setItems((prev) =>
            prev.filter((it) => it.listingId !== ev.detail.listingId && it.id !== ev.detail.listingId)
          );
        } else {
          refreshFavorites();
        }
      }
    }

    window.addEventListener("homyz:favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("homyz:favorite-changed", onFavoriteChanged);
  }, [refreshFavorites]);

  // Extract unique categories from saved listings
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const category = (item.listing as any)?.placeCategory || item.listing?.propertyType;
      if (category && typeof category === "string") {
        set.add(category);
      }
    });
    return Array.from(set);
  }, [items]);

  // Filter items based on active category
  const validItems = useMemo(() => {
    return items.filter((it): it is FavoriteItem & { listing: ListingSummary } => Boolean(it.listing));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (categoryFilter === "ALL") return validItems;
    return validItems.filter((item) => {
      const category = (item.listing as any)?.placeCategory || item.listing?.propertyType;
      return category?.toLowerCase() === categoryFilter.toLowerCase();
    });
  }, [validItems, categoryFilter]);

  const formatCategoryLabel = (category: string) =>
    category
      .replace(/[_-]/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="flex flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-7 rounded-[28px] border border-[#F2E3BF] bg-[#FFF9ED] px-5 py-5 sm:px-7 sm:py-6 xl:mb-9">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A6A12]">Your collection</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[26px] leading-[32px] font-medium tracking-[-0.03em] text-[#1F1F1F] sm:text-[32px] sm:leading-[38px] xl:text-[36px] xl:leading-[42px]">Wishlists</h2>
              {validItems.length > 0 && (
                <span className="inline-flex items-center rounded-full border border-[#F0CE81] bg-[#FCDF9C] px-3 py-1 text-xs font-semibold text-[#563B00]">
                  {validItems.length} {validItems.length === 1 ? "saved stay" : "saved stays"}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-5 text-[#6E6250] sm:text-base sm:leading-6">Properties and stays you have saved for upcoming getaways.</p>
          </div>

          {/* Category Filter Pills (if multiple categories available) */}
          {availableCategories.length > 0 && (
            <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] xl:mx-0 xl:overflow-visible">
              <div className="flex w-max items-center gap-1.5 rounded-2xl border border-[#E7D9BD] bg-white/80 p-1.5 shadow-[0_3px_12px_rgba(75,54,14,0.06)]">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("ALL")}
                  aria-pressed={categoryFilter === "ALL"}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A932] focus-visible:ring-offset-1 ${categoryFilter === "ALL" ? "bg-[#1F1F1F] text-white shadow-sm" : "text-[#6C6252] hover:bg-[#FFF4D9] hover:text-[#1F1F1F]"}`}
                >
                  All ({validItems.length})
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    aria-pressed={categoryFilter === cat}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A932] focus-visible:ring-offset-1 ${categoryFilter === cat ? "bg-[#1F1F1F] text-white shadow-sm" : "text-[#6C6252] hover:bg-[#FFF4D9] hover:text-[#1F1F1F]"}`}
                  >
                    {formatCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-3">
              <div className="aspect-[288/256] w-full rounded-2xl bg-zinc-200" />
              <div className="h-4 w-3/4 rounded bg-zinc-200" />
              <div className="h-3 w-1/2 rounded bg-zinc-200" />
              <div className="h-4 w-1/3 rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : validItems.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 py-16 text-center my-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 mb-4 shadow-xs">
            <svg className="w-8 h-8 fill-rose-500" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-[#1F1F1F]">Your wishlist is empty</h3>
          <p className="mt-1.5 text-sm text-[#727272] max-w-sm">
            As you search, tap the heart icon on any stay to save your favorite villas and properties here.
          </p>
          <Link
            href="/listings"
            className="mt-6 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-6 py-2.5 text-sm font-semibold text-[#1F1F1F] hover:text-white transition-colors shadow-2xs"
          >
            Explore stays
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Category Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 py-12 text-center my-4">
          <p className="text-sm font-medium text-[#1F1F1F]">No stays found under &ldquo;{categoryFilter}&rdquo;</p>
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className="mt-3 text-xs font-semibold text-amber-700 underline"
          >
            Show all saved stays
          </button>
        </div>
      ) : (
        /* Property Cards Grid */
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <div key={item.listingId || item.id} className="relative">
              <ListingCard
                listing={item.listing}
                initialFavorite={true}
                showFavorite={true}
                favoriteVariant="remove"
                className="h-full rounded-[22px] border border-[#EAE4D9] bg-white p-2 shadow-[0_5px_18px_rgba(31,31,31,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#E5C56F] hover:shadow-[0_14px_30px_rgba(91,68,24,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A932] focus-visible:ring-offset-2"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
