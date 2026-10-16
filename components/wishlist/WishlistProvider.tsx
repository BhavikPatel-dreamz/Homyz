"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";

type FavoriteItem = { id: string; listingId: string; createdAt: string; listing: unknown | null };
type FavoritesResponse = { listingIds?: unknown; items?: unknown };

type WishlistContextType = {
  has: (id: string) => boolean;
  adding: Set<string>;
  removeInFlight: Set<string>;
  ids: Set<string>;
  add: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  loading: boolean;
};

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const addingRef = useRef(new Set<string>());
  const removingRef = useRef(new Set<string>());
  const pendingIntentRef = useRef<Map<string, "add" | "remove">>(new Map());
  const syncVersionRef = useRef(0);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const readFavoritesResponse = (payload: unknown): FavoritesResponse => {
    // API responses use the standard { success, data } envelope. Keeping this
    // compatibility fallback also makes the client safe against legacy direct
    // responses during a rolling deployment.
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data?: FavoritesResponse }).data ?? {};
    }
    return (payload as FavoritesResponse) ?? {};
  };

  const syncFromServer = async (includeItems = false): Promise<{ listingIds: string[]; items: FavoriteItem[] } | null> => {
    const syncVersion = ++syncVersionRef.current;

    try {
      const res = await fetch(includeItems ? "/api/v1/favorites?include=cards" : "/api/v1/favorites", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return null;

      const data = readFavoritesResponse(await res.json());
      const listingIds = Array.isArray(data.listingIds) ? data.listingIds.filter((id): id is string => typeof id === "string") : [];
      const items = Array.isArray(data.items) ? data.items as FavoriteItem[] : [];

      // An older GET must never overwrite a newer confirmed mutation result.
      if (syncVersion === syncVersionRef.current) {
        setIds(new Set(listingIds));
      }

      return { listingIds, items };
    } catch {
      return null;
    }
  };

  const enqueueMutation = (mutation: () => Promise<void>) => {
    const queued = mutationQueueRef.current.then(mutation, mutation);
    // Keep the queue usable after a failed request while returning the actual
    // result to the caller.
    mutationQueueRef.current = queued.catch(() => undefined);
    return queued;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await syncFromServer();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const has = (id: string) => ids.has(id);

  const add = async (id: string) => {
    if (addingRef.current.has(id) || removingRef.current.has(id) || pendingIntentRef.current.get(id) === "remove") return;

    pendingIntentRef.current.set(id, "add");
    addingRef.current.add(id);

    return enqueueMutation(async () => {
      try {
        const res = await fetch(`/api/v1/favorites/${id}`, { method: "POST", credentials: "same-origin", cache: "no-store" });
        if (res.status === 401) {
          const returnUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
          window.location.href = `/login?callbackUrl=${encodeURIComponent(returnUrl)}`;
          return;
        }

        if (!res.ok) {
          await syncFromServer();
          return;
        }

        const freshFavorites = await syncFromServer(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:favorite-changed", { detail: { listingId: id, isFavorite: true, items: freshFavorites?.items } }));
        }
      } catch {
        await syncFromServer();
      } finally {
        pendingIntentRef.current.delete(id);
        addingRef.current.delete(id);
      }
    });
  };

  const remove = async (id: string) => {
    if (removingRef.current.has(id) || pendingIntentRef.current.get(id) === "add") return;

    pendingIntentRef.current.set(id, "remove");
    removingRef.current.add(id);

    return enqueueMutation(async () => {
      try {
        const res = await fetch(`/api/v1/favorites/${id}`, { method: "DELETE", credentials: "same-origin", cache: "no-store" });
        if (res.status === 401) {
          const returnUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
          window.location.href = `/login?callbackUrl=${encodeURIComponent(returnUrl)}`;
          return;
        }

        if (!res.ok) {
          await syncFromServer();
          return;
        }

        // Do not mutate the wishlist UI optimistically. This is the only state
        // update after a successful delete and comes from a fresh DB response.
        const freshFavorites = await syncFromServer(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("homyz:favorite-changed", { detail: { listingId: id, isFavorite: false, items: freshFavorites?.items } }));
        }
      } catch {
        await syncFromServer();
      } finally {
        pendingIntentRef.current.delete(id);
        removingRef.current.delete(id);
      }
    });
  };

  const context: WishlistContextType = {
    has,
    adding: addingRef.current,
    removeInFlight: removingRef.current,
    ids,
    add,
    remove,
    loading,
  };

  return <WishlistContext.Provider value={context}>{children}</WishlistContext.Provider>;
}

export function useWishlistContext() {
  return useContext(WishlistContext);
}
