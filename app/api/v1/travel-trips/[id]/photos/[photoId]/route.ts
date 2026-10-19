import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelTripService } from "@/services/travel-trip.service";
import { updateTravelPhotoSchema } from "@/lib/validation/travel-trip";

export const dynamic = "force-dynamic";

/** Updates metadata for an active trip photo. */
export const PATCH = apiHandler(
  async (
    req,
    { params }: { params: Promise<{ id: string; photoId: string }> },
  ) => {
    const actor = await requireApiAuth(req);
    const { photoId } = await params;
    const json = await req.json().catch(() => null);
    const parsed = updateTravelPhotoSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid photo metadata.",
            details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        },
        { status: 400 },
      );
    }

    const photo = await travelTripService.updatePhotoMetadata(actor.id, photoId, parsed.data);
    return NextResponse.json({ photo }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);

/** Detaches a photo from a travel trip. */
export const DELETE = apiHandler(
  async (
    req,
    { params }: { params: Promise<{ id: string; photoId: string }> },
  ) => {
    const actor = await requireApiAuth(req);
    const { id, photoId } = await params;

    const result = await travelTripService.detachPhotoFromTrip(actor.id, id, photoId);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);
