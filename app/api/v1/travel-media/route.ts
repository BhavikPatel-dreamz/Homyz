import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelMediaService } from "@/services/travel-media.service";

export const dynamic = "force-dynamic";

/** Lists only the current owner's ready, private, unattached travel drafts. */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const assets = await travelMediaService.listOwnerDrafts(actor);
  return NextResponse.json({ assets }, { headers: { "Cache-Control": "private, no-store" } });
});
