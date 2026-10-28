import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  getPhotoDetails,
  updateTravelPhotoMetadata,
  deleteTravelPhoto,
} from "@/services/travel-photo.service";
import { canAccessTravelPhoto, canViewTravelProfile } from "@/services/travel-privacy.service";
import { AppError } from "@/lib/api/errors";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthContext(req);
    const { id } = await ctx.params;
    const photo = await getPhotoDetails(id, actor?.id);

    const canAccess = photo.isLegacy
      ? (await canViewTravelProfile(actor?.id, photo.userId)).canView
      : (await canAccessTravelPhoto(actor?.id, id)).canAccess;
    if (!canAccess) {
      return NextResponse.json({ error: "Access to this travel photo is forbidden" }, { status: 403 });
    }

    return NextResponse.json({ photo });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] photo lookup failed:", err);
    return NextResponse.json({ error: "Failed to load photo details" }, { status: 500 });
  }
}

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

    const updated = await updateTravelPhotoMetadata(actor.id, id, {
      caption: body.caption,
      location: body.location,
      tripId: body.tripId,
      order: body.order,
    });

    return NextResponse.json({ success: true, photo: updated });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] photo update failed:", err);
    return NextResponse.json({ error: "Failed to update photo." }, { status: 500 });
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
    const res = await deleteTravelPhoto(actor.id, id);

    return NextResponse.json(res);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] photo delete failed:", err);
    return NextResponse.json({ error: "Failed to delete photo." }, { status: 500 });
  }
}
