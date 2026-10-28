import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { savePublicMedia } from "@/lib/storage/media";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor || actor.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No stamp artwork file was provided." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Supported formats: PNG, JPG, WebP, SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image file exceeds the 5MB limit." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = EXTENSION_BY_MIME[file.type] || ".png";
    const filename = `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

    const saved = await savePublicMedia({
      kind: "stamp-icons",
      fileName: filename,
      body: buffer,
      contentType: file.type,
    });

    return NextResponse.json({
      url: saved.url,
      filename: saved.fileName,
    });
  } catch (err: unknown) {
    console.error("[admin-travel-stamps] Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload stamp artwork" },
      { status: 500 }
    );
  }
}
