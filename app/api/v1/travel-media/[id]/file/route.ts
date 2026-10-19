import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelMediaService } from "@/services/travel-media.service";

/** Authorization-aware private delivery. Storage keys are never sent to clients. */
export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;
  const requested = req.nextUrl.searchParams.get("variant") || "medium";
  const variant = ["thumbnail", "medium", "large", "cover", "original"].includes(requested) ? requested : "medium";
  const file = await travelMediaService.getAssetFile(actor, id, variant);
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
