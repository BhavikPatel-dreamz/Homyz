import { NextResponse } from "next/server";
import path from "path";
import { getSessionUser } from "@/lib/auth/session";
import { savePublicMedia } from "@/lib/storage/media";

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

    const allowedExts = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const fileExt = path.extname(file.name)?.toLowerCase() || ".png";
    if (!allowedExts.includes(fileExt)) {
      return NextResponse.json(
        { error: "Invalid image format. Supported formats: PNG, JPG, JPEG, WebP, SVG" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const contentType = file.type || "image/png";
    const saved = await savePublicMedia({
      kind: "stamp-icons",
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
    console.error("Stamp icon upload error:", err);
    const message = err instanceof Error ? err.message : "Failed to upload stamp icon.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
