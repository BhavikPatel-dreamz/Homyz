import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { reconcileTravelerHistory } from "@/services/travel-reconciliation.service";
import { AppError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await reconcileTravelerHistory(actor.id);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[travel-media] reconciliation failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
