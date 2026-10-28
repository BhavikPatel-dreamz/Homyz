import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { getPaginatedTravelPhotos } from "@/services/travel-photo.service";
import { canViewTravelProfile } from "@/services/travel-privacy.service";
import { AppError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    const searchParams = req.nextUrl.searchParams;
    const requestedUserId = searchParams.get("userId") || actor?.id;
    const tripId = searchParams.get("tripId") || undefined;
    const country = searchParams.get("country") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const cursor = searchParams.get("cursor") || undefined;

    if (!requestedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canViewTravelProfile(actor?.id, requestedUserId);
    if (!access.canView) {
      return NextResponse.json(
        { error: "Access to this travel profile is forbidden", reason: access.restrictionReason },
        { status: 403 },
      );
    }

    const result = await getPaginatedTravelPhotos({
      userId: requestedUserId,
      actorId: actor?.id,
      tripId,
      country,
      limit,
      cursor,
    });

    return NextResponse.json({
      photos: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      totalCount: result.totalCount,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] photos lookup failed:", err);
    return NextResponse.json({ error: "Failed to retrieve photos." }, { status: 500 });
  }
}
