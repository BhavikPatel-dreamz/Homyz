import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  getPaginatedTravelerStamps,
  getTravelerStamps,
} from "@/services/travel-stamp.service";
import { canViewTravelProfile } from "@/services/travel-privacy.service";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || actor?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isOwner = actor?.id === targetUserId;
    if (!isOwner) {
      const [access, profile] = await Promise.all([
        canViewTravelProfile(actor?.id, targetUserId),
        prisma.travelProfile.findUnique({
          where: { userId: targetUserId },
          select: { showStamps: true },
        }),
      ]);
      if (!access.canView || !profile?.showStamps) {
        return NextResponse.json(
          { error: "Travel stamps are private" },
          { status: 403 },
        );
      }
    }
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor") || undefined;
    if (isOwner && (limitParam || cursor)) {
      const result = await getPaginatedTravelerStamps(targetUserId, {
        limit: limitParam ? Number(limitParam) : 12,
        cursor,
      });
      return NextResponse.json({
        success: true,
        data: result.items,
        nextCursor: result.nextCursor,
        totalCount: result.totalCount,
      });
    }
    const stamps = await getTravelerStamps(targetUserId, {
      publicOnly: !isOwner,
    });

    return NextResponse.json({
      success: true,
      data: stamps,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[travel-media] stamps fetch failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
