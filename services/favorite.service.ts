import { ListingStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";

async function getFavoriteListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  const favorites = await prisma.listingFavorite.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return new Set(favorites.map((favorite: { listingId: string }) => favorite.listingId));
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
  await prisma.listingFavorite.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });
}

async function removeFavorite(userId: string, listingId: string): Promise<void> {
  await prisma.listingFavorite.deleteMany({ where: { userId, listingId } });
}

export const favoriteService = { getFavoriteListingIds, saveFavorite, removeFavorite };
