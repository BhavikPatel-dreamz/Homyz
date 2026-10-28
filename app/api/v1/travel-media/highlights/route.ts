import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { getCountryHighlights } from "@/services/travel-photo.service";
import { AppError } from "@/lib/api/errors";

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    const searchParams = req.nextUrl.searchParams;
    const requestedUserId = searchParams.get("userId") || actor?.id;

    if (!requestedUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const highlights = await getCountryHighlights(requestedUserId);
    return NextResponse.json({ highlights });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] highlights lookup failed:", err);
    return NextResponse.json({ error: "Failed to retrieve highlights." }, { status: 500 });
  }
}

