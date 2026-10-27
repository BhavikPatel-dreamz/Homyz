import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { AppError } from "@/lib/api/errors";
import { getTravelStampPickerCountries } from "@/services/travel-stamp.service";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      countries: await getTravelStampPickerCountries(actor.id),
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[travel-stamps] countries fetch failed:", error);
    return NextResponse.json(
      { error: "Failed to retrieve stamp countries." },
      { status: 500 },
    );
  }
}
