import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import {
  CmsContentStatus,
  CmsContentTypeEnum,
  CmsScheduledActionType,
  CmsScheduledStatus,
} from "@/generated/prisma/enums";
import { validateContentPayload, getContentTypeDefinition } from "@/lib/cms/content-types";
import { invalidateCmsCache } from "@/lib/cms/cache";
import { auditService } from "@/services/audit.service";
import { cmsMediaService } from "@/services/cms-media.service";

// ─────────────────────────────────────────────────────────────────────────────
// Input Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateContentInput {
  type: CmsContentTypeEnum;
  title: string;
  slug?: string;
  locale?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  changeSummary?: string;
}

export interface UpdateDraftInput {
  title?: string;
  slug?: string;
  locale?: string;
  payload: Record<string, unknown>;
  changeSummary?: string;
  expectedVersionNumber?: number; // Optimistic concurrency check
}

export interface ListContentOptions {
  page?: number;
  limit?: number;
  type?: CmsContentTypeEnum;
  status?: CmsContentStatus;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortOrder?: "asc" | "desc";
}

export interface ScheduleActionInput {
  contentId: string;
  versionId?: string;
  actionType: CmsScheduledActionType;
  scheduledFor: Date | string;
}

export const SUPPORTED_CMS_LOCALES = [
  { locale: "en", label: "English", dir: "ltr" },
  { locale: "ar", label: "العربية (Arabic)", dir: "rtl" },
  { locale: "es", label: "Español", dir: "ltr" },
  { locale: "fr", label: "Français", dir: "ltr" },
  { locale: "de", label: "Deutsch", dir: "ltr" },
  { locale: "hi", label: "हिन्दी (Hindi)", dir: "ltr" },
] as const;

export interface TranslationSummary {
  id: string;
  locale: string;
  title: string;
  slug: string | null;
  status: CmsContentStatus;
  versionNumber: number;
  publishedVersionNumber: number | null;
  updatedAt: Date;
  isCurrent: boolean;
}

export interface ContentTranslationsResult {
  translationGroupId: string;
  sourceContentId: string;
  currentLocale: string;
  translations: TranslationSummary[];
  supportedLocales: {
    locale: string;
    label: string;
    dir: "ltr" | "rtl";
    isTranslated: boolean;
    contentId: string | null;
    status: CmsContentStatus | null;
  }[];
}

export interface CreateTranslationInput {
  sourceContentId: string;
  targetLocale: string;
  title?: string;
  slug?: string;
  payload?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CMS Service Implementation
// ─────────────────────────────────────────────────────────────────────────────

class CmsService {
  /**
   * Create a new content record and its initial version (Version 1) as DRAFT
   */
  async createContent(actor: AuthUser, input: CreateContentInput) {
    const contentTypeDef = getContentTypeDefinition(input.type);

    // Clean and normalize slug if provided (strip leading/trailing slashes)
    const cleanSlug = input.slug
      ? input.slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase()
      : null;

    if (cleanSlug) {
      const existing = await prisma.cmsContent.findFirst({
        where: {
          slug: cleanSlug,
          locale: input.locale || "en",
        },
      });
      if (existing) {
        throw AppError.conflict(
          `Content with slug "${cleanSlug}" already exists for locale "${input.locale || "en"}".`
        );
      }
    }

    // Merge provided payload with default template payload so creation with {} never fails schema
    const basePayload = (contentTypeDef.defaultPayload || {}) as Record<string, unknown>;
    const inputPayload = (input.payload && typeof input.payload === "object") ? input.payload : {};
    const mergedPayload: Record<string, unknown> = {
      ...basePayload,
      ...inputPayload,
    };

    // If input.title is provided, intelligently ensure title/heading in payload reflects the new content
    if (input.title) {
      if ("title" in basePayload || "title" in inputPayload || !mergedPayload.title) {
        if (!mergedPayload.title || mergedPayload.title === basePayload.title) {
          mergedPayload.title = input.title;
        }
      }
      if ("heading" in basePayload || "heading" in inputPayload) {
        if (!mergedPayload.heading || mergedPayload.heading === basePayload.heading) {
          mergedPayload.heading = input.title;
        }
      }
      if ("campaignName" in basePayload || "campaignName" in inputPayload) {
        if (!mergedPayload.campaignName || mergedPayload.campaignName === basePayload.campaignName) {
          mergedPayload.campaignName = input.title;
        }
      }
      if ("question" in basePayload && (!mergedPayload.question || mergedPayload.question === basePayload.question)) {
        mergedPayload.question = input.title;
      }
      if ("name" in basePayload && (!mergedPayload.name || mergedPayload.name === basePayload.name)) {
        mergedPayload.name = input.title;
      }
      if ("metaTitle" in basePayload && (!mergedPayload.metaTitle || mergedPayload.metaTitle === basePayload.metaTitle)) {
        mergedPayload.metaTitle = input.title;
      }
      if ("heroTitle" in basePayload && (!mergedPayload.heroTitle || mergedPayload.heroTitle === basePayload.heroTitle)) {
        mergedPayload.heroTitle = input.title;
      }
    }

    const validatedPayload = validateContentPayload(input.type, mergedPayload);

    return prisma.$transaction(async (tx) => {
      // 1. Create content master record
      const content = await tx.cmsContent.create({
        data: {
          type: input.type,
          title: input.title,
          slug: cleanSlug,
          locale: input.locale || "en",
          status: CmsContentStatus.DRAFT,
          metadata: (input.metadata as any) || undefined,
          createdById: actor.id,
          updatedById: actor.id,
        },
      });

      // 2. Create initial version (Version 1)
      const version = await tx.cmsContentVersion.create({
        data: {
          contentId: content.id,
          versionNumber: 1,
          title: input.title,
          slug: cleanSlug,
          locale: input.locale || "en",
          payload: validatedPayload,
          changeSummary: input.changeSummary || "Initial creation",
          createdById: actor.id,
        },
      });

      // 3. Link draft version reference and ensure translationGroupId in metadata
      const initialMetadata = {
        ...((input.metadata as Record<string, unknown>) || {}),
        translationGroupId: (input.metadata?.translationGroupId as string) || content.id,
      };

      const updatedContent = await tx.cmsContent.update({
        where: { id: content.id },
        data: {
          draftVersionId: version.id,
          metadata: initialMetadata,
        },
        include: {
          versions: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // 4. Audit Log
      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_CONTENT_CREATE",
        resourceType: "CMS_CONTENT",
        resourceId: content.id,
        description: `Created CMS content "${input.title}" (${input.type})`,
        metadata: { type: input.type, slug: input.slug, versionNumber: 1 },
      });

      return updatedContent;
    });

    const initialVer = result.versions?.[0];
    if (initialVer) {
      await cmsMediaService.syncVersionMediaReferences(initialVer.id, validatedPayload).catch((e) =>
        console.warn("[CMS] syncVersionMediaReferences warning:", e)
      );
    }

    return result;
  }

  /**
   * Update draft content (creates a new immutable revision while keeping live published version untouched)
   */
  async updateDraft(actor: AuthUser, contentId: string, input: UpdateDraftInput) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    if (content.status === CmsContentStatus.ARCHIVED) {
      throw AppError.badRequest("Cannot edit archived content. Restore it first.");
    }

    // Optimistic concurrency check
    const latestVersion = content.versions[0];
    if (
      input.expectedVersionNumber !== undefined &&
      latestVersion &&
      latestVersion.versionNumber !== input.expectedVersionNumber
    ) {
      throw AppError.conflict(
        `Concurrency conflict: You are editing version ${input.expectedVersionNumber}, but latest version is ${latestVersion.versionNumber}. Please reload and review recent changes.`
      );
    }

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const validatedPayload = validateContentPayload(content.type, input.payload);

    return prisma.$transaction(async (tx) => {
      // 1. Create new immutable version
      const newVersion = await tx.cmsContentVersion.create({
        data: {
          contentId,
          versionNumber: nextVersionNumber,
          title: input.title ?? content.title,
          slug: input.slug ?? content.slug,
          locale: input.locale ?? content.locale,
          payload: validatedPayload,
          changeSummary: input.changeSummary || `Updated draft to revision #${nextVersionNumber}`,
          createdById: actor.id,
        },
      });

      // 2. Point content draftVersionId to new version
      const updatedContent = await tx.cmsContent.update({
        where: { id: contentId },
        data: {
          title: input.title ?? content.title,
          slug: input.slug ?? content.slug,
          locale: input.locale ?? content.locale,
          draftVersionId: newVersion.id,
          updatedById: actor.id,
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

      // 3. Audit log
      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_DRAFT_UPDATE",
        resourceType: "CMS_CONTENT",
        resourceId: contentId,
        description: `Updated draft for "${updatedContent.title}" to revision #${nextVersionNumber}`,
        metadata: {
          versionNumber: nextVersionNumber,
          changeSummary: input.changeSummary,
        },
      });

      return updatedContent;
    });

    const newVer = result.versions?.[0];
    if (newVer) {
      await cmsMediaService.syncVersionMediaReferences(newVer.id, validatedPayload).catch((e) =>
        console.warn("[CMS] syncVersionMediaReferences warning:", e)
      );
    }

    return result;
  }

  /**
   * Publish a specific revision (or latest draft if unspecified) atomically
   */
  async publishRevision(actor: AuthUser, contentId: string, versionId?: string) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    const targetVersion = versionId
      ? content.versions.find((v) => v.id === versionId)
      : content.versions.find((v) => v.id === content.draftVersionId) || content.versions[0];

    if (!targetVersion) {
      throw AppError.badRequest("Target revision not found for publication");
    }

    // Re-validate target version payload to ensure integrity
    validateContentPayload(content.type, targetVersion.payload);

    return prisma.$transaction(async (tx) => {
      // 1. Upsert publication record
      const publication = await tx.cmsPublication.upsert({
        where: { contentId },
        create: {
          contentId,
          versionId: targetVersion.id,
          publishedById: actor.id,
          publishedAt: new Date(),
        },
        update: {
          versionId: targetVersion.id,
          publishedById: actor.id,
          publishedAt: new Date(),
        },
      });

      // 2. Update master content status and publishedVersionId
      const updatedContent = await tx.cmsContent.update({
        where: { id: contentId },
        data: {
          status: CmsContentStatus.PUBLISHED,
          publishedVersionId: targetVersion.id,
          updatedById: actor.id,
        },
        include: {
          publication: {
            include: {
              version: true,
              publishedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      // 3. Audit log
      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_CONTENT_PUBLISH",
        resourceType: "CMS_CONTENT",
        resourceId: contentId,
        description: `Published "${updatedContent.title}" at revision #${targetVersion.versionNumber}`,
        metadata: {
          versionNumber: targetVersion.versionNumber,
          versionId: targetVersion.id,
        },
      });

      // 4. Invalidate cache tags and paths
      await invalidateCmsCache(content.type, content.slug);

      return updatedContent;
    });
  }

  /**
   * Unpublish content atomically (leaves historical revisions and content master record intact)
   */
  async unpublishContent(actor: AuthUser, contentId: string) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: { publication: true },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    if (content.status !== CmsContentStatus.PUBLISHED && !content.publication) {
      throw AppError.badRequest("Content is not currently published");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Remove publication record
      await tx.cmsPublication.deleteMany({
        where: { contentId },
      });

      // 2. Update content status and clear publishedVersionId
      const updatedContent = await tx.cmsContent.update({
        where: { id: contentId },
        data: {
          status: CmsContentStatus.UNPUBLISHED,
          publishedVersionId: null,
          updatedById: actor.id,
        },
      });

      // 3. Audit log
      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_CONTENT_UNPUBLISH",
        resourceType: "CMS_CONTENT",
        resourceId: contentId,
        description: `Unpublished "${updatedContent.title}"`,
      });

      // 4. Invalidate cache
      await invalidateCmsCache(content.type, content.slug);

      return updatedContent;
    });
  }

  /**
   * Non-destructive rollback: restores historical version K by copying its snapshot into a NEW version N+1
   */
  async rollbackToRevision(actor: AuthUser, contentId: string, versionId: string, publishImmediately = true) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: {
        versions: {
          orderBy: { versionNumber: "desc" },
        },
      },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    const sourceVersion = content.versions.find((v) => v.id === versionId);
    if (!sourceVersion) {
      throw AppError.badRequest("Historical version to restore was not found");
    }

    const latestVersion = content.versions[0];
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    return prisma.$transaction(async (tx) => {
      // 1. Create brand new version containing historical snapshot
      const restoredVersion = await tx.cmsContentVersion.create({
        data: {
          contentId,
          versionNumber: nextVersionNumber,
          title: sourceVersion.title,
          slug: sourceVersion.slug,
          locale: sourceVersion.locale,
          payload: sourceVersion.payload as any,
          changeSummary: `Restored snapshot from revision #${sourceVersion.versionNumber}`,
          createdById: actor.id,
        },
      });

      // 2. Set as draft
      await tx.cmsContent.update({
        where: { id: contentId },
        data: {
          draftVersionId: restoredVersion.id,
          updatedById: actor.id,
        },
      });

      // 3. Audit log
      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_VERSION_ROLLBACK",
        resourceType: "CMS_CONTENT",
        resourceId: contentId,
        description: `Restored revision #${sourceVersion.versionNumber} as new revision #${nextVersionNumber}`,
        metadata: {
          sourceVersionNumber: sourceVersion.versionNumber,
          newVersionNumber: nextVersionNumber,
        },
      });

      if (publishImmediately) {
        // Publish the newly restored version
        await tx.cmsPublication.upsert({
          where: { contentId },
          create: {
            contentId,
            versionId: restoredVersion.id,
            publishedById: actor.id,
            publishedAt: new Date(),
          },
          update: {
            versionId: restoredVersion.id,
            publishedById: actor.id,
            publishedAt: new Date(),
          },
        });

        await tx.cmsContent.update({
          where: { id: contentId },
          data: {
            status: CmsContentStatus.PUBLISHED,
            publishedVersionId: restoredVersion.id,
          },
        });

        await invalidateCmsCache(content.type, content.slug);
      }

      return tx.cmsContent.findUnique({
        where: { id: contentId },
        include: {
          publication: { include: { version: true } },
          versions: { orderBy: { versionNumber: "desc" } },
        },
      });
    });
  }

  /**
   * Archive content
   */
  async archiveContent(actor: AuthUser, contentId: string) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: { publication: true },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    return prisma.$transaction(async (tx) => {
      if (content.publication) {
        await tx.cmsPublication.deleteMany({ where: { contentId } });
      }

      const updated = await tx.cmsContent.update({
        where: { id: contentId },
        data: {
          status: CmsContentStatus.ARCHIVED,
          publishedVersionId: null,
          updatedById: actor.id,
        },
      });

      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_CONTENT_ARCHIVE",
        resourceType: "CMS_CONTENT",
        resourceId: contentId,
        description: `Archived content "${updated.title}"`,
      });

      await invalidateCmsCache(content.type, content.slug);
      return updated;
    });
  }

  /**
   * Restore archived content back to DRAFT
   */
  async restoreArchivedContent(actor: AuthUser, contentId: string) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    if (content.status !== CmsContentStatus.ARCHIVED) {
      throw AppError.badRequest("Content is not archived");
    }

    const updated = await prisma.cmsContent.update({
      where: { id: contentId },
      data: {
        status: CmsContentStatus.DRAFT,
        updatedById: actor.id,
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_CONTENT_RESTORE",
      resourceType: "CMS_CONTENT",
      resourceId: contentId,
      description: `Restored archived content "${updated.title}" to DRAFT`,
    });

    return updated;
  }

  /**
   * List CMS Content with search, filters, and pagination
   */
  async listContent(options: ListContentOptions = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cmsContent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          publication: {
            select: {
              id: true,
              publishedAt: true,
              version: { select: { id: true, versionNumber: true } },
            },
          },
          _count: { select: { versions: true } },
        },
      }),
      prisma.cmsContent.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get content by ID with draft revision and publication details
   */
  async getContentById(contentId: string) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        publication: {
          include: {
            version: true,
            publishedBy: { select: { id: true, name: true, email: true } },
          },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 10,
        },
      },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    // Resolve draft version snapshot
    let draftVersion = null;
    if (content.draftVersionId) {
      draftVersion = await prisma.cmsContentVersion.findUnique({
        where: { id: content.draftVersionId },
      });
    }

    return {
      ...content,
      draftVersion: draftVersion || content.versions[0] || null,
    };
  }

  /**
   * List all historical revisions of a content item
   */
  async listRevisions(contentId: string) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      select: { id: true, title: true, publishedVersionId: true, draftVersionId: true },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    const versions = await prisma.cmsContentVersion.findMany({
      where: { contentId },
      orderBy: { versionNumber: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      contentId,
      contentTitle: content.title,
      publishedVersionId: content.publishedVersionId,
      draftVersionId: content.draftVersionId,
      versions,
    };
  }

  /**
   * Compare two revisions side-by-side
   */
  async compareRevisions(v1Id: string, v2Id: string) {
    const [v1, v2] = await Promise.all([
      prisma.cmsContentVersion.findUnique({
        where: { id: v1Id },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      }),
      prisma.cmsContentVersion.findUnique({
        where: { id: v2Id },
        include: { createdBy: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    if (!v1 || !v2) {
      throw AppError.notFound("One or both revisions were not found");
    }

    return {
      versionA: v1,
      versionB: v2,
    };
  }

  /**
   * Schedule a future publish or unpublish action
   */
  async scheduleAction(actor: AuthUser, input: ScheduleActionInput) {
    const content = await prisma.cmsContent.findUnique({
      where: { id: input.contentId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });

    if (!content) {
      throw AppError.notFound("CMS content not found");
    }

    const scheduledDate = new Date(input.scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      throw AppError.badRequest("Invalid scheduled date format");
    }

    if (scheduledDate.getTime() <= Date.now()) {
      throw AppError.badRequest("Scheduled time must be in the future");
    }

    const scheduledAction = await prisma.cmsScheduledAction.create({
      data: {
        contentId: input.contentId,
        versionId: input.versionId || content.draftVersionId || content.versions[0]?.id || null,
        actionType: input.actionType,
        scheduledFor: scheduledDate,
        status: CmsScheduledStatus.PENDING,
        createdById: actor.id,
      },
      include: {
        content: { select: { id: true, title: true, type: true } },
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_SCHEDULE_CREATE",
      resourceType: "CMS_SCHEDULE",
      resourceId: scheduledAction.id,
      description: `Scheduled ${input.actionType} for "${content.title}" at ${scheduledDate.toISOString()}`,
      metadata: {
        actionType: input.actionType,
        scheduledFor: scheduledDate.toISOString(),
      },
    });

    return scheduledAction;
  }

  /**
   * Cancel a pending scheduled action
   */
  async cancelScheduledAction(actor: AuthUser, actionId: string) {
    const action = await prisma.cmsScheduledAction.findUnique({
      where: { id: actionId },
      include: { content: true },
    });

    if (!action) {
      throw AppError.notFound("Scheduled action not found");
    }

    if (action.status !== CmsScheduledStatus.PENDING) {
      throw AppError.badRequest(`Cannot cancel action in status "${action.status}"`);
    }

    const updated = await prisma.cmsScheduledAction.update({
      where: { id: actionId },
      data: { status: CmsScheduledStatus.CANCELLED },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_SCHEDULE_CANCEL",
      resourceType: "CMS_SCHEDULE",
      resourceId: actionId,
      description: `Cancelled scheduled action for "${action.content?.title}"`,
    });

    return updated;
  }

  /**
   * List scheduled actions
   */
  async listScheduledActions(status?: CmsScheduledStatus) {
    return prisma.cmsScheduledAction.findMany({
      where: status ? { status } : undefined,
      orderBy: { scheduledFor: "asc" },
      include: {
        content: { select: { id: true, title: true, type: true, status: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Get translation group details, existing translations, and translation completeness for all supported locales
   */
  async getTranslations(contentId: string): Promise<ContentTranslationsResult> {
    const current = await prisma.cmsContent.findUnique({
      where: { id: contentId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        publication: { select: { version: { select: { versionNumber: true } } } },
      },
    });

    if (!current) {
      throw AppError.notFound("CMS content not found");
    }

    const currentMeta = (current.metadata as Record<string, unknown>) || {};
    const translationGroupId = (currentMeta.translationGroupId as string) || current.id;

    const candidates = await prisma.cmsContent.findMany({
      where: {
        type: current.type,
      },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        publication: { select: { version: { select: { versionNumber: true } } } },
      },
    });

    const siblings = candidates.filter((item) => {
      if (item.id === current.id || item.id === translationGroupId) return true;
      const meta = item.metadata as Record<string, unknown> | null;
      if (meta?.translationGroupId === translationGroupId) return true;
      if (current.slug && item.slug === current.slug) return true;
      return false;
    });

    const translations: TranslationSummary[] = siblings.map((item) => ({
      id: item.id,
      locale: item.locale,
      title: item.title,
      slug: item.slug,
      status: item.status,
      versionNumber: item.versions[0]?.versionNumber ?? 1,
      publishedVersionNumber: item.publication?.version?.versionNumber ?? null,
      updatedAt: item.updatedAt,
      isCurrent: item.id === current.id,
    }));

    const supportedLocales = SUPPORTED_CMS_LOCALES.map((sup) => {
      const existing = translations.find((t) => t.locale === sup.locale);
      return {
        locale: sup.locale,
        label: sup.label,
        dir: sup.dir,
        isTranslated: !!existing,
        contentId: existing ? existing.id : null,
        status: existing ? existing.status : null,
      };
    });

    return {
      translationGroupId,
      sourceContentId: current.id,
      currentLocale: current.locale,
      translations,
      supportedLocales,
    };
  }

  /**
   * Create a new translation variant for a content item in targetLocale
   */
  async createTranslation(actor: AuthUser, input: CreateTranslationInput) {
    const supported = SUPPORTED_CMS_LOCALES.find((l) => l.locale === input.targetLocale);
    if (!supported) {
      throw AppError.badRequest(
        `Unsupported locale: "${input.targetLocale}". Supported: ${SUPPORTED_CMS_LOCALES.map((l) => l.locale).join(", ")}`
      );
    }

    const source = await prisma.cmsContent.findUnique({
      where: { id: input.sourceContentId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });

    if (!source) {
      throw AppError.notFound("Source CMS content not found");
    }

    if (source.locale === input.targetLocale) {
      throw AppError.badRequest(`Source content is already in locale "${source.locale}"`);
    }

    const sourceMeta = (source.metadata as Record<string, unknown>) || {};
    const translationGroupId = (sourceMeta.translationGroupId as string) || source.id;

    const existingGroup = await this.getTranslations(source.id);
    const alreadyExists = existingGroup.translations.find((t) => t.locale === input.targetLocale);
    if (alreadyExists) {
      throw AppError.conflict(
        `Translation for locale "${input.targetLocale}" already exists (Content ID: ${alreadyExists.id}).`
      );
    }

    const latestVersion = source.versions[0];
    const sourcePayload = (latestVersion?.payload as Record<string, unknown>) || {};
    const mergedPayload = {
      ...sourcePayload,
      ...(input.payload || {}),
    };

    const targetTitle = input.title || `${source.title} (${supported.label})`;
    const targetSlug = input.slug || source.slug;

    const validatedPayload = validateContentPayload(source.type, mergedPayload);

    return prisma.$transaction(async (tx) => {
      if (!sourceMeta.translationGroupId) {
        await tx.cmsContent.update({
          where: { id: source.id },
          data: {
            metadata: {
              ...sourceMeta,
              translationGroupId: source.id,
            },
          },
        });
      }

      const newContent = await tx.cmsContent.create({
        data: {
          type: source.type,
          title: targetTitle,
          slug: targetSlug,
          locale: input.targetLocale,
          status: CmsContentStatus.DRAFT,
          metadata: {
            ...sourceMeta,
            translationGroupId,
            sourceContentId: source.id,
            sourceLocale: source.locale,
          },
          createdById: actor.id,
          updatedById: actor.id,
        },
      });

      const newVersion = await tx.cmsContentVersion.create({
        data: {
          contentId: newContent.id,
          versionNumber: 1,
          title: targetTitle,
          slug: targetSlug,
          locale: input.targetLocale,
          payload: validatedPayload,
          changeSummary: `Initial translation cloned from ${source.locale.toUpperCase()} revision #${latestVersion?.versionNumber || 1}`,
          createdById: actor.id,
        },
      });

      const updated = await tx.cmsContent.update({
        where: { id: newContent.id },
        data: { draftVersionId: newVersion.id },
        include: {
          versions: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_TRANSLATION_CREATE",
        resourceType: "CMS_CONTENT",
        resourceId: newContent.id,
        description: `Created ${supported.label} (${input.targetLocale}) translation for "${source.title}"`,
        metadata: {
          sourceContentId: source.id,
          targetLocale: input.targetLocale,
          translationGroupId,
        },
      });

      return updated;
    });
  }
}

export const cmsService = new CmsService();

