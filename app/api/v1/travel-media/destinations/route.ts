import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import {
  getTravelerDestinationStats,
  getTravelerVisitedDestinations,
} from "@/services/travel-destination.service";
import { AppError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId") || actor?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [stats, visitedCountries] = await Promise.all([
      getTravelerDestinationStats(targetUserId),
      getTravelerVisitedDestinations(targetUserId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        visitedCountries,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[travel-media] destinations fetch failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
