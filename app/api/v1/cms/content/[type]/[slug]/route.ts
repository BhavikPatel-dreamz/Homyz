import { NextResponse } from "next/server";
import { cmsPublicService } from "@/services/cms-public.service";
import { CmsContentTypeEnum } from "@/generated/prisma/enums";

// GET /api/v1/cms/content/[type]/[slug] — Public resolver for published CMS content
export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  const { type, slug } = await params;
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "en";
  const decodedSlug = decodeURIComponent(slug).trim().replace(/^\/+|\/+$/g, "");

  const upperType = type.toUpperCase() as CmsContentTypeEnum;
  if (!Object.values(CmsContentTypeEnum).includes(upperType)) {
    return NextResponse.json(
      { error: `Invalid content type: ${type}` },
      { status: 400 }
    );
  }

  const content = await cmsPublicService.getPublishedContent(upperType, decodedSlug, locale);

  if (!content) {
    return NextResponse.json(
      { error: "Content not found or not currently published." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { data: content },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

