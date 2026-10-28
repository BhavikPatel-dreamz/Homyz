import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { getTripLikeStatus, toggleTripLike } from "@/services/travel-social.service";
import { getTravelProfileStats } from "@/services/travel-profile.service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthContext(req);
    const { id } = await ctx.params;
    return NextResponse.json(await getTripLikeStatus(actor?.id, id));
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to load trip like." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await ctx.params;
    const result = await toggleTripLike(actor.id, id);
    const trip = await prisma.travelTrip.findUnique({
      where: { id },
      select: { userId: true },
    });
    const profileStats = trip
      ? await getTravelProfileStats(trip.userId)
      : null;
    return NextResponse.json({
      success: true,
      ...result,
      profileLikes: profileStats?.likes ?? null,
    });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to update trip like." }, { status: 500 });
  }
}
