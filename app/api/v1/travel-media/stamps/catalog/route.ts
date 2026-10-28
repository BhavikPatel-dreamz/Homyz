import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { getTravelStampPickerPage } from "@/services/travel-stamp.service";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      24,
      Math.max(1, Number(searchParams.get("limit")) || 9),
    );
    const data = await getTravelStampPickerPage(actor.id, {
      page,
      limit,
      search: searchParams.get("search") || "",
      country: searchParams.get("country") || "",
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[travel-stamps] catalog fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to retrieve destination stamps." },
      { status: 500 },
    );
  }
}
