import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { toPublicListingCardDTO, publicListingCardSelect } from "@/services/mappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FavoriteRow = {
  id: string;
  listingId: string;
  createdAt: Date;
  listing: Parameters<typeof toPublicListingCardDTO>[0] | null;
};

export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const includeCards = req.nextUrl.searchParams.get("include") === "cards";

  // Most pages only need favorite IDs for their heart buttons. Avoid joining and
  // serializing every saved listing during the application's global startup.
  if (!includeCards) {
    const favorites = await prisma.listingFavorite.findMany({
      where: { userId: actor.id },
      select: { listingId: true },
    });
    const response = ok({
      user: { id: actor.id, name: actor.name ?? null },
      listingIds: favorites.map((favorite: { listingId: string }) => favorite.listingId),
    });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    return response;
  }

  // Saved-list pages explicitly opt into the heavier card payload.
  const favorites: FavoriteRow[] = await prisma.listingFavorite.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: publicListingCardSelect } },
  });

  const items = favorites
    .map((f: FavoriteRow) => ({ id: f.id, listingId: f.listingId, createdAt: f.createdAt, listing: f.listing ? toPublicListingCardDTO(f.listing) : null }))
    .filter((x) => x.listing !== null);

  const listingIds = items.map((i) => i.listingId);

  const response = ok({ user: { id: actor.id, name: actor.name ?? null }, listingIds, items });
  // Favorites are private, user-specific state. Prevent browser/proxy caches
  // from serving a pre-delete list to the client refetch.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});
