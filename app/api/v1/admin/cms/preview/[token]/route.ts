import { NextResponse } from "next/server";
import { verifyPreviewToken } from "@/lib/cms/preview-token";
import { prisma } from "@/lib/db/prisma";

// GET /api/v1/admin/cms/preview/[token] — Resolve preview content snapshot
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = await verifyPreviewToken(token);

  if (!verified) {
    return NextResponse.json(
      { error: "Invalid, expired, or revoked preview token." },
      { status: 401 }
    );
  }

  const [content, version] = await Promise.all([
    prisma.cmsContent.findUnique({
      where: { id: verified.contentId },
      select: { id: true, title: true, type: true, slug: true, locale: true, status: true },
    }),
    prisma.cmsContentVersion.findUnique({
      where: { id: verified.versionId },
    }),
  ]);

  if (!content || !version) {
    return NextResponse.json(
      { error: "Content revision no longer exists." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      previewMode: true,
      content,
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        title: version.title,
        payload: version.payload,
        createdAt: version.createdAt,
      },
    },
    {
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    }
  );
}

