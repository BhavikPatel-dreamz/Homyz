import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { getAuthContext } from "@/lib/auth/context";
import { travelStampService } from "@/services/travel-stamp.service";

export const GET = apiHandler(async (req) => {
  const actor = await getAuthContext(req);
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") || actor?.id;

  if (!targetUserId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication or userId required." } },
      { status: 401 },
    );
  }

  const isOwner = actor?.id === targetUserId;
  const result = await travelStampService.getUserStamps(targetUserId, !isOwner);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

