import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  toggleProfileLike,
  getProfileLikeStatus,
} from "@/services/travel-profile.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: targetUserId } = await params;
    const actor = await getAuthContext(req);
    const status = await getProfileLikeStatus(actor?.id, targetUserId);

    return NextResponse.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load like status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: targetUserId } = await params;
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await toggleProfileLike(actor.id, targetUserId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.statusCode || 400;
    const message = err?.message || "Failed to toggle like";
    return NextResponse.json({ error: message }, { status });
  }
}

