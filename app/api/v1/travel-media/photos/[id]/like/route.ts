import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { togglePhotoLike, getPhotoLikeStatus } from "@/services/travel-photo.service";
import { getTravelProfileStats } from "@/services/travel-profile.service";
import { AppError } from "@/lib/api/errors";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthContext(req);
    const { id } = await ctx.params;
    const status = await getPhotoLikeStatus(actor?.id, id);
    return NextResponse.json(status);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to get like status" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const result = await togglePhotoLike(actor.id, id);
    const photo = await prisma.travelPhoto.findUnique({
      where: { id },
      select: { userId: true },
    });
    const profileStats = photo
      ? await getTravelProfileStats(photo.userId)
      : null;
    return NextResponse.json({
      success: true,
      liked: result.liked,
      count: result.count,
      profileLikes: profileStats?.likes ?? null,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] photo like failed:", err);
    return NextResponse.json({ error: "Failed to toggle photo like" }, { status: 500 });
  }
}
