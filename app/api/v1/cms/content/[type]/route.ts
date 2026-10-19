import { NextResponse } from "next/server";
import { cmsPublicService } from "@/services/cms-public.service";
import { CmsContentTypeEnum } from "@/generated/prisma/enums";

// GET /api/v1/cms/content/[type] — Public listing or slug-resolved published CMS content
export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") || "en";
  const slug = searchParams.get("slug") || searchParams.get("id");

  const upperType = type.toUpperCase() as CmsContentTypeEnum;
  if (!Object.values(CmsContentTypeEnum).includes(upperType)) {
    return NextResponse.json(
      { error: `Invalid content type: ${type}` },
      { status: 400 }
    );
  }

  if (slug) {
    const single = await cmsPublicService.getPublishedContent(upperType, slug, locale);
    if (!single) {
      return NextResponse.json(
        { error: "Content not found or not currently published." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { data: single },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  }

  const items = await cmsPublicService.listPublishedContents(upperType, locale);
  return NextResponse.json(
    { data: items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

