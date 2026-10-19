import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelTripService } from "@/services/travel-trip.service";
import { setTripCoverSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Selects an existing active trip photo as the album cover. */
export const PATCH = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const json = await req.json();
  const input = setTripCoverSchema.parse(json);

  const result = await travelTripService.setTripCover(actor.id, id, input);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

