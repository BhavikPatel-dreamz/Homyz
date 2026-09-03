import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getSessionUser } from "@/lib/auth/session";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "stamp-icons");

async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create stamp-icons upload dir:", err);
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

    // Validate image format
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

    await ensureUploadDir();

    const fileName = `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/stamp-icons/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
    });
  } catch (err: any) {
    console.error("Stamp icon upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload stamp icon." }, { status: 500 });
  }
}
