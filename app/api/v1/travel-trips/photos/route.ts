import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelTripService } from "@/services/travel-trip.service";
import { allPhotosQuerySchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Lists owner's active photos across all trips with optional trip or destination filters. */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { searchParams } = new URL(req.url);

  const query = allPhotosQuerySchema.parse({
    tripId: searchParams.get("tripId") || undefined,
    destinationId: searchParams.get("destinationId") || undefined,
    limit: searchParams.get("limit") || undefined,
    cursor: searchParams.get("cursor") || undefined,
  });

  const [result, legacyPhotos] = await Promise.all([
    travelTripService.getAllOwnerPhotos(actor.id, query),
    travelTripService.getLegacyOwnerPhotos(actor.id),
  ]);
  return NextResponse.json({ ...result, legacyPhotos }, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
