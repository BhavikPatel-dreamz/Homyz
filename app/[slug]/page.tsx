import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cmsPublicService } from "@/services/cms-public.service";
import { CmsContentTypeEnum } from "@/generated/prisma/enums";
import type { StaticPagePayload } from "@/lib/cms/content-types";
import { StaticPageClient } from "./static-page-client";
import { prisma } from "@/lib/db/prisma";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ preview?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await cmsPublicService.getPublishedContent<StaticPagePayload>(
    CmsContentTypeEnum.STATIC_PAGE,
    slug.toLowerCase(),
    "en"
  );

  if (!item) {
    return {
      title: "Page Not Found - Homyz",
    };
  }

  const payload = item.payload;
  return {
    title: `${payload.metaTitle || item.title} - Homyz`,
    description:
      payload.metaDescription || payload.heroSubtitle || "Homyz Hospitality Platform",
  };
}

export default async function StaticPageRoute({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = searchParams ? await searchParams : {};
  const isPreview = search?.preview === "true";

  // 1. Check for published static page
  const item = await cmsPublicService.getPublishedContent<StaticPagePayload>(
    CmsContentTypeEnum.STATIC_PAGE,
    slug.toLowerCase(),
    "en"
  );

  if (item) {
    return (
      <StaticPageClient
        slug={item.slug || slug}
        title={item.title}
        payload={item.payload}
        publishedAt={item.publishedAt ? item.publishedAt.toISOString() : undefined}
        isPreview={false}
      />
    );
  }

  // 2. If not published and preview is requested, check for draft version
  if (isPreview) {
    const draftContent = await prisma.cmsContent.findFirst({
      where: {
        type: CmsContentTypeEnum.STATIC_PAGE,
        slug: slug.toLowerCase(),
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (draftContent && draftContent.versions.length > 0) {
      const draftVersion = draftContent.versions[0];
      return (
        <StaticPageClient
          slug={draftContent.slug || slug}
          title={draftContent.title}
          payload={draftVersion.payload as unknown as StaticPagePayload}
          publishedAt={draftVersion.createdAt.toISOString()}
          isPreview={true}
        />
      );
    }
  }

  // 3. Not found
  notFound();
}

