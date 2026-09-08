import { NextResponse } from "next/server";
import path from "path";
import { getSessionUser } from "@/lib/auth/session";
import { savePublicMedia } from "@/lib/storage/media";

const MAX_LISTING_PHOTO_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and AVIF images are supported." },
        { status: 415 },
      );
    }
    const uploadedExtension = path.extname(file.name).toLowerCase();
    const allowedExtensionsByMimeType: Record<string, string[]> = {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/avif": [".avif"],
    };
    if (!allowedExtensionsByMimeType[file.type]?.includes(uploadedExtension)) {
      return NextResponse.json(
        { error: "The file extension does not match its image type." },
        { status: 415 },
      );
    }
    if (file.size <= 0 || file.size > MAX_LISTING_PHOTO_SIZE) {
      return NextResponse.json(
        { error: "Each listing photo must be between 1 byte and 10 MB." },
        { status: 413 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const extensionByMimeType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const cleanExt = extensionByMimeType[file.type] ?? uploadedExtension;

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
    console.error("Listing photo upload error:", err);
    const message = err instanceof Error ? err.message : "Failed to upload photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
