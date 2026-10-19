import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelTripService } from "@/services/travel-trip.service";
import { updateTripSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Retrieves authorized trip details and active photos. */
export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const trip = await travelTripService.getTrip(actor.id, id);
  return NextResponse.json({ trip }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Updates trip fields (title, description, dates, destination, cover). */
export const PATCH = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const json = await req.json();
  const input = updateTripSchema.parse(json);

  const trip = await travelTripService.updateTrip(actor.id, id, input);
  return NextResponse.json({ trip }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Soft-deletes a travel trip safely. */
export const DELETE = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const result = await travelTripService.deleteTrip(actor.id, id);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
});

