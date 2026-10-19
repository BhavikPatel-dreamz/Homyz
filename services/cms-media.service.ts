import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import {
  savePublicMedia,
  deletePublicMedia,
  parseManagedMediaUrl,
} from "@/lib/storage/media";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { auditService } from "@/services/audit.service";
import { CmsContentStatus, CmsScheduledStatus } from "@/generated/prisma/enums";

export interface UploadMediaParams {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
  title?: string;
  altText?: string;
}

export interface ListMediaOptions {
  page?: number;
  limit?: number;
  search?: string;
  mimeType?: string;
  status?: string;
}

export interface MediaUsageItem {
  contentId: string;
  contentTitle: string;
  contentType: string;
  versionId: string;
  versionNumber: number;
  isLivePublished: boolean;
  isCurrentDraft: boolean;
  isHistorical: boolean;
  isScheduled: boolean;
  locale: string;
}

export interface MediaUsageSummary {
  assetId: string;
  originalFilename: string;
  url: string;
  totalReferences: number;
  livePublishedCount: number;
  currentDraftCount: number;
  historicalCount: number;
  scheduledCount: number;
  canPermanentlyDelete: boolean;
  canArchive: boolean;
  references: MediaUsageItem[];
}

export interface BulkDeleteResult {
  total: number;
  deleted: string[];
  blocked: {
    id: string;
    originalFilename: string;
    reason: string;
    liveCount: number;
    draftCount: number;
  }[];
  failed: {
    id: string;
    error: string;
  }[];
}

class CmsMediaService {
  /**
   * Upload an image to the CMS media library with signature validation and metadata extraction
   */
  async uploadMedia(actor: AuthUser, params: UploadMediaParams) {
    const validation = validatePublicImageUpload({
      fileName: params.fileName,
      mimeType: params.mimeType,
      size: params.size,
      buffer: params.buffer,
    });

    if (validation) {
      throw AppError.badRequest(validation.message);
    }

    const extensionByMime: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const ext = extensionByMime[params.mimeType] || ".jpg";
    const storageFileName = `cms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

    // Persist to storage backend (S3, media server, or local disk)
    const saved = await savePublicMedia({
      kind: "cms-media",
      fileName: storageFileName,
      body: params.buffer,
      contentType: params.mimeType,
    });

    // Extract exact storage key from saved.url (e.g. 2026/10/cms_...jpg)
    const parsed = parseManagedMediaUrl(saved.url);
    const resolvedKey = parsed?.fileName || storageFileName;

    // Create CmsMediaAsset in database
    const mediaAsset = await prisma.cmsMediaAsset.create({
      data: {
        key: resolvedKey,
        url: saved.url,
        originalFilename: params.fileName,
        mimeType: params.mimeType,
        size: params.size,
        title: params.title || params.fileName,
        altText: params.altText || "",
        uploaderId: actor.id,
        status: "READY",
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
    });

    // Create standard responsive variants metadata
    await prisma.cmsMediaVariant.createMany({
      data: [
        {
          mediaAssetId: mediaAsset.id,
          variantName: "thumbnail",
          key: `${resolvedKey}_thumb`,
          url: saved.url,
          mimeType: params.mimeType,
          width: 320,
          height: 240,
          size: Math.round(params.size * 0.3),
        },
        {
          mediaAssetId: mediaAsset.id,
          variantName: "mobile",
          key: `${resolvedKey}_mobile`,
          url: saved.url,
          mimeType: params.mimeType,
          width: 768,
          height: 512,
          size: Math.round(params.size * 0.6),
        },
        {
          mediaAssetId: mediaAsset.id,
          variantName: "desktop",
          key: `${resolvedKey}_desktop`,
          url: saved.url,
          mimeType: params.mimeType,
          width: 1920,
          height: 1080,
          size: params.size,
        },
      ],
      skipDuplicates: true,
    });

    // Audit Log
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_MEDIA_UPLOAD",
      resourceType: "CMS_MEDIA",
      resourceId: mediaAsset.id,
      description: `Uploaded media "${params.fileName}" (${params.mimeType}, ${params.size} bytes)`,
      metadata: { key: resolvedKey, url: saved.url },
    });

    return mediaAsset;
  }

  /**
   * List media library items with pagination, search, filters, and usage count
   */
  async listMedia(options: ListMediaOptions = {}) {
    const { page = 1, limit = 24, search, mimeType, status = "READY" } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (mimeType) {
      if (mimeType.includes("/")) {
        where.mimeType = mimeType;
      } else {
        where.mimeType = { contains: mimeType, mode: "insensitive" };
      }
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { originalFilename: { contains: search, mode: "insensitive" } },
        { altText: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.cmsMediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          uploader: { select: { id: true, name: true, email: true } },
          variants: true,
          _count: { select: { references: true } },
        },
      }),
      prisma.cmsMediaAsset.count({ where }),
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
   * Comprehensive usage detection for a media asset across all CMS content, drafts, publications, and schedules
   */
  async getMediaUsage(id: string): Promise<MediaUsageSummary> {
    const asset = await prisma.cmsMediaAsset.findUnique({
      where: { id },
      include: {
        references: {
          include: {
            version: {
              include: {
                content: {
                  include: {
                    scheduledActions: {
                      where: { status: CmsScheduledStatus.PENDING },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    const referencesMap = new Map<string, MediaUsageItem>();

    // 1. Process explicit CmsMediaReference records
    for (const ref of asset.references) {
      const v = ref.version;
      const c = v.content;
      const isLivePublished = c.publishedVersionId === v.id && c.status === CmsContentStatus.PUBLISHED;
      const isCurrentDraft = c.draftVersionId === v.id;
      const isHistorical = !isLivePublished && !isCurrentDraft;
      const isScheduled = c.scheduledActions?.some((a: { versionId: string | null }) => a.versionId === v.id) ?? false;

      referencesMap.set(`${c.id}_${v.id}`, {
        contentId: c.id,
        contentTitle: c.title,
        contentType: c.type,
        versionId: v.id,
        versionNumber: v.versionNumber,
        locale: c.locale,
        isLivePublished,
        isCurrentDraft,
        isHistorical,
        isScheduled,
      });
    }

    // 2. Deep scan JSON payloads across all non-archived CMS content versions
    const allContents = await prisma.cmsContent.findMany({
      where: {
        status: { not: CmsContentStatus.ARCHIVED },
      },
      include: {
        versions: {
          select: {
            id: true,
            versionNumber: true,
            payload: true,
          },
        },
        scheduledActions: {
          where: { status: CmsScheduledStatus.PENDING },
          select: { versionId: true },
        },
      },
    });

    const urlNeedle = asset.url;
    const keyNeedle = asset.key;

    for (const content of allContents) {
      for (const version of content.versions) {
        const payloadStr = JSON.stringify(version.payload || {});
        if (
          payloadStr.includes(urlNeedle) ||
          (keyNeedle && payloadStr.includes(keyNeedle))
        ) {
          const isLivePublished = content.publishedVersionId === version.id && content.status === CmsContentStatus.PUBLISHED;
          const isCurrentDraft = content.draftVersionId === version.id;
          const isHistorical = !isLivePublished && !isCurrentDraft;
          const isScheduled = content.scheduledActions?.some((a: { versionId: string | null }) => a.versionId === version.id) ?? false;

          referencesMap.set(`${content.id}_${version.id}`, {
            contentId: content.id,
            contentTitle: content.title,
            contentType: content.type,
            versionId: version.id,
            versionNumber: version.versionNumber,
            locale: content.locale,
            isLivePublished,
            isCurrentDraft,
            isHistorical,
            isScheduled,
          });
        }
      }
    }

    const references = Array.from(referencesMap.values());
    const livePublishedCount = references.filter((r) => r.isLivePublished).length;
    const currentDraftCount = references.filter((r) => r.isCurrentDraft).length;
    const historicalCount = references.filter((r) => r.isHistorical).length;
    const scheduledCount = references.filter((r) => r.isScheduled).length;
    const totalReferences = references.length;

    return {
      assetId: asset.id,
      originalFilename: asset.originalFilename,
      url: asset.url,
      totalReferences,
      livePublishedCount,
      currentDraftCount,
      historicalCount,
      scheduledCount,
      canPermanentlyDelete: totalReferences === 0,
      canArchive: totalReferences > 0 && livePublishedCount === 0 && currentDraftCount === 0 && scheduledCount === 0,
      references,
    };
  }

  /**
   * Get media asset by ID with usage details
   */
  async getMediaById(id: string) {
    const asset = await prisma.cmsMediaAsset.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
        variants: true,
      },
    });

    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    const usage = await this.getMediaUsage(id);

    return {
      ...asset,
      usage,
    };
  }

  /**
   * Update media asset metadata (title, alt text, multilingual alt texts)
   */
  async updateMediaMetadata(
    actor: AuthUser,
    id: string,
    data: { title?: string; altText?: string; altTexts?: Record<string, string> }
  ) {
    const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    const currentMeta = (asset.metadata as Record<string, unknown>) || {};
    const updatedMeta = data.altTexts
      ? { ...currentMeta, altTexts: data.altTexts }
      : currentMeta;

    const updated = await prisma.cmsMediaAsset.update({
      where: { id },
      data: {
        title: data.title ?? asset.title,
        altText: data.altText ?? asset.altText,
        metadata: updatedMeta,
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_MEDIA_UPDATE",
      resourceType: "CMS_MEDIA",
      resourceId: id,
      description: `Updated metadata for media asset "${asset.originalFilename}"`,
      metadata: { title: data.title, altText: data.altText },
    });

    return updated;
  }

  /**
   * Replace underlying image for an existing media asset (retains asset ID and references)
   */
  async replaceMedia(actor: AuthUser, id: string, params: UploadMediaParams) {
    const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    const validation = validatePublicImageUpload({
      fileName: params.fileName,
      mimeType: params.mimeType,
      size: params.size,
      buffer: params.buffer,
    });

    if (validation) {
      throw AppError.badRequest(validation.message);
    }

    const extensionByMime: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const ext = extensionByMime[params.mimeType] || ".jpg";
    const newStorageFileName = `cms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

    // Upload new image
    const saved = await savePublicMedia({
      kind: "cms-media",
      fileName: newStorageFileName,
      body: params.buffer,
      contentType: params.mimeType,
    });

    const parsedNew = parseManagedMediaUrl(saved.url);
    const newResolvedKey = parsedNew?.fileName || newStorageFileName;

    // Remove old physical file from storage safely
    try {
      const parsedOld = parseManagedMediaUrl(asset.url);
      const oldStorageFileName = parsedOld?.fileName || asset.key;
      await deletePublicMedia({
        kind: "cms-media",
        fileName: oldStorageFileName,
      });
    } catch (err) {
      console.warn(`[CMS MEDIA] Warning cleaning up replaced file for ${asset.id}:`, err);
    }

    // Update CmsMediaAsset
    const updated = await prisma.cmsMediaAsset.update({
      where: { id },
      data: {
        key: newResolvedKey,
        url: saved.url,
        originalFilename: params.fileName,
        mimeType: params.mimeType,
        size: params.size,
        updatedAt: new Date(),
      },
    });

    // Update variants
    await prisma.cmsMediaVariant.deleteMany({ where: { mediaAssetId: id } });
    await prisma.cmsMediaVariant.createMany({
      data: [
        {
          mediaAssetId: id,
          variantName: "thumbnail",
          key: `${newResolvedKey}_thumb`,
          url: saved.url,
          mimeType: params.mimeType,
          width: 320,
          height: 240,
          size: Math.round(params.size * 0.3),
        },
        {
          mediaAssetId: id,
          variantName: "desktop",
          key: `${newResolvedKey}_desktop`,
          url: saved.url,
          mimeType: params.mimeType,
          width: 1920,
          height: 1080,
          size: params.size,
        },
      ],
      skipDuplicates: true,
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_MEDIA_REPLACE",
      resourceType: "CMS_MEDIA",
      resourceId: id,
      description: `Replaced media asset file for "${asset.originalFilename}" with "${params.fileName}"`,
      metadata: { oldUrl: asset.url, newUrl: saved.url },
    });

    return updated;
  }

  /**
   * Safe single delete: checks active references across draft, published, and historical content
   */
  async deleteMedia(actor: AuthUser, id: string, options?: { forceArchive?: boolean }) {
    const usage = await this.getMediaUsage(id);
    const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });

    if (!asset) {
      throw AppError.notFound("Media asset not found");
    }

    // 1. Guard against active live or draft usage
    if (usage.livePublishedCount > 0 || usage.currentDraftCount > 0 || usage.scheduledCount > 0) {
      const activeTitles = usage.references
        .filter((r) => r.isLivePublished || r.isCurrentDraft || r.isScheduled)
        .map((r) => `"${r.contentTitle}" (${r.isLivePublished ? "LIVE PUBLISHED" : r.isCurrentDraft ? "CURRENT DRAFT" : "SCHEDULED"})`)
        .slice(0, 3)
        .join(", ");

      throw AppError.conflict(
        `This image is currently used by ${usage.livePublishedCount + usage.currentDraftCount + usage.scheduledCount} active CMS item(s), including ${activeTitles}. Replace or remove those references before deleting it.`
      );
    }

    // 2. Guard against historical references to protect rollback and version history
    if (usage.historicalCount > 0) {
      if (!options?.forceArchive) {
        throw AppError.conflict(
          `This image is referenced by ${usage.historicalCount} historical CMS revision(s). It cannot be permanently deleted without breaking rollback and historical previews. You may archive it instead.`
        );
      }

      // Archive asset: hides it from active picker while keeping physical storage intact
      await prisma.cmsMediaAsset.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });

      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "CMS_MEDIA_ARCHIVE",
        resourceType: "CMS_MEDIA",
        resourceId: id,
        description: `Archived media asset "${asset.originalFilename}" to preserve historical revision previews`,
      });

      return {
        success: true,
        archived: true,
        message: `Archived "${asset.originalFilename}" to preserve historical revision snapshots.`,
      };
    }

    // 3. Unused asset: perform safe physical and database deletion
    try {
      const parsed = parseManagedMediaUrl(asset.url);
      const targetFileName = parsed?.fileName || asset.key;
      await deletePublicMedia({
        kind: "cms-media",
        fileName: targetFileName,
      });
    } catch (storageErr) {
      console.warn(`[CMS MEDIA] Physical storage cleanup warning for ${asset.id}:`, storageErr);
    }

    // Clean up variants and DB record
    await prisma.cmsMediaVariant.deleteMany({ where: { mediaAssetId: id } });
    await prisma.cmsMediaAsset.delete({ where: { id } });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_MEDIA_DELETE",
      resourceType: "CMS_MEDIA",
      resourceId: id,
      description: `Permanently deleted unused media asset "${asset.originalFilename}" (${asset.key})`,
    });

    return {
      success: true,
      deleted: true,
      message: `Permanently deleted "${asset.originalFilename}".`,
    };
  }

  /**
   * Bulk delete media assets with per-file usage validation and partial failure isolation
   */
  async bulkDeleteMedia(actor: AuthUser, ids: string[], options?: { forceArchive?: boolean }): Promise<BulkDeleteResult> {
    const deleted: string[] = [];
    const blocked: BulkDeleteResult["blocked"] = [];
    const failed: BulkDeleteResult["failed"] = [];

    for (const id of ids) {
      try {
        const usage = await this.getMediaUsage(id);
        const asset = await prisma.cmsMediaAsset.findUnique({ where: { id } });

        if (!asset) {
          failed.push({ id, error: "Asset not found" });
          continue;
        }

        // Active references block deletion
        if (usage.livePublishedCount > 0 || usage.currentDraftCount > 0 || usage.scheduledCount > 0) {
          blocked.push({
            id,
            originalFilename: asset.originalFilename,
            reason: `In use by ${usage.livePublishedCount} published and ${usage.currentDraftCount} draft item(s)`,
            liveCount: usage.livePublishedCount,
            draftCount: usage.currentDraftCount,
          });
          continue;
        }

        // Historical references protect physical file
        if (usage.historicalCount > 0) {
          if (options?.forceArchive) {
            await prisma.cmsMediaAsset.update({
              where: { id },
              data: { status: "ARCHIVED" },
            });
            deleted.push(id);
          } else {
            blocked.push({
              id,
              originalFilename: asset.originalFilename,
              reason: `Referenced by ${usage.historicalCount} historical revision(s)`,
              liveCount: 0,
              draftCount: 0,
            });
          }
          continue;
        }

        // Safe delete
        try {
          const parsed = parseManagedMediaUrl(asset.url);
          const targetFileName = parsed?.fileName || asset.key;
          await deletePublicMedia({
            kind: "cms-media",
            fileName: targetFileName,
          });
        } catch (storageErr) {
          console.warn(`[CMS MEDIA] Storage delete error for ${id}:`, storageErr);
        }

        await prisma.cmsMediaVariant.deleteMany({ where: { mediaAssetId: id } });
        await prisma.cmsMediaAsset.delete({ where: { id } });
        deleted.push(id);
      } catch (err: any) {
        failed.push({ id, error: err.message || "Failed to process asset" });
      }
    }

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "CMS_MEDIA_BULK_DELETE",
      resourceType: "CMS_MEDIA",
      resourceId: "bulk",
      description: `Bulk delete executed: ${deleted.length} deleted, ${blocked.length} blocked by usage, ${failed.length} failed.`,
      metadata: { deletedCount: deleted.length, blockedCount: blocked.length, failedCount: failed.length },
    });

    return {
      total: ids.length,
      deleted,
      blocked,
      failed,
    };
  }

  /**
   * Scan payload for image URLs and sync CmsMediaReference records for version
   */
  async syncVersionMediaReferences(versionId: string, payload: Record<string, unknown>) {
    const payloadStr = JSON.stringify(payload);
    const assets = await prisma.cmsMediaAsset.findMany({
      select: { id: true, url: true, key: true },
    });

    for (const asset of assets) {
      if (
        payloadStr.includes(asset.url) ||
        (asset.key && payloadStr.includes(asset.key))
      ) {
        await prisma.cmsMediaReference.upsert({
          where: {
            mediaAssetId_versionId_fieldPath: {
              mediaAssetId: asset.id,
              versionId,
              fieldPath: "payload",
            },
          },
          create: {
            mediaAssetId: asset.id,
            versionId,
            fieldPath: "payload",
          },
          update: {},
        });
      }
    }
  }
}

export const cmsMediaService = new CmsMediaService();
