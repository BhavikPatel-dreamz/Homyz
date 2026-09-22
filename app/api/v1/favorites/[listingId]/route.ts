import { apiHandler } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { favoriteService } from "@/services/favorite.service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = apiHandler(async (req, context: { params: Promise<{ listingId: string }> }) => {
  const [actor, { listingId }] = await Promise.all([requireApiAuth(req), context.params]);
  await favoriteService.saveFavorite(actor.id, listingId);
  return ok({ listingId, favorite: true });
});

export const DELETE = apiHandler(async (req, context: { params: Promise<{ listingId: string }> }) => {
  const [actor, { listingId }] = await Promise.all([requireApiAuth(req), context.params]);
  await favoriteService.removeFavorite(actor.id, listingId);
  // The wishlist page is already force-dynamic, but invalidate the route's
  // client/server cache as well so a navigation immediately reads the DB.
  revalidatePath("/wishlists");
  return noContent();
});
