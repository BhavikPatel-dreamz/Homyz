import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { getLikedPhotos } from "@/services/travel-photo.service";
import { AppError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const cursor = searchParams.get("cursor") || undefined;

    const result = await getLikedPhotos(actor.id, { limit, cursor });

    return NextResponse.json({
      photos: result.items,
      nextCursor: result.nextCursor,
      hasMore: Boolean(result.nextCursor),
      totalCount: result.totalCount,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] liked photos lookup failed:", err);
    return NextResponse.json({ error: "Failed to retrieve liked photos." }, { status: 500 });
  }
}
