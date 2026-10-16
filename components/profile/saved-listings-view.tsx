"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ListingCard } from "@/components/listings/listing-card";
import { useLanguage } from "@/lib/i18n/language-context";

type ListingSummary = React.ComponentProps<typeof ListingCard>["listing"];

export interface FavoriteItem {
  id: string;
  listingId: string;
  createdAt: string;
  listing: ListingSummary | null;
}

interface SavedListingsViewProps {
  initialFavorites?: FavoriteItem[];
  initialTotal?: number;
}

export function SavedListingsView({ initialFavorites, initialTotal = 0 }: SavedListingsViewProps) {
  const { t } = useLanguage();
  const [items, setItems] = useState<FavoriteItem[]>(initialFavorites || []);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState<boolean>(!initialFavorites);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Keep state in sync if SSR prop updates
  useEffect(() => {
    if (initialFavorites) {
      setItems(initialFavorites);
      setTotal(initialTotal);
      setIsLoading(false);
    }
  }, [initialFavorites, initialTotal]);

  // Fetch latest favorites from API to guarantee freshly synced DB state
  const refreshFavorites = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/v1/favorites?include=cards&take=48", {
        signal,
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const payload = await res.json();
        const data = payload?.data ?? payload;
        if (Array.isArray(data?.items)) {
          setItems(data.items);
          setTotal(typeof data.total === "number" ? data.total : data.items.length);
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
          setTotal((current) => Math.max(0, current - 1));
        } else {
          refreshFavorites();
        }
      }
    }

    window.addEventListener("homyz:favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("homyz:favorite-changed", onFavoriteChanged);
  }, [refreshFavorites]);

  const loadMore = async () => {
    if (isLoadingMore || items.length >= total) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/favorites?include=cards&skip=${items.length}&take=48`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await res.json();
      const data = payload?.data ?? payload;
      if (!res.ok || !Array.isArray(data?.items)) {
        throw new Error(data?.error?.message || "Unable to load more saved stays.");
      }
      setItems((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...data.items.filter((item: FavoriteItem) => !knownIds.has(item.id))];
      });
      setTotal(typeof data.total === "number" ? data.total : total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load more saved stays.");
    } finally {
      setIsLoadingMore(false);
    }
  };

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

  return (
    <div className="flex min-w-0 w-full flex-col animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:flex-col lg:items-start 2xl:flex-row 2xl:items-start xl:mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] leading-[30px] font-medium tracking-[-0.02em] text-[#1F1F1F] sm:text-[28px] sm:leading-[36px] lg:text-[32px] lg:leading-[40px] xl:text-[36px] xl:leading-[44px]">
              {t("profile_saved_title", "Wishlists")}
            </h2>
            {validItems.length > 0 && (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {validItems.length === 1
                  ? t("profile_saved_count_one", { count: 1 }, "1 saved stay")
                  : t("profile_saved_count_many", { count: validItems.length }, `${validItems.length} saved stays`)}
              </span>
            )}
          </div>
        </div>

        {/* Category Filter Pills (if multiple categories available) */}
        {availableCategories.length > 0 && (
          <div className="flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-[#D7D7D7] bg-[#F5F5F5] p-1 sm:ml-4 sm:w-auto sm:max-w-[58%] lg:ml-0 lg:w-full lg:max-w-full 2xl:ml-4 2xl:w-auto 2xl:max-w-[58%]">
            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${categoryFilter === "ALL"
                ? "text-[#1f1f1f] bg-[#FCDF9C]"
                : "text-[#1f1f1f] bg-[#FCDF9C]"
                }`}
            >
              {t("profile_saved_all_filter", { count: validItems.length }, `All (${validItems.length})`)}
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all capitalize ${categoryFilter === cat
                  ? "bg-[#1F1F1F] text-[#fff] shadow-2xs"
                    : "text-[#727272] hover:text-[#1F1F1F]"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
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
          <h3 className="text-xl font-medium text-[#1F1F1F]">
            {t("profile_saved_empty_title", "Your wishlist is empty")}
          </h3>
          <p className="mt-1.5 text-sm text-[#727272] max-w-sm">
            {t("profile_saved_empty_desc", "As you search, tap the heart icon on any stay to save your favorite villas and properties here.")}
          </p>
          <Link
            href="/listings"
            className="mt-6 rounded-full bg-[#FCDF9C] hover:bg-[#1F1F1F] px-6 py-2.5 text-sm font-semibold text-[#1F1F1F] hover:text-white transition-colors shadow-2xs"
          >
            {t("profile_saved_explore_stays", "Explore stays")}
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Category Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 py-12 text-center my-4">
          <p className="text-sm font-medium text-[#1F1F1F]">
            {t("profile_saved_no_category_matches", { category: categoryFilter }, `No stays found under "${categoryFilter}"`)}
          </p>
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className="mt-3 text-xs font-semibold text-amber-700 underline"
          >
            {t("profile_saved_show_all", "Show all saved stays")}
          </button>
        </div>
      ) : (
        /* Property Cards Grid */
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.listingId || item.id} className="relative">
                <ListingCard
                  listing={item.listing}
                  initialFavorite={true}
                  showFavorite={true}
                  favoriteVariant="remove"
                />
              </div>
            ))}
          </div>
          {error && <p role="alert" className="mt-5 text-sm text-rose-700">{error}</p>}
          {categoryFilter === "ALL" && items.length < total && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="rounded-full border border-[#D7D7D7] bg-white px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] transition-colors hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore
                  ? t("profile_saved_loading_more" as any, "Loading...")
                  : t("profile_saved_load_more" as any, "Load more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
