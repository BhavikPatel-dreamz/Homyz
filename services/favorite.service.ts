import { ListingStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { getCounter, getOrSetCache, incrCounter } from "@/lib/redis/cache";
import { CACHE_KEYS } from "@/lib/redis/keys";
import { CACHE_TTL } from "@/lib/redis/ttl";
import {
  publicListingCardSelect,
  toPublicListingCardDTO,
  type PublicListingCardRecord,
  type PublicListingDTO,
} from "./mappers";

export type FavoriteCardItem = {
  id: string;
  listingId: string;
  createdAt: string;
  listing: PublicListingDTO;
};

async function invalidateFavoriteCache(userId: string): Promise<void> {
  await incrCounter(CACHE_KEYS.FAVORITES_VER(userId));
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return value.code === "P2021" || value.message?.includes("does not exist") === true;
}

async function getFavoriteListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  try {
    const favorites = await prisma.listingFavorite.findMany({
      where: { userId, listingId: { in: listingIds } },
      select: { listingId: true },
    });
    return new Set(favorites.map((favorite: { listingId: string }) => favorite.listingId));
  } catch {
    return new Set();
  }
}

async function listUserFavoriteListingIds(userId: string): Promise<string[]> {
  try {
    const version = await getCounter(CACHE_KEYS.FAVORITES_VER(userId));
    return getOrSetCache(
      CACHE_KEYS.FAVORITE_IDS(userId, version),
      async () => {
        const favorites = await prisma.listingFavorite.findMany({
          where: { userId },
          select: { listingId: true },
        });
        return favorites.map((f: { listingId: string }) => f.listingId);
      },
      { ttl: CACHE_TTL.BOOKING_LIST },
    );
  } catch {
    return [];
  }
}

async function listUserFavoriteCards(
  userId: string,
  options: { skip?: number; take?: number } = {},
): Promise<{ items: FavoriteCardItem[]; total: number }> {
  const skip = Math.max(0, Math.trunc(options.skip ?? 0));
  const take = options.take ?? 48;
  const safeTake = Math.min(100, Math.max(1, Math.trunc(take)));
  const version = await getCounter(CACHE_KEYS.FAVORITES_VER(userId));
  return getOrSetCache(
    CACHE_KEYS.FAVORITES_CARDS(userId, version, skip, safeTake),
    async () => {
      const [favorites, total] = await Promise.all([
        prisma.listingFavorite.findMany({
          where: { userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip,
          take: safeTake,
          include: { listing: { select: publicListingCardSelect } },
        }),
        prisma.listingFavorite.count({ where: { userId } }),
      ]);
      return {
        items: favorites.map((favorite: {
          id: string;
          listingId: string;
          createdAt: Date;
          listing: PublicListingCardRecord;
        }) => ({
          id: favorite.id,
          listingId: favorite.listingId,
          createdAt: favorite.createdAt.toISOString(),
          listing: toPublicListingCardDTO(favorite.listing),
        })),
        total,
      };
    },
    { ttl: CACHE_TTL.BOOKING_LIST },
  );
}

async function ensureListingFavoriteTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ListingFavorite" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "listingId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ListingFavorite_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "ListingFavorite_userId_listingId_key" ON "ListingFavorite"("userId", "listingId");
      CREATE INDEX IF NOT EXISTS "ListingFavorite_listingId_idx" ON "ListingFavorite"("listingId");
    `);
  } catch (err) {
    console.error("[favoriteService] Error ensuring ListingFavorite table:", err);
  }
}

async function saveFavorite(userId: string, listingId: string): Promise<void> {
  const listing = await prisma.listing.findFirst({
    where: {
      id: listingId,
      published: true,
      status: ListingStatus.ACTIVE,
      isPaused: false,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!listing) throw AppError.notFound("Listing is not available");

  try {
    await prisma.listingFavorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      create: { userId, listingId },
      update: {},
    });
    await invalidateFavoriteCache(userId);
  } catch (err: unknown) {
    if (isMissingTableError(err)) {
      await ensureListingFavoriteTable();
      await prisma.listingFavorite.upsert({
        where: { userId_listingId: { userId, listingId } },
        create: { userId, listingId },
        update: {},
      });
      await invalidateFavoriteCache(userId);
    } else {
      throw err;
    }
  }
}

async function removeFavorite(userId: string, listingId: string): Promise<void> {
  try {
    const result = await prisma.listingFavorite.deleteMany({ where: { userId, listingId } });
    if (result.count > 0) await invalidateFavoriteCache(userId);
  } catch (err: unknown) {
    if (isMissingTableError(err)) {
      return;
    }
    throw err;
  }
}

export const favoriteService = {
  getFavoriteListingIds,
  listUserFavoriteListingIds,
  listUserFavoriteCards,
  saveFavorite,
  removeFavorite,
};
