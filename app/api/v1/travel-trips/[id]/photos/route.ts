import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelTripService } from "@/services/travel-trip.service";
import { attachTripPhotoSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Retrieves active photos for this trip. */
export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const trip = await travelTripService.getTrip(actor.id, id);
  return NextResponse.json(
    { photos: trip.photos || [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

/**
 * Attaches a READY TravelMediaAsset to the trip.
 * Enforces transactional 5-photo limit on the backend.
 */
export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const json = await req.json();
  const input = attachTripPhotoSchema.parse(json);

  const photo = await travelTripService.attachPhotoToTrip(actor.id, id, input);
  return NextResponse.json(
    { photo },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});

