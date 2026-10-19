import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { CmsContentStatus, CmsContentTypeEnum } from "@/generated/prisma/enums";
import {
  FooterConfigPayloadSchema,
  type FooterConfigPayload,
  getContentTypeDefinition,
} from "@/lib/cms/content-types";
import { invalidateCmsCache } from "@/lib/cms/cache";
import { auditService } from "@/services/audit.service";
import type { Prisma } from "@/generated/prisma/client";

export const MAIN_FOOTER_SLUG = "footer-main";

export class CmsFooterService {
  /**
   * Return high-quality fallback default footer configuration
   */
  getDefaultFooter(): FooterConfigPayload {
    const def = getContentTypeDefinition(CmsContentTypeEnum.FOOTER_CONFIG);
    return def.defaultPayload as unknown as FooterConfigPayload;
  }

  /**
   * Get the active published footer configuration.
   * If the requested locale is not available, falls back to "en".
   * If database query fails or no published footer is found, returns default fallback.
   */
  async getPublishedFooter(locale = "en"): Promise<FooterConfigPayload> {
    try {
      // 1. Primary lookup by requested locale
      let publication = await prisma.cmsPublication.findFirst({
        where: {
          content: {
            type: CmsContentTypeEnum.FOOTER_CONFIG,
            status: CmsContentStatus.PUBLISHED,
            locale,
          },
        },
        include: {
          version: true,
          content: true,
        },
      });

      // 2. Fallback to English if not found
      if ((!publication || !publication.version) && locale !== "en") {
        publication = await prisma.cmsPublication.findFirst({
          where: {
            content: {
              type: CmsContentTypeEnum.FOOTER_CONFIG,
              status: CmsContentStatus.PUBLISHED,
              locale: "en",
            },
          },
          include: {
            version: true,
            content: true,
          },
        });
      }

      if (publication && publication.version?.payload) {
        const parsed = FooterConfigPayloadSchema.safeParse(publication.version.payload);
        if (parsed.success) {
          // If the content is in English but user requested a different locale and the payload has translations,
          // merge localized strings
          const data = parsed.data;
          if (locale !== "en" && data.translations && data.translations[locale]) {
            const loc = data.translations[locale];
            if (loc.copyrightNotice) data.copyrightNotice = loc.copyrightNotice;
            if (loc.legalNotice) data.legalNotice = loc.legalNotice;
          }

          // Also check column and link translations
          if (locale !== "en") {
            data.columns = data.columns.map((col) => {
              const colTrans = col.translations?.[locale];
              return {
                ...col,
                title: colTrans?.title || col.title,
                links: col.links.map((link) => {
                  const linkTrans = link.translations?.[locale];
                  return {
                    ...link,
                    label: linkTrans?.label || link.label,
                  };
                }),
              };
            });

            data.bottomLinks = (data.bottomLinks || []).map((bLink) => {
              const bTrans = bLink.translations?.[locale];
              return {
                ...bLink,
                label: bTrans?.label || bLink.label,
              };
            });
          }

          return data;
        }
      }
    } catch (err) {
      console.warn("[CmsFooterService] Error resolving published footer:", err);
    }

    return this.getDefaultFooter();
  }

  /**
   * Get draft or current footer configuration for admin editor
   */
  async getDraftFooter(locale = "en"): Promise<{
    contentId: string | null;
    status: CmsContentStatus;
    versionNumber: number;
    publishedVersionNumber: number | null;
    payload: FooterConfigPayload;
    versions: Array<{
      id: string;
      versionNumber: number;
      createdAt: Date;
      changeSummary: string | null;
      isPublished: boolean;
      isDraft: boolean;
    }>;
  }> {
    const content = await prisma.cmsContent.findFirst({
      where: {
        type: CmsContentTypeEnum.FOOTER_CONFIG,
        locale,
      },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
        publication: {
          include: { version: true },
        },
      },
    });

    if (!content || content.versions.length === 0) {
      return {
        contentId: null,
        status: CmsContentStatus.DRAFT,
        versionNumber: 0,
        publishedVersionNumber: null,
        payload: this.getDefaultFooter(),
        versions: [],
      };
    }

    const draftVersion =
      content.versions.find((v: { id: string }) => v.id === content.draftVersionId) ||
      content.versions[0];

    const parsed = FooterConfigPayloadSchema.safeParse(draftVersion.payload);
    const payload = parsed.success ? parsed.data : this.getDefaultFooter();

    const publishedVersionNumber =
      content.publication?.version?.versionNumber ?? null;

    const versions = content.versions.map((v: { id: string; versionNumber: number; createdAt: Date; changeSummary: string | null }) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      createdAt: v.createdAt,
      changeSummary: v.changeSummary,
      isPublished: v.id === content.publishedVersionId,
      isDraft: v.id === content.draftVersionId,
    }));

    return {
      contentId: content.id,
      status: content.status,
      versionNumber: draftVersion.versionNumber,
      publishedVersionNumber,
      payload,
      versions,
    };
  }

  /**
   * Save a draft revision of the footer configuration
   */
  async saveDraft(
    actor: AuthUser,
    payload: unknown,
    changeSummary = "Updated footer configuration draft",
    locale = "en"
  ) {
    const validated = FooterConfigPayloadSchema.parse(payload);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let validActorId: string | null = null;
      if (actor?.id) {
        const u = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } });
        if (u) validActorId = u.id;
      }

      let content = await tx.cmsContent.findFirst({
        where: {
          type: CmsContentTypeEnum.FOOTER_CONFIG,
          locale,
        },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!content) {
        content = await tx.cmsContent.create({
          data: {
            type: CmsContentTypeEnum.FOOTER_CONFIG,
            title: `Global Footer (${locale.toUpperCase()})`,
            slug: MAIN_FOOTER_SLUG,
            locale,
            status: CmsContentStatus.DRAFT,
            createdById: validActorId,
            updatedById: validActorId,
          },
          include: {
            versions: true,
          },
        });
      }

      const nextVersionNumber = (content.versions[0]?.versionNumber ?? 0) + 1;

      const newVersion = await tx.cmsContentVersion.create({
        data: {
          contentId: content.id,
          versionNumber: nextVersionNumber,
          title: content.title,
          slug: content.slug,
          locale,
          payload: validated as any,
          changeSummary,
          createdById: validActorId,
        },
      });

      const updatedContent = await tx.cmsContent.update({
        where: { id: content.id },
        data: {
          draftVersionId: newVersion.id,
          updatedById: validActorId,
          status:
            content.status === CmsContentStatus.PUBLISHED
              ? CmsContentStatus.PUBLISHED
              : CmsContentStatus.DRAFT,
        },
      });

      try {
        await auditService.record({
          actorId: validActorId || undefined,
          actorEmail: actor.email,
          action: "CMS_FOOTER_DRAFT_SAVE",
          resourceType: "CMS_CONTENT",
          resourceId: content.id,
          description: `Saved footer draft revision #${newVersion.versionNumber}`,
          metadata: {
            locale,
            versionNumber: newVersion.versionNumber,
            versionId: newVersion.id,
          },
        });
      } catch (auditErr) {
        console.warn("[CmsFooterService] Audit recording warning:", auditErr);
      }

      return {
        content: updatedContent,
        version: newVersion,
      };
    });
  }

  /**
   * Publish the footer configuration revision
   */
  async publishFooter(actor: AuthUser, versionId?: string, locale = "en") {
    const content = await prisma.cmsContent.findFirst({
      where: {
        type: CmsContentTypeEnum.FOOTER_CONFIG,
        locale,
      },
      include: {
        versions: true,
      },
    });

    if (!content) {
      throw AppError.notFound(`No footer configuration found for locale "${locale}"`);
    }

    const targetVersion = versionId
      ? content.versions.find((v: { id: string }) => v.id === versionId)
      : content.versions.find((v: { id: string }) => v.id === content.draftVersionId) ||
        content.versions[content.versions.length - 1];

    if (!targetVersion) {
      throw AppError.badRequest("Target revision not found for publication");
    }

    // Validate payload integrity before publishing
    FooterConfigPayloadSchema.parse(targetVersion.payload);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let validActorId: string | null = null;
      if (actor?.id) {
        const u = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } });
        if (u) validActorId = u.id;
      }

      await tx.cmsPublication.upsert({
        where: { contentId: content.id },
        create: {
          contentId: content.id,
          versionId: targetVersion.id,
          publishedById: validActorId,
          publishedAt: new Date(),
        },
        update: {
          versionId: targetVersion.id,
          publishedById: validActorId,
          publishedAt: new Date(),
        },
      });

      const updated = await tx.cmsContent.update({
        where: { id: content.id },
        data: {
          status: CmsContentStatus.PUBLISHED,
          publishedVersionId: targetVersion.id,
          updatedById: validActorId,
        },
      });

      try {
        await auditService.record({
          actorId: validActorId || undefined,
          actorEmail: actor.email,
          action: "CMS_FOOTER_PUBLISH",
          resourceType: "CMS_CONTENT",
          resourceId: content.id,
          description: `Published footer revision #${targetVersion.versionNumber}`,
          metadata: {
            locale,
            versionNumber: targetVersion.versionNumber,
            versionId: targetVersion.id,
          },
        });
      } catch (auditErr) {
        console.warn("[CmsFooterService] Audit recording warning:", auditErr);
      }

      await invalidateCmsCache(CmsContentTypeEnum.FOOTER_CONFIG, content.slug);

      return updated;
    });
  }

  /**
   * Rollback footer configuration to a specified version
   */
  async rollbackFooter(actor: AuthUser, targetVersionId: string, locale = "en") {
    const content = await prisma.cmsContent.findFirst({
      where: {
        type: CmsContentTypeEnum.FOOTER_CONFIG,
        locale,
      },
      include: {
        versions: true,
      },
    });

    if (!content) {
      throw AppError.notFound(`No footer configuration found for locale "${locale}"`);
    }

    const targetVersion = content.versions.find((v: { id: string }) => v.id === targetVersionId);
    if (!targetVersion) {
      throw AppError.notFound("Target revision not found for rollback");
    }

    FooterConfigPayloadSchema.parse(targetVersion.payload);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let validActorId: string | null = null;
      if (actor?.id) {
        const u = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } });
        if (u) validActorId = u.id;
      }

      // Create new version restoring the target payload
      const nextVersionNumber =
        Math.max(...content.versions.map((v: { versionNumber: number }) => v.versionNumber), 0) + 1;

      const restoredVersion = await tx.cmsContentVersion.create({
        data: {
          contentId: content.id,
          versionNumber: nextVersionNumber,
          title: content.title,
          slug: content.slug,
          locale,
          payload: targetVersion.payload as any,
          changeSummary: `Rolled back to revision #${targetVersion.versionNumber}`,
          createdById: validActorId,
        },
      });

      await tx.cmsPublication.upsert({
        where: { contentId: content.id },
        create: {
          contentId: content.id,
          versionId: restoredVersion.id,
          publishedById: validActorId,
          publishedAt: new Date(),
        },
        update: {
          versionId: restoredVersion.id,
          publishedById: validActorId,
          publishedAt: new Date(),
        },
      });

      const updated = await tx.cmsContent.update({
        where: { id: content.id },
        data: {
          status: CmsContentStatus.PUBLISHED,
          publishedVersionId: restoredVersion.id,
          draftVersionId: restoredVersion.id,
          updatedById: validActorId,
        },
      });

      try {
        await auditService.record({
          actorId: validActorId || undefined,
          actorEmail: actor.email,
          action: "CMS_FOOTER_ROLLBACK",
          resourceType: "CMS_CONTENT",
          resourceId: content.id,
          description: `Rolled back footer to revision #${targetVersion.versionNumber} as new revision #${restoredVersion.versionNumber}`,
          metadata: {
            locale,
            targetVersionId,
            restoredVersionNumber: restoredVersion.versionNumber,
          },
        });
      } catch (auditErr) {
        console.warn("[CmsFooterService] Audit recording warning:", auditErr);
      }

      await invalidateCmsCache(CmsContentTypeEnum.FOOTER_CONFIG, content.slug);

      return updated;
    });
  }
}

export const cmsFooterService = new CmsFooterService();
