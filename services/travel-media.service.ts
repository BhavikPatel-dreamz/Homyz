import { randomUUID } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import {
  deletePrivateMedia,
  getMediaStorageProvider,
  readPrivateMedia,
  savePrivateMedia,
  type PrivateMediaKind,
} from "@/lib/storage/media";
import {
  createTravelImageVariants,
  validateTravelImageMetadata,
  validateTravelImageUpload,
} from "@/lib/media/travel-image-validation";
import { enqueueJob, registerJobHandler } from "@/services/job-queue.service";
import type { Prisma } from "@/generated/prisma/client";

const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000;
const RETRY_CLEANUP_MS = 60 * 60 * 1000;
const MAX_OWNER_ACTIVE_ASSETS = 200;
const MAX_OWNER_ACTIVE_BYTES = 500 * 1024 * 1024;

type TravelMediaType = "TRAVEL_PHOTO" | "TRAVEL_COVER";
type UploadStatus = "CREATED" | "UPLOADING" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED" | "CANCELLED" | "DELETED";
type StoredVariant = { storageKey: string; variantName: string; mimeType: string };

function assertMediaType(value: unknown): asserts value is TravelMediaType {
  if (value !== "TRAVEL_PHOTO" && value !== "TRAVEL_COVER") {
    throw AppError.badRequest("Unsupported travel media type.");
  }
}

function assetKind(mediaType: TravelMediaType): PrivateMediaKind {
  return mediaType === "TRAVEL_COVER" ? "travel-covers" : "travel-photos";
}

function extensionForMime(mimeType: string): string {
  return ({ "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif" } as Record<string, string>)[mimeType] || ".img";
}

function keyParts(storageKey: string): { kind: PrivateMediaKind; fileName: string } | null {
  const [rawKind, ...rest] = storageKey.split("/");
  const kinds = new Set<PrivateMediaKind>(["travel-photos", "travel-covers", "travel-variants"]);
  if (!kinds.has(rawKind as PrivateMediaKind) || rest.length !== 3) return null;
  return { kind: rawKind as PrivateMediaKind, fileName: rest.join("/") };
}

async function removeKey(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) return;
  const parsed = keyParts(storageKey);
  if (parsed) await deletePrivateMedia(parsed);
}

function sessionDto(session: {
  id: string;
  assetId: string;
  status: UploadStatus;
  expiresAt: Date;
  asset: { uploadStatus: UploadStatus; processingStatus: string; mediaType: TravelMediaType; width: number | null; height: number | null; failureReason: string | null };
}) {
  return {
    id: session.id,
    assetId: session.assetId,
    status: session.status,
    uploadStatus: session.asset.uploadStatus,
    processingStatus: session.asset.processingStatus,
    mediaType: session.asset.mediaType,
    width: session.asset.width,
    height: session.asset.height,
    failureReason: session.asset.failureReason,
    expiresAt: session.expiresAt.toISOString(),
  };
}

class TravelMediaService {
  async listOwnerDrafts(actor: AuthUser) {
    const assets = await prisma.travelMediaAsset.findMany({
      where: {
        ownerId: actor.id,
        uploadStatus: "READY",
        processingStatus: "READY",
        mediaType: "TRAVEL_PHOTO",
        visibility: "PRIVATE",
        deletedAt: null,
        // A photo is a draft only while it is not attached to an active album.
        // Covers and attached photos must never appear as owner "unassigned" media.
        travelPhotos: { none: { deletedAt: null } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        originalFileName: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        mediaType: true,
        createdAt: true,
        variants: { select: { variantName: true } },
      },
    });
    return assets.map((asset: {
      id: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
      width: number | null;
      height: number | null;
      mediaType: TravelMediaType;
      createdAt: Date;
      variants: Array<{ variantName: string }>;
    }) => ({
      id: asset.id,
      originalFileName: asset.originalFileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      mediaType: asset.mediaType,
      createdAt: asset.createdAt.toISOString(),
      thumbnailUrl: asset.variants.some((variant) => variant.variantName === "thumbnail")
        ? `/api/v1/travel-media/${asset.id}/file?variant=thumbnail`
        : null,
    }));
  }

  async createUploadSession(actor: AuthUser, input: {
    fileName: string;
    mimeType: string;
    size: number;
    mediaType: unknown;
  }) {
    assertMediaType(input.mediaType);
    const mediaType = input.mediaType;
    const metadataError = validateTravelImageMetadata({
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
    });
    if (metadataError) throw AppError.badRequest(metadataError);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Serialize quota checks for this owner so concurrent session creation
      // cannot overrun the count/byte limits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`travel-media:${actor.id}`}))`;
      const quota = await tx.travelMediaAsset.aggregate({
        where: {
          ownerId: actor.id,
          uploadStatus: { notIn: ["FAILED", "CANCELLED", "DELETED"] },
          deletedAt: null,
        },
        _count: { _all: true },
        _sum: { fileSize: true },
      });
      if (quota._count._all >= MAX_OWNER_ACTIVE_ASSETS || (quota._sum.fileSize || 0) + input.size > MAX_OWNER_ACTIVE_BYTES) {
        throw AppError.badRequest("Your private travel media quota has been reached. Delete unused drafts and try again.");
      }
      const asset = await tx.travelMediaAsset.create({
        data: {
          ownerId: actor.id,
          storageProvider: getMediaStorageProvider(),
          originalFileName: path.basename(input.fileName),
          mimeType: input.mimeType,
          fileSize: input.size,
          mediaType,
          visibility: "PRIVATE",
          uploadStatus: "CREATED",
          processingStatus: "PENDING",
          cleanupAfter: new Date(now.getTime() + CLEANUP_RETENTION_MS),
        },
      });
      return tx.travelMediaUploadSession.create({
        data: {
          assetId: asset.id,
          ownerId: actor.id,
          mediaType,
          originalFileName: path.basename(input.fileName),
          declaredMimeType: input.mimeType,
          declaredFileSize: input.size,
          expiresAt,
        },
        include: { asset: true },
      });
    });

    return {
      ...sessionDto(created),
      uploadUrl: `/api/v1/travel-media/uploads/${created.id}/content`,
    };
  }

  async getUploadSession(actor: AuthUser, sessionId: string) {
    const session = await prisma.travelMediaUploadSession.findFirst({
      where: { id: sessionId, ownerId: actor.id },
      include: { asset: true },
    });
    if (!session) throw AppError.notFound("Upload session not found.");
    return sessionDto(session);
  }

  async uploadContent(actor: AuthUser, sessionId: string, file: {
    fileName: string;
    mimeType: string;
    size: number;
    buffer: Buffer;
  }) {
    const session = await prisma.travelMediaUploadSession.findFirst({
      where: { id: sessionId, ownerId: actor.id },
      include: { asset: true },
    });
    if (!session) throw AppError.notFound("Upload session not found.");
    if (session.expiresAt <= new Date()) {
      await this.cancelUpload(actor, sessionId);
      throw AppError.badRequest("This upload session has expired. Start a new upload.");
    }
    if (session.status === "UPLOADED" || session.status === "PROCESSING" || session.status === "READY") {
      throw AppError.conflict("This upload has already been transferred.");
    }
    if (session.status === "CANCELLED" || session.status === "DELETED") {
      throw AppError.conflict("This upload session is no longer active.");
    }
    if (file.fileName !== session.originalFileName || file.mimeType !== session.declaredMimeType || file.size !== session.declaredFileSize) {
      throw AppError.badRequest("Uploaded file metadata does not match the upload session.");
    }

    const claiming = await prisma.travelMediaUploadSession.updateMany({
      where: { id: sessionId, ownerId: actor.id, status: "CREATED" },
      data: { status: "UPLOADING" },
    });
    if (!claiming.count) throw AppError.conflict("Another transfer is already active for this upload.");
    await prisma.travelMediaAsset.updateMany({
      where: { id: session.assetId, ownerId: actor.id, uploadStatus: "CREATED" },
      data: { uploadStatus: "UPLOADING" },
    });

    try {
      await validateTravelImageUpload({
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
        buffer: file.buffer,
      });
      const saved = await savePrivateMedia({
        kind: assetKind(session.mediaType as TravelMediaType),
        fileName: `${randomUUID()}${extensionForMime(file.mimeType)}`,
        body: file.buffer,
        contentType: file.mimeType,
      });

      const finalized = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const transfer = await tx.travelMediaUploadSession.updateMany({
          where: { id: sessionId, ownerId: actor.id, status: "UPLOADING" },
          data: { status: "UPLOADED", uploadedAt: new Date() },
        });
        if (!transfer.count) return false;
        await tx.travelMediaAsset.update({
          where: { id: session.assetId },
          data: { storageKey: saved.storageKey, uploadStatus: "UPLOADED" },
        });
        return true;
      });
      if (!finalized) {
        await removeKey(saved.storageKey);
        throw AppError.conflict("The upload was cancelled before it could complete.");
      }
      return this.getUploadSession(actor, sessionId);
    } catch (error) {
      await prisma.$transaction([
        prisma.travelMediaUploadSession.updateMany({
          where: { id: sessionId, ownerId: actor.id, status: "UPLOADING" },
          data: { status: "FAILED" },
        }),
        prisma.travelMediaAsset.updateMany({
          where: { id: session.assetId, ownerId: actor.id, uploadStatus: "UPLOADING" },
          data: { uploadStatus: "FAILED", processingStatus: "FAILED", failureReason: "Upload validation or storage failed." },
        }),
      ]).catch(() => undefined);
      if (error instanceof AppError) throw error;
      throw AppError.badRequest(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async finalizeUpload(actor: AuthUser, sessionId: string) {
    const session = await prisma.travelMediaUploadSession.findFirst({
      where: { id: sessionId, ownerId: actor.id },
      include: { asset: true },
    });
    if (!session) throw AppError.notFound("Upload session not found.");
    if (session.status === "READY" || session.status === "PROCESSING") return sessionDto(session);
    if (session.status === "CANCELLED" || session.status === "DELETED") throw AppError.conflict("This upload session is no longer active.");
    if (session.status !== "UPLOADED" || !session.asset.storageKey) {
      throw AppError.conflict("Transfer the image before finalizing it.");
    }
    if (session.expiresAt <= new Date()) {
      await this.cancelUpload(actor, sessionId);
      throw AppError.badRequest("This upload session has expired. Start a new upload.");
    }

    try {
      const source = await this.readAssetStorage(session.asset.storageKey);
      await validateTravelImageUpload({
        fileName: session.originalFileName,
        mimeType: session.declaredMimeType,
        size: source.length,
        buffer: source,
      });
    } catch {
      await this.markProcessingFailed(session.assetId, "The transferred image could not be verified.");
      throw AppError.badRequest("The transferred image could not be verified.");
    }

    const transitioned = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const changed = await tx.travelMediaUploadSession.updateMany({
        where: { id: sessionId, ownerId: actor.id, status: "UPLOADED" },
        data: { status: "PROCESSING", finalizedAt: new Date() },
      });
      if (!changed.count) return false;
      await tx.travelMediaAsset.update({
        where: { id: session.assetId },
        data: { uploadStatus: "PROCESSING", processingStatus: "PROCESSING", failureReason: null },
      });
      return true;
    });
    if (!transitioned) return this.getUploadSession(actor, sessionId);

    try {
      await enqueueJob({
        type: "TRAVEL_MEDIA_PROCESS",
        payload: { sessionId },
        idempotencyKey: `travel-media-process:${sessionId}`,
        priority: 4,
        maxAttempts: 3,
        backoffSeconds: 30,
      });
    } catch {
      await this.markProcessingFailed(session.assetId, "Image processing could not be scheduled.");
      throw AppError.serviceUnavailable("Image processing could not be scheduled. Please retry.");
    }
    return this.getUploadSession(actor, sessionId);
  }

  async cancelUpload(actor: AuthUser, sessionId: string) {
    const session = await prisma.travelMediaUploadSession.findFirst({
      where: { id: sessionId, ownerId: actor.id },
      include: { asset: { include: { variants: true } } },
    });
    if (!session) throw AppError.notFound("Upload session not found.");
    if (session.status === "READY") throw AppError.conflict("A ready asset must be deleted instead of cancelled.");
    if (session.status === "CANCELLED" || session.status === "DELETED") return sessionDto(session);

    await prisma.$transaction([
      prisma.travelMediaUploadSession.updateMany({
        where: { id: session.id, ownerId: actor.id, status: { in: ["CREATED", "UPLOADING", "UPLOADED", "PROCESSING", "FAILED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      }),
      prisma.travelMediaAsset.updateMany({
        where: { id: session.assetId, ownerId: actor.id, uploadStatus: { notIn: ["READY", "DELETED"] } },
        data: { uploadStatus: "CANCELLED", cleanupAfter: new Date() },
      }),
    ]);
    await this.cleanupStorage(session.asset.storageKey, session.asset.variants.map((variant: StoredVariant) => variant.storageKey), session.assetId);
    return this.getUploadSession(actor, sessionId);
  }

  async getAssetFile(actor: AuthUser, assetId: string, variantName = "medium") {
    const asset = await prisma.travelMediaAsset.findFirst({
      where: {
        id: assetId,
        ownerId: actor.id,
        uploadStatus: "READY",
        processingStatus: "READY",
        visibility: "PRIVATE",
        deletedAt: null,
        OR: [{ moderationStatus: null }, { moderationStatus: { notIn: ["HIDDEN", "REMOVED", "QUARANTINED"] } }],
      },
      include: { variants: true },
    });
    if (!asset) throw AppError.notFound("Travel media not found.");
    const key = variantName === "original"
      ? asset.storageKey
      : asset.variants.find((variant: StoredVariant) => variant.variantName === variantName)?.storageKey;
    if (!key) throw AppError.notFound("Media variant not found.");
    const buffer = await this.readAssetStorage(key);
    const mimeType = variantName === "original"
      ? asset.mimeType
      : asset.variants.find((variant: StoredVariant) => variant.variantName === variantName)?.mimeType || "image/webp";
    return { buffer, mimeType, originalFileName: asset.originalFileName };
  }

  async deleteAsset(actor: AuthUser, assetId: string) {
    const asset = await prisma.travelMediaAsset.findFirst({
      where: { id: assetId, ownerId: actor.id, deletedAt: null },
      include: { variants: true, uploadSession: true },
    });
    if (!asset) throw AppError.notFound("Travel media not found.");
    await prisma.$transaction([
      prisma.travelMediaAsset.update({
        where: { id: asset.id },
        data: { uploadStatus: "DELETED", deletedAt: new Date(), cleanupAfter: new Date(), visibility: "PRIVATE" },
      }),
      ...(asset.uploadSession ? [prisma.travelMediaUploadSession.update({ where: { id: asset.uploadSession.id }, data: { status: "DELETED" } })] : []),
    ]);
    await this.cleanupStorage(asset.storageKey, asset.variants.map((variant: StoredVariant) => variant.storageKey), asset.id);
    return { success: true };
  }

  async processSession(sessionId: string) {
    const session = await prisma.travelMediaUploadSession.findUnique({
      where: { id: sessionId },
      include: { asset: { include: { variants: true } } },
    });
    if (!session || session.status === "CANCELLED" || session.status === "DELETED") return { skipped: true };
    if (session.status === "READY") return { ready: true };
    if (session.status === "FAILED" && session.asset.uploadStatus === "FAILED") {
      const retryClaim = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const changed = await tx.travelMediaUploadSession.updateMany({
          where: { id: sessionId, status: "FAILED" },
          data: { status: "PROCESSING" },
        });
        if (!changed.count) return false;
        await tx.travelMediaAsset.updateMany({
          where: { id: session.assetId, uploadStatus: "FAILED" },
          data: { uploadStatus: "PROCESSING", processingStatus: "PROCESSING", failureReason: null },
        });
        return true;
      });
      if (!retryClaim) return { skipped: true };
    } else if (session.status !== "PROCESSING") {
      throw new Error("Travel media is not ready for processing.");
    }
    if (!session.asset.storageKey) throw new Error("Travel media source is missing.");

    const createdKeys: string[] = [];
    try {
      const source = await this.readAssetStorage(session.asset.storageKey);
      const validated = await validateTravelImageUpload({
        fileName: session.originalFileName,
        mimeType: session.declaredMimeType,
        size: source.length,
        buffer: source,
      });
      const rendered = await createTravelImageVariants(source, session.mediaType as TravelMediaType);
      const saved = await Promise.all(rendered.map(async (variant) => {
        const result = await savePrivateMedia({
          kind: "travel-variants",
          fileName: `${session.assetId}_${variant.name}_${randomUUID()}.webp`,
          body: variant.buffer,
          contentType: "image/webp",
        });
        createdKeys.push(result.storageKey);
        return { ...variant, storageKey: result.storageKey };
      }));

      const committed = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const changed = await tx.travelMediaUploadSession.updateMany({
          where: { id: sessionId, status: "PROCESSING" },
          data: { status: "READY", finalizedAt: new Date() },
        });
        if (!changed.count) return false;
        await tx.travelMediaVariant.createMany({
          data: saved.map((variant) => ({
            assetId: session.assetId,
            variantName: variant.name,
            storageKey: variant.storageKey,
            mimeType: "image/webp",
            width: variant.width,
            height: variant.height,
            fileSize: variant.buffer.length,
          })),
        });
        await tx.travelMediaAsset.update({
          where: { id: session.assetId },
          data: {
            fileSize: source.length,
            width: validated.width,
            height: validated.height,
            checksum: validated.checksum,
            uploadStatus: "READY",
            processingStatus: "READY",
            cleanupAfter: null,
          },
        });
        return true;
      });
      if (!committed) {
        await Promise.allSettled(createdKeys.map(removeKey));
        return { skipped: true };
      }
      return { ready: true };
    } catch (error) {
      await Promise.allSettled(createdKeys.map(removeKey));
      await this.markProcessingFailed(session.assetId, "Image processing failed.");
      throw error;
    }
  }

  async cleanupExpired() {
    const now = new Date();
    const sessions = await prisma.travelMediaUploadSession.findMany({
      where: { expiresAt: { lte: now }, status: { in: ["CREATED", "UPLOADING", "UPLOADED", "PROCESSING", "FAILED", "CANCELLED"] } },
      take: 100,
      include: { asset: { include: { variants: true } } },
    });
    for (const session of sessions) {
      await prisma.$transaction([
        prisma.travelMediaUploadSession.updateMany({ where: { id: session.id, status: { notIn: ["READY", "DELETED"] } }, data: { status: "DELETED", cancelledAt: now } }),
        prisma.travelMediaAsset.updateMany({ where: { id: session.assetId, uploadStatus: { notIn: ["READY", "DELETED"] } }, data: { uploadStatus: "DELETED", deletedAt: now, cleanupAfter: now } }),
      ]);
      await this.cleanupStorage(session.asset.storageKey, session.asset.variants.map((variant: StoredVariant) => variant.storageKey), session.assetId);
    }

    const deletedAssets = await prisma.travelMediaAsset.findMany({
      where: { uploadStatus: "DELETED", cleanupAfter: { lte: now } },
      take: 100,
      include: { variants: true },
    });
    for (const asset of deletedAssets) {
      await this.cleanupStorage(asset.storageKey, asset.variants.map((variant: StoredVariant) => variant.storageKey), asset.id);
    }
    return { cleaned: sessions.length + deletedAssets.length };
  }

  private async readAssetStorage(storageKey: string): Promise<Buffer> {
    const parsed = keyParts(storageKey);
    if (!parsed) throw new Error("Invalid private media reference.");
    return readPrivateMedia(parsed.kind, parsed.fileName);
  }

  private async markProcessingFailed(assetId: string, reason: string) {
    await prisma.$transaction([
      prisma.travelMediaUploadSession.updateMany({
        where: { assetId, status: { in: ["UPLOADED", "PROCESSING", "UPLOADING"] } },
        data: { status: "FAILED" },
      }),
      prisma.travelMediaAsset.updateMany({
        where: { id: assetId, uploadStatus: { notIn: ["CANCELLED", "DELETED", "READY"] } },
        data: { uploadStatus: "FAILED", processingStatus: "FAILED", failureReason: reason, cleanupAfter: new Date(Date.now() + CLEANUP_RETENTION_MS) },
      }),
    ]).catch(() => undefined);
  }

  private async cleanupStorage(originalKey: string | null, variantKeys: string[], assetId: string) {
    try {
      await Promise.all([removeKey(originalKey), ...variantKeys.map(removeKey)]);
      await prisma.$transaction([
        prisma.travelMediaVariant.deleteMany({ where: { assetId } }),
        prisma.travelMediaAsset.update({
          where: { id: assetId },
          data: { storageKey: null, cleanupAfter: null },
        }),
      ]);
    } catch {
      await prisma.travelMediaAsset.update({
        where: { id: assetId },
        data: { deleteAttempts: { increment: 1 }, cleanupAfter: new Date(Date.now() + RETRY_CLEANUP_MS) },
      }).catch(() => undefined);
    }
  }
}

export const travelMediaService = new TravelMediaService();

registerJobHandler("TRAVEL_MEDIA_PROCESS", async (job) => {
  const sessionId = typeof job.payload?.sessionId === "string" ? job.payload.sessionId : "";
  if (!sessionId) throw new Error("Travel media job is missing its session ID.");
  return travelMediaService.processSession(sessionId);
});

registerJobHandler("TRAVEL_MEDIA_CLEANUP", async () => travelMediaService.cleanupExpired());
