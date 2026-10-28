import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { setStampsSectionVisibility } from "@/services/travel-stamp.service";
import { AppError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const showStamps = Boolean(body.showStamps);

    const result = await setStampsSectionVisibility(actor.id, showStamps);

    return NextResponse.json({
      success: true,
      data: { showStamps: result },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[travel-media] set stamps visibility failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
