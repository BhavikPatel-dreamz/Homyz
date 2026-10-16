import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { listingMediaService } from "@/services/listing-media.service";
import { type PhotoRoomType } from "@/lib/listing/photo-room-assignments";
import { AppError } from "@/lib/api/errors";

const UPLOAD_RATE_LIMIT = 60;
const UPLOAD_RATE_WINDOW_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rateLimit = await checkRateLimitAsync(
      `public-image-upload:${actor.id}`,
      UPLOAD_RATE_LIMIT,
      UPLOAD_RATE_WINDOW_SECONDS,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawListingId = formData.get("listingId");
    const listingId = typeof rawListingId === "string" && rawListingId.trim() ? rawListingId.trim() : undefined;
    const rawRoom = formData.get("roomType");
    const roomType = typeof rawRoom === "string" && rawRoom.trim() ? (rawRoom.trim() as PhotoRoomType) : undefined;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await listingMediaService.uploadPhoto(actor, {
      listingId,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer,
      },
      autoAssignRoom: roomType,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[upload] listing photo upload failed", err);
    return NextResponse.json({ error: "Failed to upload photo." }, { status: 500 });
  }
}
