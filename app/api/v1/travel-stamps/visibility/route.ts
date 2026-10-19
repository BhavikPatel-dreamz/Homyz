import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelStampService } from "@/services/travel-stamp.service";

export const PATCH = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const json = await req.json().catch(() => null);

  if (typeof json?.stampsVisible !== "boolean") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Field 'stampsVisible' (boolean) is required." } },
      { status: 400 },
    );
  }

  const result = await travelStampService.setProfileStampsVisibility(
    actor.id,
    json.stampsVisible,
  );

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

