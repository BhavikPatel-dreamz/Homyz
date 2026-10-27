import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { savePublicMedia } from "@/lib/storage/media";
import { updateTravelProfile } from "@/services/travel-profile.service";

const COVER_RATE_LIMIT = 20;
const COVER_RATE_WINDOW_SECONDS = 10 * 60;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimitAsync(
      `travel-cover-upload:${actor.id}`,
      COVER_RATE_LIMIT,
      COVER_RATE_WINDOW_SECONDS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many cover image uploads. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No cover image was provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePublicImageUpload({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer,
    });
    if (validation) {
      return NextResponse.json({ error: validation.message }, { status: validation.status });
    }

    const extension = EXTENSION_BY_MIME_TYPE[file.type] || ".jpg";
    const fileName = `cover_${actor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;
    let saved: Awaited<ReturnType<typeof savePublicMedia>>;
    try {
      saved = await savePublicMedia({
        kind: "travel-covers",
        fileName,
        body: buffer,
        contentType: file.type,
      });
    } catch {
      try {
        saved = await savePublicMedia({
          kind: "travel-photos",
          fileName,
          body: buffer,
          contentType: file.type,
        });
      } catch {
        saved = await savePublicMedia({
          kind: "listing-photos",
          fileName,
          body: buffer,
          contentType: file.type,
        });
      }
    }

    const updatedProfile = await updateTravelProfile(actor.id, {
      coverUrl: saved.url,
    });

    return NextResponse.json({
      success: true,
      coverUrl: saved.url,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("[travel-media] cover upload failed", err);
    return NextResponse.json({ error: "Failed to upload cover banner." }, { status: 500 });
  }
}

