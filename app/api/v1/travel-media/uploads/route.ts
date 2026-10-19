import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { travelMediaService } from "@/services/travel-media.service";

const createUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  size: z.number().int().positive(),
  mediaType: z.enum(["TRAVEL_PHOTO", "TRAVEL_COVER"]),
});

/** Creates a short-lived, owner-bound server-proxied upload session. */
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const rate = await checkRateLimitAsync(`travel-media-create:${actor.id}`, 30, 10 * 60);
  if (!rate.allowed) throw AppError.rateLimited("Too many upload attempts. Please wait and try again.");
  const input = createUploadSchema.parse(await req.json());
  const upload = await travelMediaService.createUploadSession(actor, input);
  return NextResponse.json({ upload }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
