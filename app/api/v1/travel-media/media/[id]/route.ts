import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { canAccessTravelPhoto } from "@/services/travel-privacy.service";
import fs from "node:fs";
import path from "node:path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getAuthContext(req);
    const { id } = await params;

    const photo = await prisma.travelPhoto.findUnique({
      where: { id },
      include: {
        trip: { select: { id: true, visibility: true } },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Evaluate hierarchical access policy: Profile -> Trip -> Photo -> Blocking
    const access = await canAccessTravelPhoto(actor?.id, photo.id);

    if (!access.canAccess) {
      return NextResponse.json(
        { error: "Access to protected travel media forbidden", reason: access.reason },
        { status: 403 },
      );
    }

    // Determine variant requested (thumbnail, medium, or original)
    const { searchParams } = new URL(req.url);
    const variant = searchParams.get("variant");
    const targetUrl =
      variant === "thumbnail" && photo.thumbnailUrl
        ? photo.thumbnailUrl
        : variant === "medium" && photo.mediumUrl
          ? photo.mediumUrl
          : photo.url;

    // If targetUrl is an absolute remote URL or path
    if (targetUrl.startsWith("http://") || targetUrl.startsWith("https://")) {
      return NextResponse.redirect(targetUrl, {
        headers: {
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // If local file path under public/ or uploads/
    const cleanPath = targetUrl.replace(/^\/+/, "");
    const localFilePath = path.join(process.cwd(), "public", cleanPath);

    if (fs.existsSync(localFilePath)) {
      const fileBuffer = fs.readFileSync(localFilePath);
      const ext = path.extname(localFilePath).toLowerCase();
      const contentType =
        ext === ".webp"
          ? "image/webp"
          : ext === ".png"
            ? "image/png"
            : ext === ".avif"
              ? "image/avif"
              : "image/jpeg";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.redirect(targetUrl, {
      headers: {
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[travel-media] media authorization failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

