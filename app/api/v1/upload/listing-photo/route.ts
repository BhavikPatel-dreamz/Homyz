import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { savePublicMedia } from "@/lib/storage/media";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";

const UPLOAD_RATE_LIMIT = 20;
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

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const validation = validatePublicImageUpload({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer,
    });
    if (validation) {
      return NextResponse.json({ error: validation.message }, { status: validation.status });
    }

    const extensionByMimeType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const cleanExt = extensionByMimeType[file.type];

    const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${cleanExt}`;
    const contentType = file.type || "image/jpeg";
    const saved = await savePublicMedia({
      kind: "listing-photos",
      fileName,
      body: buffer,
      contentType,
    });

    return NextResponse.json({
      success: true,
      url: saved.url,
      fileName: saved.fileName,
    });
  } catch (err: unknown) {
    console.error("[upload] listing photo upload failed");
    return NextResponse.json({ error: "Failed to upload photo." }, { status: 500 });
  }
}
