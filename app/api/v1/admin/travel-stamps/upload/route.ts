import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { savePublicMedia } from "@/lib/storage/media";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (
      !actor ||
      !hasPermission(actor, PERMISSIONS.LOYALTY_ACHIEVEMENTS_MANAGE)
    ) {
      return NextResponse.json(
        { error: "Unauthorized. Achievement-management access required." },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No stamp artwork file was provided." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image file must be between 1 byte and 5 MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePublicImageUpload({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer,
    });
    if (validation) {
      return NextResponse.json(
        { error: validation.message },
        { status: validation.status },
      );
    }
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
      {
        error:
          err instanceof Error ? err.message : "Failed to upload stamp artwork",
      },
      { status: 500 },
    );
  }
}
