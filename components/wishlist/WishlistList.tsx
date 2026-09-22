"use client";

import React, { useEffect, useState } from "react";
import { ListingCard } from "@/components/listings/listing-card";

type ListingSummary = React.ComponentProps<typeof ListingCard>["listing"];
type FavoriteItem = { id: string; listingId: string; createdAt: string; listing: ListingSummary | null };

export default function WishlistList({ items }: { items: FavoriteItem[] }) {
  const [localItems, setLocalItems] = useState<FavoriteItem[]>(items || []);

  useEffect(() => {
    // This is server-provided route data (for example after navigation back to
    // this page), not an optimistic mutation update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalItems(items || []);
  }, [items]);

  useEffect(() => {
    function onFavoriteChanged(e: Event) {
      const ev = e as CustomEvent<{ listingId: string; isFavorite: boolean; items?: FavoriteItem[] }>;
      if (!ev?.detail) return;

      // The provider dispatches this only after its delete/add request has
      // completed and it has fetched the latest authenticated DB state. Do not
      // launch a second competing GET here: an older response could otherwise
      // overwrite this confirmed result.
      if (Array.isArray(ev.detail.items)) setLocalItems(ev.detail.items);
    }

    window.addEventListener("homyz:favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("homyz:favorite-changed", onFavoriteChanged);
  }, []);

  return (
    <div className="">
      <div className="max-w-[1200px] mx-auto px-6 py-8 sm:py-12">
        {localItems.length === 0 ? (
          <div className="text-zinc-500">You have no saved properties yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {localItems.filter((it) => it.listing).map((item) => (
              <div key={item.listingId || item.id}>
                <ListingCard listing={item.listing} initialFavorite={true} showFavorite={true} favoriteVariant="remove" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
