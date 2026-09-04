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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExt = path.extname(file.name) || ".jpg";
    const cleanExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(fileExt.toLowerCase())
      ? fileExt.toLowerCase()
      : ".jpg";

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
