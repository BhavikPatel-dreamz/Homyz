"use client";

import { useMemo } from "react";
import { useWishlistContext } from "@/components/wishlist/WishlistProvider";

export default function useWishlist() {
  const ctx = useWishlistContext();
  return useMemo(() => {
    if (!ctx) {
      return {
        has: (id: string) => false,
        add: async (_: string) => {},
        remove: async (_: string) => {},
        loading: false,
        adding: new Set<string>(),
        removeInFlight: new Set<string>(),
      };
    }

    return {
      has: ctx.has,
      add: ctx.add,
      remove: ctx.remove,
      loading: ctx.loading,
      adding: ctx.adding,
      removeInFlight: ctx.removeInFlight,
      ids: ctx.ids,
    };
  }, [ctx]);
}
