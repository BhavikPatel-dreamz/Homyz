import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { savePublicMedia } from "@/lib/storage/media";

const UPLOAD_RATE_LIMIT = 20;
const UPLOAD_RATE_WINDOW_SECONDS = 10 * 60;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

function isUnsupportedAvatarKind(error: unknown): boolean {
  return error instanceof Error && /Media server upload failed \(404\)/.test(error.message);
}

/** Upload one public profile image. Persisting it on the user happens separately. */
export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimitAsync(
      `avatar-upload:${actor.id}`,
      UPLOAD_RATE_LIMIT,
      UPLOAD_RATE_WINDOW_SECONDS,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many profile image uploads. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No profile image was provided." }, { status: 400 });
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

    const extension = EXTENSION_BY_MIME_TYPE[file.type];
    const fileName = `avatar_${actor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;
    let saved: Awaited<ReturnType<typeof savePublicMedia>>;
    try {
      saved = await savePublicMedia({
        kind: "avatars",
        fileName,
        body: buffer,
        contentType: file.type,
      });
    } catch (error) {
      // Older deployed media services only know listing-photos. This remains a
      // media-server write (never an app-disk fallback) and can be removed
      // once every media deployment includes the avatars kind.
      if (!isUnsupportedAvatarKind(error)) throw error;
      console.warn("[upload] media service does not yet support avatars; using compatible public storage");
      saved = await savePublicMedia({
        kind: "listing-photos",
        fileName,
        body: buffer,
        contentType: file.type,
      });
    }

    return NextResponse.json({ success: true, url: saved.url, fileName: saved.fileName });
  } catch (err) {
    console.error("[upload] avatar upload failed", err);
    return NextResponse.json({ error: "Failed to upload profile image." }, { status: 500 });
  }
}
