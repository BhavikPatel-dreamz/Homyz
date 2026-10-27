import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { togglePhotoLike, getPhotoLikeStatus } from "@/services/travel-photo.service";
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
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] photo like failed:", err);
    return NextResponse.json({ error: "Failed to toggle photo like" }, { status: 500 });
  }
}

