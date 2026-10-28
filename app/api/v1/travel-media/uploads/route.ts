import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { uploadTravelPhoto } from "@/services/travel-photo.service";
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
      `travel-media-upload:${actor.id}`,
      UPLOAD_RATE_LIMIT,
      UPLOAD_RATE_WINDOW_SECONDS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upload requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tripId = (formData.get("tripId") as string) || undefined;
    const tripTitle = (formData.get("tripTitle") as string) || undefined;
    const caption = (formData.get("caption") as string) || undefined;
    const location = (formData.get("location") as string) || undefined;
    const taggedUserIdsRaw = formData.get("taggedUserIds");
    const replacePhotoId = (formData.get("replacePhotoId") as string) || undefined;
    let taggedUserIds: string[] | undefined;
    if (typeof taggedUserIdsRaw === "string" && taggedUserIdsRaw) {
      try {
        const parsed = JSON.parse(taggedUserIdsRaw);
        if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
          return NextResponse.json({ error: "Invalid people tags." }, { status: 400 });
        }
        taggedUserIds = parsed;
      } catch {
        return NextResponse.json({ error: "Invalid people tags." }, { status: 400 });
      }
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const photo = await uploadTravelPhoto(actor, {
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        buffer,
      },
      tripId,
      tripTitle,
      caption,
      location,
      taggedUserIds,
      replacePhotoId,
    });

    return NextResponse.json({ success: true, photo }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[travel-media] upload failed:", err);
    return NextResponse.json({ error: "Failed to upload travel photo." }, { status: 500 });
  }
}
