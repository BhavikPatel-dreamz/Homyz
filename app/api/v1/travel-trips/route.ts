import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelTripService } from "@/services/travel-trip.service";
import { createTripSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Lists the authenticated owner's travel trips (cursor-paginated). */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

  const result = await travelTripService.listTrips(actor.id, { cursor, limit });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

/** Creates a new personal travel album (starts as PRIVATE DRAFT). */
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const json = await req.json();
  const input = createTripSchema.parse(json);

  const trip = await travelTripService.createTrip(actor.id, input);
  return NextResponse.json(
    { trip },
    {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
});

