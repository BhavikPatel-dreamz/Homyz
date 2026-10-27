import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { toggleStampPinned } from "@/services/travel-stamp.service";
import { AppError } from "@/lib/api/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const updated = await toggleStampPinned(actor.id, id);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[travel-media] toggle stamp pin failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

