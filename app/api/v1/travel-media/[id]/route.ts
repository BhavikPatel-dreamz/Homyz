import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelMediaService } from "@/services/travel-media.service";

/** Retires an owner asset; physical cleanup is idempotent and retried by cron. */
export const DELETE = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const result = await travelMediaService.deleteAsset(actor, id);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
});
