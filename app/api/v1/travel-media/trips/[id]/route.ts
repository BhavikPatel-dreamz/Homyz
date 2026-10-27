import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { updateTrip, deleteTrip, setTripCoverPhoto } from "@/services/travel-photo.service";
import { AppError } from "@/lib/api/errors";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    if (body.coverPhotoId) {
      await setTripCoverPhoto(actor.id, id, body.coverPhotoId);
    }

    const updated = await updateTrip(actor.id, id, {
      title: body.title,
      destinationId: body.destinationId,
      startDate: body.startDate,
      endDate: body.endDate,
      coverPhotoId: body.coverPhotoId,
    });

    return NextResponse.json({ success: true, trip: updated });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] trip update failed:", err);
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const searchParams = req.nextUrl.searchParams;
    const policy = (searchParams.get("policy") as "UNLINK_PHOTOS" | "DELETE_PHOTOS") || "UNLINK_PHOTOS";

    const res = await deleteTrip(actor.id, id, policy);
    return NextResponse.json(res);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] trip delete failed:", err);
    return NextResponse.json({ error: "Failed to delete trip" }, { status: 500 });
  }
}

