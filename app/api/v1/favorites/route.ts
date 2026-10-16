import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { favoriteService } from "@/services/favorite.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const skip = Math.max(0, Number.parseInt(req.nextUrl.searchParams.get("skip") ?? "0", 10) || 0);
  const take = Math.min(48, Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("take") ?? "48", 10) || 48));
  const [{ items, total }, listingIds] = await Promise.all([
    favoriteService.listUserFavoriteCards(actor.id, { skip, take }),
    favoriteService.listUserFavoriteListingIds(actor.id),
  ]);

  const response = ok({ user: { id: actor.id, name: actor.name ?? null }, listingIds, items, total });
  // Favorites are private, user-specific state. Prevent browser/proxy caches
  // from serving a pre-delete list to the client refetch.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
});
