import { prisma } from "@/lib/db/prisma";
import { CmsContentStatus, CmsContentTypeEnum } from "@/generated/prisma/enums";

export interface PublicContentViewModel<T = Record<string, unknown>> {
  id: string;
  type: CmsContentTypeEnum;
  title: string;
  slug: string | null;
  locale: string;
  requestedLocale?: string;
  isFallback?: boolean;
  payload: T;
  publishedAt: Date;
  versionNumber: number;
}

class CmsPublicService {
  /**
   * Resolve single published content by type and slug (or ID)
   * Strictly returns ONLY active published revisions. Excludes drafts and unpublished records.
   * If the requested locale is not published and is not "en", it falls back to "en".
   */
  async getPublishedContent<T = Record<string, unknown>>(
    type: CmsContentTypeEnum,
    slugOrId: string,
    locale = "en"
  ): Promise<PublicContentViewModel<T> | null> {
    // 1. Primary lookup in requested locale
    let publication = await prisma.cmsPublication.findFirst({
      where: {
        content: {
          type,
          status: CmsContentStatus.PUBLISHED,
          OR: [{ slug: slugOrId }, { id: slugOrId }],
          locale,
        },
      },
      include: {
        content: {
          select: {
            id: true,
            type: true,
            title: true,
            slug: true,
            locale: true,
            metadata: true,
          },
        },
        version: {
          select: {
            versionNumber: true,
            payload: true,
          },
        },
      },
    });

    let isFallback = false;

    // 2. Explicit Fallback Policy (e.g. ar -> en)
    if ((!publication || !publication.version) && locale !== "en") {
      // First attempt fallback by slug in default "en"
      publication = await prisma.cmsPublication.findFirst({
        where: {
          content: {
            type,
            status: CmsContentStatus.PUBLISHED,
            slug: slugOrId,
            locale: "en",
          },
        },
        include: {
          content: {
            select: {
              id: true,
              type: true,
              title: true,
              slug: true,
              locale: true,
              metadata: true,
            },
          },
          version: {
            select: {
              versionNumber: true,
              payload: true,
            },
          },
        },
      });

      // If not resolved by slug, check if slugOrId was a content ID that has a linked translation group
      if (!publication) {
        const item = await prisma.cmsContent.findUnique({
          where: { id: slugOrId },
          select: { metadata: true, slug: true },
        });

        const meta = (item?.metadata as Record<string, unknown>) || {};
        const translationGroupId = (meta.translationGroupId as string) || (meta.sourceContentId as string);

        if (translationGroupId || item?.slug) {
          publication = await prisma.cmsPublication.findFirst({
            where: {
              content: {
                type,
                status: CmsContentStatus.PUBLISHED,
                locale: "en",
                OR: [
                  ...(translationGroupId ? [{ id: translationGroupId }] : []),
                  ...(item?.slug ? [{ slug: item.slug }] : []),
                ],
              },
            },
            include: {
              content: {
                select: {
                  id: true,
                  type: true,
                  title: true,
                  slug: true,
                  locale: true,
                  metadata: true,
                },
              },
              version: {
                select: {
                  versionNumber: true,
                  payload: true,
                },
              },
            },
          });
        }
      }

      if (publication && publication.version) {
        isFallback = true;
      }
    }

    if (!publication || !publication.version) {
      return null;
    }

    return {
      id: publication.content.id,
      type: publication.content.type,
      title: publication.content.title,
      slug: publication.content.slug,
      locale: publication.content.locale,
      requestedLocale: locale,
      isFallback,
      payload: publication.version.payload as T,
      publishedAt: publication.publishedAt,
      versionNumber: publication.version.versionNumber,
    };
  }

  /**
   * List all published items of a given content type (e.g. all FAQs or all Banners)
   * With explicit fallback to "en" for non-translated items.
   */
  async listPublishedContents<T = Record<string, unknown>>(
    type: CmsContentTypeEnum,
    locale = "en"
  ): Promise<PublicContentViewModel<T>[]> {
    const localePublications = await prisma.cmsPublication.findMany({
      where: {
        content: {
          type,
          status: CmsContentStatus.PUBLISHED,
          locale,
        },
      },
      orderBy: { publishedAt: "desc" },
      include: {
        content: {
          select: {
            id: true,
            type: true,
            title: true,
            slug: true,
            locale: true,
            metadata: true,
          },
        },
        version: {
          select: {
            versionNumber: true,
            payload: true,
          },
        },
      },
    });

    if (locale === "en") {
      return localePublications.map((pub) => ({
        id: pub.content.id,
        type: pub.content.type,
        title: pub.content.title,
        slug: pub.content.slug,
        locale: pub.content.locale,
        requestedLocale: locale,
        isFallback: false,
        payload: pub.version.payload as T,
        publishedAt: pub.publishedAt,
        versionNumber: pub.version.versionNumber,
      }));
    }

    // Non-default locale: fetch English publications as fallback pool
    const enPublications = await prisma.cmsPublication.findMany({
      where: {
        content: {
          type,
          status: CmsContentStatus.PUBLISHED,
          locale: "en",
        },
      },
      orderBy: { publishedAt: "desc" },
      include: {
        content: {
          select: {
            id: true,
            type: true,
            title: true,
            slug: true,
            locale: true,
            metadata: true,
          },
        },
        version: {
          select: {
            versionNumber: true,
            payload: true,
          },
        },
      },
    });

    const result: PublicContentViewModel<T>[] = [];
    const seenGroups = new Set<string>();

    for (const pub of localePublications) {
      const meta = (pub.content.metadata as Record<string, unknown>) || {};
      const groupId = (meta.translationGroupId as string) || pub.content.slug || pub.content.id;
      seenGroups.add(groupId);
      result.push({
        id: pub.content.id,
        type: pub.content.type,
        title: pub.content.title,
        slug: pub.content.slug,
        locale: pub.content.locale,
        requestedLocale: locale,
        isFallback: false,
        payload: pub.version.payload as T,
        publishedAt: pub.publishedAt,
        versionNumber: pub.version.versionNumber,
      });
    }

    for (const pub of enPublications) {
      const meta = (pub.content.metadata as Record<string, unknown>) || {};
      const groupId = (meta.translationGroupId as string) || pub.content.slug || pub.content.id;
      if (!seenGroups.has(groupId)) {
        seenGroups.add(groupId);
        result.push({
          id: pub.content.id,
          type: pub.content.type,
          title: pub.content.title,
          slug: pub.content.slug,
          locale: pub.content.locale,
          requestedLocale: locale,
          isFallback: true,
          payload: pub.version.payload as T,
          publishedAt: pub.publishedAt,
          versionNumber: pub.version.versionNumber,
        });
      }
    }

    return result;
  }
}

export const cmsPublicService = new CmsPublicService();
