import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getSessionUser } from "@/lib/auth/session";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "listing-photos");

async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create listing-photos upload dir:", err);
  }
}

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

    await ensureUploadDir();

    const fileExt = path.extname(file.name) || ".jpg";
    const cleanExt = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(fileExt.toLowerCase())
      ? fileExt.toLowerCase()
      : ".jpg";

    const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${cleanExt}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/listing-photos/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
    });
  } catch (err: any) {
    console.error("Listing photo upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload photo." }, { status: 500 });
  }
}
