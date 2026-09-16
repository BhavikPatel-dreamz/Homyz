import { apiHandler } from "@/lib/api/handler";
import { noContent, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { favoriteService } from "@/services/favorite.service";

export const POST = apiHandler(async (req, context: { params: Promise<{ listingId: string }> }) => {
  const [actor, { listingId }] = await Promise.all([requireApiAuth(req), context.params]);
  await favoriteService.saveFavorite(actor.id, listingId);
  return ok({ listingId, favorite: true });
});

export const DELETE = apiHandler(async (req, context: { params: Promise<{ listingId: string }> }) => {
  const [actor, { listingId }] = await Promise.all([requireApiAuth(req), context.params]);
  await favoriteService.removeFavorite(actor.id, listingId);
  return noContent();
});
