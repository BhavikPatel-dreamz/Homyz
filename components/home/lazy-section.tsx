"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { HomeSectionSkeleton } from "./home-section-skeleton";
import { HomePropertySection } from "./category-carousel";
import { PropertyCardData } from "./property-card";
import type { HomepageProperty, HomepageSection } from "@/services/homepage.service";
import type { SearchContext } from "@/lib/location/search-context";
import { buildListingDetailUrl, type PersistedSearchContext } from "@/lib/storage/client-history";

// Module-level in-memory cache to prevent refetching when scrolling back and forth
const sectionDataCache = new Map<
  string,
  {
    cards: PropertyCardData[];
    page: number;
    hasMore: boolean;
    totalCount: number;
  }
>();

// In-flight request de-duplication
const inFlightRequests = new Set<string>();

// Concurrency queue to throttle simultaneous background fetches (max 2 active requests)
let activeFetches = 0;
const MAX_CONCURRENT_FETCHES = 2;
const fetchQueue: Array<() => Promise<void>> = [];

function pumpFetchQueue() {
  while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length > 0) {
    const nextFetch = fetchQueue.shift();
    if (nextFetch) {
      activeFetches++;
      void nextFetch().finally(() => {
        activeFetches--;
        pumpFetchQueue();
      });
    }
  }
}

function queueFetch(fn: () => Promise<void>) {
  fetchQueue.push(fn);
  pumpFetchQueue();
}

export function mapPropertyToCard(
  property: HomepageProperty,
  activeContext?: SearchContext | PersistedSearchContext | null,
  canFavorite = false,
  isPriorityFirstCard = false,
): PropertyCardData {
  return {
    id: property.id,
    slug: property.slug,
    href: buildListingDetailUrl(property.id, activeContext),
    name: property.name || property.title,
    image: property.image || property.mainImage,
    imageUrl: property.imageUrl || property.mainImage,
    subtitle: [property.area, property.city].filter(Boolean).join(", ") || property.country || undefined,
    pricePerNight: property.pricePerNight ?? property.price,
    price: property.price,
    currency: property.currency,
    badge: property.badge,
    isGuestFavorite: property.isGuestFavorite,
    isSuperhost: property.isSuperhost,
    city: property.city,
    country: property.country,
    guests: property.maxGuests,
    propertyType: property.propertyType,
    averageRating: property.averageRating ?? property.rating ?? null,
    rating: property.rating ?? null,
    reviewCount: property.reviewCount ?? null,
    alternativeDates: property.alternativeDates,
    pricing: property.pricing,
    isFavorite: property.isFavorite ?? property.favoriteStatus,
    initialFavorite: property.favoriteStatus,
    canFavorite,
    priority: isPriorityFirstCard,
  };
}

export interface LazySectionProps {
  children?: React.ReactNode;
  priority?: boolean;
  section?: HomepageSection;
  initialCards?: PropertyCardData[];
  activeContext?: SearchContext | PersistedSearchContext | null;
  canFavorite?: boolean;
}

/**
 * Intelligent viewport-based lazy loader and horizontal progressive paginator.
 * Priority sections render immediately from SSR data.
 * Offscreen sections defer fetching until within 500px of viewport.
 * Horizontal carousel pagination loads next pages on scroll/next-click.
 */
export function LazySection({
  children,
  priority = false,
  section,
  initialCards,
  activeContext,
  canFavorite = false,
}: LazySectionProps) {
  // If no section prop provided, act as standard viewport lazy-renderer for arbitrary children
  if (!section) {
    return (
      <StandardLazySection priority={priority}>
        {children}
      </StandardLazySection>
    );
  }

  return (
    <ProgressivePropertySection
      section={section}
      priority={priority}
      initialCards={initialCards}
      activeContext={activeContext}
      canFavorite={canFavorite}
    />
  );
}

function StandardLazySection({
  children,
  priority = false,
}: {
  children: React.ReactNode;
  priority?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(
    () => priority || (typeof window !== "undefined" && typeof IntersectionObserver === "undefined"),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority || isVisible) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [priority, isVisible]);

  if (priority || isVisible) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="min-h-[340px]">
      <HomeSectionSkeleton count={5} />
    </div>
  );
}

function ProgressivePropertySection({
  section,
  priority = false,
  initialCards,
  activeContext,
  canFavorite = false,
}: {
  section: HomepageSection;
  priority?: boolean;
  initialCards?: PropertyCardData[];
  activeContext?: SearchContext | PersistedSearchContext | null;
  canFavorite?: boolean;
}) {
  const cached = sectionDataCache.get(section.id);
  const hasInitialCards = Boolean((initialCards && initialCards.length > 0) || (cached && cached.cards.length > 0));

  const [cards, setCards] = useState<PropertyCardData[]>(() => {
    if (cached) return cached.cards;
    if (initialCards && initialCards.length > 0) return initialCards;
    return [];
  });

  const [page, setPage] = useState<number>(() => cached?.page ?? 1);
  const [hasMore, setHasMore] = useState<boolean>(() => {
    if (cached) return cached.hasMore;
    if (initialCards && initialCards.length > 0) {
      return section.hasMore ?? (section.totalCount > initialCards.length);
    }
    return section.totalCount > 0;
  });

  const [isLoading, setIsLoading] = useState<boolean>(!hasInitialCards && !priority);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update cards if initialCards changes (e.g. from SSR)
  useEffect(() => {
    if (initialCards && initialCards.length > 0) {
      setCards(initialCards);
      setIsLoading(false);
    }
  }, [initialCards]);

  const fetchSectionPage = useCallback(
    async (pageToFetch: number, isSubsequent: boolean) => {
      const cacheKey = section.id;
      if (inFlightRequests.has(`${cacheKey}:${pageToFetch}`)) return;
      inFlightRequests.add(`${cacheKey}:${pageToFetch}`);

      if (isSubsequent) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setIsError(false);
      }

      try {
        const queryParams = new URLSearchParams();
        queryParams.set("page", String(pageToFetch));
        queryParams.set("limit", "8");
        if (activeContext?.city) queryParams.set("city", activeContext.city);
        if (activeContext?.displayName) queryParams.set("destination", activeContext.displayName);
        if (activeContext?.checkIn) queryParams.set("checkIn", activeContext.checkIn);
        if (activeContext?.checkOut) queryParams.set("checkOut", activeContext.checkOut);
        if (activeContext?.guests) queryParams.set("guests", String(activeContext.guests));

        const res = await fetch(`/api/v1/homepage/sections/${encodeURIComponent(section.id)}?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load section: ${res.status}`);
        }

        const json = await res.json();
        const incomingProperties: HomepageProperty[] = json?.data?.properties || [];
        const nextHasMore = Boolean(json?.data?.hasMore);
        const incomingCards = incomingProperties.map((p) =>
          mapPropertyToCard(p, activeContext, canFavorite, false),
        );

        if (!isMountedRef.current) return;

        setCards((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const fresh = incomingCards.filter((c) => !existingIds.has(c.id));
          const combined = isSubsequent ? [...prev, ...fresh] : incomingCards;
          sectionDataCache.set(cacheKey, {
            cards: combined,
            page: pageToFetch,
            hasMore: nextHasMore,
            totalCount: json?.data?.totalCount ?? section.totalCount,
          });
          return combined;
        });

        setPage(pageToFetch);
        setHasMore(nextHasMore);
      } catch (err) {
        console.error(`[LazySection] Error loading section ${section.id}:`, err);
        if (isMountedRef.current && !isSubsequent) {
          setIsError(true);
        }
      } finally {
        inFlightRequests.delete(`${cacheKey}:${pageToFetch}`);
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [section.id, section.totalCount, activeContext, canFavorite],
  );

  // Viewport intersection observer for vertical lazy loading
  useEffect(() => {
    // If cards are already present or priority, no need to observe for initial load
    if (cards.length > 0 || priority) {
      setIsLoading(false);
      return;
    }

    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      void fetchSectionPage(1, false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          queueFetch(() => fetchSectionPage(1, false));
        }
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [cards.length, priority, fetchSectionPage]);

  // Horizontal pagination callback
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    await fetchSectionPage(page + 1, true);
  }, [hasMore, isLoadingMore, isLoading, page, fetchSectionPage]);

  // Error state with retry action
  if (isError && cards.length === 0) {
    return (
      <div ref={containerRef} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-6 sm:p-8 text-center my-4">
        <h3 className="text-base font-semibold text-[#1f1f1f]">{section.title}</h3>
        <p className="mt-1 text-xs text-[#727272]">Unable to load properties for this collection.</p>
        <button
          type="button"
          onClick={() => fetchSectionPage(1, false)}
          className="mt-3 inline-flex items-center rounded-full bg-zinc-900 px-5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  // Loading skeleton state
  if (cards.length === 0 && isLoading) {
    return (
      <div ref={containerRef} className="min-h-[340px]">
        <HomeSectionSkeleton title={section.title} count={5} />
      </div>
    );
  }

  // Empty section: don't leave permanent blank gaps
  if (cards.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef}>
      <HomePropertySection
        title={section.title}
        cards={cards}
        seeAllHref={section.seeAllHref}
        previewImages={section.previewImages}
        totalCount={section.totalCount}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
      />
    </div>
  );
}
