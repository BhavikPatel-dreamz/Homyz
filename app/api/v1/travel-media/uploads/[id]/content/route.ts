import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { travelMediaService } from "@/services/travel-media.service";

/**
 * Server-proxied transfer endpoint. Browser XHR upload events report genuine
 * body-byte progress; the final server validation remains authoritative.
 */
export const POST = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const rate = await checkRateLimitAsync(`travel-media-transfer:${actor.id}`, 30, 10 * 60);
  if (!rate.allowed) throw AppError.rateLimited("Too many upload attempts. Please wait and try again.");
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) throw AppError.badRequest("No image file was provided.");
  const upload = await travelMediaService.uploadContent(actor, id, {
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  return NextResponse.json({ upload }, { headers: { "Cache-Control": "private, no-store" } });
});
