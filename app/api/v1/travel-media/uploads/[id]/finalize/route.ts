import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelMediaService } from "@/services/travel-media.service";

export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const upload = await travelMediaService.finalizeUpload(actor, id);
  return NextResponse.json({ upload }, { headers: { "Cache-Control": "private, no-store" } });
});
