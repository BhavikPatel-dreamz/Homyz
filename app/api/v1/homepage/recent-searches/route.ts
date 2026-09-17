import { NextRequest, NextResponse } from "next/server";
import { homepageService } from "@/services/homepage.service";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { searches = [], currentCity, limit = 4 } = body;

    const user = await getSessionUser();
    const sections = await homepageService.getRecentSearchSections({
      searches,
      userId: user?.id,
      currentLocationQuery: currentCity,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: { sections },
    });
  } catch (error) {
    console.error("Failed to fetch recent search sections:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load recent search sections" },
      { status: 500 },
    );
  }
}

