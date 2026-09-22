import { ListingStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

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
    const favorites = await prisma.listingFavorite.findMany({
      where: { userId },
      select: { listingId: true },
    });
    return favorites.map((f: { listingId: string }) => f.listingId);
  } catch (err) {
    return [];
  }
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
  } catch (err: any) {
    if (err?.code === "P2021" || String(err?.message || "").includes("does not exist")) {
      await ensureListingFavoriteTable();
      await prisma.listingFavorite.upsert({
        where: { userId_listingId: { userId, listingId } },
        create: { userId, listingId },
        update: {},
      });
    } else {
      throw err;
    }
  }
}

async function removeFavorite(userId: string, listingId: string): Promise<void> {
  try {
    await prisma.listingFavorite.deleteMany({ where: { userId, listingId } });
  } catch (err: any) {
    if (err?.code === "P2021" || String(err?.message || "").includes("does not exist")) {
      return;
    }
    throw err;
  }
}

export const favoriteService = {
  getFavoriteListingIds,
  listUserFavoriteListingIds,
  saveFavorite,
  removeFavorite,
};

