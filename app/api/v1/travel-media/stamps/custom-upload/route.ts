import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getAuthContext } from "@/lib/auth/context";
import { checkRateLimitAsync } from "@/lib/services/rate-limit";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { savePublicMedia } from "@/lib/storage/media";

const MAX_CUSTOM_STAMP_SIZE = 5 * 1024 * 1024;
const CUSTOM_STAMP_UPLOAD_RATE_LIMIT = 20;
const CUSTOM_STAMP_UPLOAD_WINDOW_SECONDS = 10 * 60;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function imageDimensions(mimeType: string, buffer: Buffer): { width: number; height: number } | null {
  if (mimeType === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (length < 2) return null;
      offset += length + 2;
    }
  }
  if (mimeType === "image/webp" && buffer.length >= 30) {
    const chunk = buffer.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthContext(req);
    if (!actor?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimit = await checkRateLimitAsync(
      `custom-stamp-upload:${actor.id}`,
      CUSTOM_STAMP_UPLOAD_RATE_LIMIT,
      CUSTOM_STAMP_UPLOAD_WINDOW_SECONDS,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many custom stamp uploads. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Select a stamp artwork image." }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPG, and WebP images are supported." }, { status: 415 });
    }
    if (file.size > MAX_CUSTOM_STAMP_SIZE) {
      return NextResponse.json({ error: "Custom stamp artwork must be 5 MB or smaller." }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePublicImageUpload({ fileName: file.name, mimeType: file.type, size: file.size, buffer });
    if (validation) return NextResponse.json({ error: validation.message }, { status: validation.status });
    const dimensions = imageDimensions(file.type, buffer);
    if (!dimensions || dimensions.width < 64 || dimensions.height < 64 || dimensions.width > 6000 || dimensions.height > 6000) {
      return NextResponse.json(
        { error: "Custom stamp artwork must be between 64×64 and 6000×6000 pixels." },
        { status: 422 },
      );
    }

    const saved = await savePublicMedia({
      kind: "stamp-icons",
      fileName: `custom_stamp_${actor.id}_${nanoid(10)}${EXTENSIONS[file.type]}`,
      body: buffer,
      contentType: file.type,
    });
    return NextResponse.json({ url: saved.url }, { status: 201 });
  } catch (error: unknown) {
    console.error("[travel-stamps] custom artwork upload failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to upload custom stamp artwork." }, { status: 500 });
  }
}
