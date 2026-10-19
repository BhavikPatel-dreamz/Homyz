import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelStampService } from "@/services/travel-stamp.service";

export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const isDisplayed = typeof json?.isDisplayed === "boolean" ? json.isDisplayed : undefined;

  const result = await travelStampService.toggleStampDisplay(actor.id, id, isDisplayed);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

