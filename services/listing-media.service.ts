import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { Role, ListingStatus, ListingCoHostStatus } from "@/generated/prisma/enums";
import {
  savePublicMedia,
  deleteManagedMediaUrl,
  parseManagedMediaUrl,
} from "@/lib/storage/media";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";
import { auditService } from "@/services/audit.service";
import {
  type PhotoRoomAssignment,
  type PhotoRoomType,
  resolvePhotoRoomType,
} from "@/lib/listing/photo-room-assignments";
import { invalidateListingCache } from "@/lib/redis/invalidation";

export interface UploadListingPhotoInput {
  listingId?: string;
  file: {
    name: string;
    type: string;
    size: number;
    buffer: Buffer;
  };
  autoAssignRoom?: PhotoRoomType | null;
}

export interface ListingGalleryResponse {
  listingId: string;
  photos: string[];
  coverPhoto: string | null;
  photoRoomAssignments: PhotoRoomAssignment[];
  totalPhotos: number;
  assignedCount: number;
  unassignedCount: number;
  publishable: boolean;
  minPhotosRemaining: number;
}

export class ListingMediaService {
  /**
   * Asserts actor has permission to modify media for the given listing.
   * Admins can edit any listing; Hosts must own the listing or be accepted co-hosts.
   */
  async assertListingAccess(actor: AuthUser, listingId: string) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        hostId: true,
        title: true,
        status: true,
        published: true,
        photos: true,
        photoRoomAssignments: true,
      },
    });

    if (!listing) {
      throw AppError.notFound("Listing not found.");
    }

    if (actor.role === Role.ADMIN || listing.hostId === actor.id) {
      return listing;
    }

    const coHost = await prisma.listingCoHost.findFirst({
      where: {
        listingId,
        userId: actor.id,
        status: ListingCoHostStatus.ACCEPTED,
      },
      select: { id: true },
    });

    if (!coHost) {
      throw AppError.forbidden("You do not have permission to manage media for this listing.");
    }

    return listing;
  }

  /**
   * Upload a photo for a listing, enforcing validation, magic bytes, and media server storage.
   */
  async uploadPhoto(actor: AuthUser, input: UploadListingPhotoInput) {
    const { listingId, file, autoAssignRoom } = input;

    // Validate image format, size, and magic bytes
    const validation = validatePublicImageUpload({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer: file.buffer,
    });

    if (validation) {
      throw AppError.badRequest(validation.message);
    }

    let listing: Awaited<ReturnType<typeof this.assertListingAccess>> | null = null;
    if (listingId) {
      listing = await this.assertListingAccess(actor, listingId);
    } else {
      // Allowed for host/admin/user during initial onboarding draft
      if (![Role.HOST, Role.ADMIN, Role.USER].includes(actor.role as Role)) {
        throw AppError.forbidden("Unauthorized to upload listing media.");
      }
    }

    const extensionByMimeType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const cleanExt = extensionByMimeType[file.type] || ".jpg";
    const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${cleanExt}`;

    // Upload to dedicated media server via savePublicMedia
    const saved = await savePublicMedia({
      kind: "listing-photos",
      fileName,
      body: file.buffer,
      contentType: file.type || "image/jpeg",
    });

    // If listingId is provided, atomically persist to listing.photos and update assignments
    if (listing && listingId) {
      const nextPhotos = [...listing.photos, saved.url];
      let nextAssignments: PhotoRoomAssignment[] = Array.isArray(listing.photoRoomAssignments)
        ? (listing.photoRoomAssignments as unknown as PhotoRoomAssignment[])
        : [];

      if (autoAssignRoom) {
        nextAssignments = [...nextAssignments, { url: saved.url, roomType: autoAssignRoom }];
      }

      await prisma.listing.update({
        where: { id: listingId },
        data: {
          photos: nextPhotos,
          photoRoomAssignments: JSON.parse(JSON.stringify(nextAssignments)),
        },
      });

      await invalidateListingCache(listingId, listing.hostId);

      await auditService.record({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "LISTING_PHOTO_UPLOADED",
        resourceType: "Listing",
        resourceId: listingId,
        description: `Uploaded photo "${saved.fileName}" for listing "${listing.title}"`,
        metadata: { url: saved.url, roomType: autoAssignRoom ?? null },
      });
    }

    return {
      success: true,
      url: saved.url,
      fileName: saved.fileName,
      listingId: listingId ?? null,
      isCover: listing ? listing.photos.length === 0 : false,
    };
  }

  /**
   * Reorder listing photos. Index 0 is always the listing cover photo.
   */
  async reorderPhotos(actor: AuthUser, listingId: string, photoUrls: string[]) {
    const listing = await this.assertListingAccess(actor, listingId);

    // Validate that the new array contains only existing photos (preventing rogue URL injections)
    const existingSet = new Set(listing.photos);
    const validUrls = photoUrls.filter((url) => existingSet.has(url));

    // Append any existing photos that might have been omitted
    for (const photo of listing.photos) {
      if (!validUrls.includes(photo)) {
        validUrls.push(photo);
      }
    }

    await prisma.listing.update({
      where: { id: listingId },
      data: { photos: validUrls },
    });

    await invalidateListingCache(listingId, listing.hostId);

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "LISTING_PHOTOS_REORDERED",
      resourceType: "Listing",
      resourceId: listingId,
      description: `Reordered ${validUrls.length} photos for listing "${listing.title}". Cover set to ${validUrls[0] || "none"}.`,
    });

    return {
      success: true,
      photos: validUrls,
      coverPhoto: validUrls[0] ?? null,
    };
  }

  /**
   * Set a specific photo as the listing cover (moves it to index 0).
   */
  async setCoverPhoto(actor: AuthUser, listingId: string, photoUrl: string) {
    const listing = await this.assertListingAccess(actor, listingId);

    const index = listing.photos.indexOf(photoUrl);
    if (index === -1) {
      throw AppError.badRequest("Selected photo does not exist in this listing gallery.");
    }

    if (index === 0) {
      return { success: true, coverPhoto: photoUrl, photos: listing.photos };
    }

    const nextPhotos = [...listing.photos];
    const [cover] = nextPhotos.splice(index, 1);
    nextPhotos.unshift(cover);

    await prisma.listing.update({
      where: { id: listingId },
      data: { photos: nextPhotos },
    });

    await invalidateListingCache(listingId, listing.hostId);

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "LISTING_COVER_PHOTO_CHANGED",
      resourceType: "Listing",
      resourceId: listingId,
      description: `Set photo as primary cover for listing "${listing.title}"`,
      metadata: { photoUrl },
    });

    return {
      success: true,
      coverPhoto: photoUrl,
      photos: nextPhotos,
    };
  }

  /**
   * Assign or unassign a photo to a room type.
   */
  async assignPhotoRoom(
    actor: AuthUser,
    listingId: string,
    photoUrl: string,
    roomType: PhotoRoomType | null,
  ) {
    const listing = await this.assertListingAccess(actor, listingId);

    if (!listing.photos.includes(photoUrl)) {
      throw AppError.badRequest("Photo does not belong to this listing.");
    }

    const existingAssignments: PhotoRoomAssignment[] = Array.isArray(listing.photoRoomAssignments)
      ? (listing.photoRoomAssignments as unknown as PhotoRoomAssignment[])
      : [];

    const withoutPhoto = existingAssignments.filter((a) => a.url !== photoUrl);
    const resolvedType = roomType ? resolvePhotoRoomType(roomType) : null;

    const nextAssignments = resolvedType
      ? [...withoutPhoto, { url: photoUrl, roomType: resolvedType }]
      : withoutPhoto;

    await prisma.listing.update({
      where: { id: listingId },
      data: { photoRoomAssignments: JSON.parse(JSON.stringify(nextAssignments)) },
    });

    await invalidateListingCache(listingId, listing.hostId);

    return {
      success: true,
      photoUrl,
      roomType: resolvedType,
      photoRoomAssignments: nextAssignments,
    };
  }

  /**
   * Batch assign multiple photos to a room type.
   */
  async batchAssignPhotoRooms(
    actor: AuthUser,
    listingId: string,
    photoUrls: string[],
    roomType: PhotoRoomType | null,
  ) {
    const listing = await this.assertListingAccess(actor, listingId);
    const targetSet = new Set(photoUrls.filter((url) => listing.photos.includes(url)));

    const existingAssignments: PhotoRoomAssignment[] = Array.isArray(listing.photoRoomAssignments)
      ? (listing.photoRoomAssignments as unknown as PhotoRoomAssignment[])
      : [];

    const remaining = existingAssignments.filter((a) => !targetSet.has(a.url));
    const resolvedType = roomType ? resolvePhotoRoomType(roomType) : null;

    const newEntries = resolvedType
      ? Array.from(targetSet, (url) => ({ url, roomType: resolvedType }))
      : [];

    const nextAssignments = [...remaining, ...newEntries];

    await prisma.listing.update({
      where: { id: listingId },
      data: { photoRoomAssignments: JSON.parse(JSON.stringify(nextAssignments)) },
    });

    await invalidateListingCache(listingId, listing.hostId);

    return {
      success: true,
      count: targetSet.size,
      roomType: resolvedType,
      photoRoomAssignments: nextAssignments,
    };
  }

  /**
   * Replace an existing photo with a new one, preserving its gallery position and room assignment.
   */
  async replacePhoto(
    actor: AuthUser,
    listingId: string,
    oldPhotoUrl: string,
    file: { name: string; type: string; size: number; buffer: Buffer },
  ) {
    const listing = await this.assertListingAccess(actor, listingId);
    const index = listing.photos.indexOf(oldPhotoUrl);

    if (index === -1) {
      throw AppError.badRequest("Photo to replace does not exist in this listing.");
    }

    const validation = validatePublicImageUpload({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer: file.buffer,
    });
    if (validation) {
      throw AppError.badRequest(validation.message);
    }

    const extensionByMimeType: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
    };
    const cleanExt = extensionByMimeType[file.type] || ".jpg";
    const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${cleanExt}`;

    const saved = await savePublicMedia({
      kind: "listing-photos",
      fileName,
      body: file.buffer,
      contentType: file.type || "image/jpeg",
    });

    const nextPhotos = [...listing.photos];
    nextPhotos[index] = saved.url;

    const existingAssignments: PhotoRoomAssignment[] = Array.isArray(listing.photoRoomAssignments)
      ? (listing.photoRoomAssignments as unknown as PhotoRoomAssignment[])
      : [];

    const nextAssignments = existingAssignments.map((assignment) =>
      assignment.url === oldPhotoUrl ? { ...assignment, url: saved.url } : assignment,
    );

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        photos: nextPhotos,
        photoRoomAssignments: JSON.parse(JSON.stringify(nextAssignments)),
      },
    });

    await invalidateListingCache(listingId, listing.hostId);

    // Clean up old file if not used elsewhere
    await this.cleanupMediaUrlIfUnreferenced(oldPhotoUrl, listingId);

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "LISTING_PHOTO_REPLACED",
      resourceType: "Listing",
      resourceId: listingId,
      description: `Replaced photo in listing "${listing.title}"`,
      metadata: { oldUrl: oldPhotoUrl, newUrl: saved.url },
    });

    return {
      success: true,
      oldUrl: oldPhotoUrl,
      newUrl: saved.url,
      photos: nextPhotos,
    };
  }

  /**
   * Delete a photo from a listing, with strict publication safety checks.
   */
  async deletePhoto(
    actor: AuthUser,
    listingId: string,
    photoUrl: string,
    options?: { force?: boolean },
  ) {
    const listing = await this.assertListingAccess(actor, listingId);

    if (!listing.photos.includes(photoUrl)) {
      throw AppError.badRequest("Photo not found in this listing gallery.");
    }

    const nextPhotos = listing.photos.filter((p: string) => p !== photoUrl);

    // Publication safety: An active published listing must not drop below 5 photos
    if (listing.published && listing.status === ListingStatus.ACTIVE && nextPhotos.length < 5) {
      if (actor.role !== Role.ADMIN && !options?.force) {
        throw AppError.badRequest(
          "Cannot remove photo: Active published listings require at least 5 photos. Upload replacement photos first, or unpublish your listing.",
        );
      }
    }

    const existingAssignments: PhotoRoomAssignment[] = Array.isArray(listing.photoRoomAssignments)
      ? (listing.photoRoomAssignments as unknown as PhotoRoomAssignment[])
      : [];
    const nextAssignments = existingAssignments.filter((a) => a.url !== photoUrl);

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        photos: nextPhotos,
        photoRoomAssignments: JSON.parse(JSON.stringify(nextAssignments)),
      },
    });

    await invalidateListingCache(listingId, listing.hostId);

    // Best-effort cleanup of physical file
    await this.cleanupMediaUrlIfUnreferenced(photoUrl, listingId);

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "LISTING_PHOTO_DELETED",
      resourceType: "Listing",
      resourceId: listingId,
      description: `Deleted photo from listing "${listing.title}" (${nextPhotos.length} remaining)`,
      metadata: { photoUrl },
    });

    return {
      success: true,
      remainingPhotos: nextPhotos,
      remainingCount: nextPhotos.length,
      coverPhoto: nextPhotos[0] ?? null,
      publishable: nextPhotos.length >= 5,
    };
  }

  /**
   * Retrieve structured gallery and photo tour metadata.
   */
  async getListingGallery(actor: AuthUser, listingId: string): Promise<ListingGalleryResponse> {
    const listing = await this.assertListingAccess(actor, listingId);

    const assignments: PhotoRoomAssignment[] = Array.isArray(listing.photoRoomAssignments)
      ? (listing.photoRoomAssignments as unknown as PhotoRoomAssignment[])
      : [];

    const assignedUrls = new Set(assignments.map((a) => a.url));
    const assignedCount = listing.photos.filter((p: string) => assignedUrls.has(p)).length;

    return {
      listingId,
      photos: listing.photos,
      coverPhoto: listing.photos[0] ?? null,
      photoRoomAssignments: assignments,
      totalPhotos: listing.photos.length,
      assignedCount,
      unassignedCount: listing.photos.length - assignedCount,
      publishable: listing.photos.length >= 5,
      minPhotosRemaining: Math.max(0, 5 - listing.photos.length),
    };
  }

  /**
   * Helper to verify if a photo URL is still referenced across listings, guidebooks, or CMS before deleting.
   */
  private async cleanupMediaUrlIfUnreferenced(url: string, excludeListingId?: string) {
    try {
      const parsed = parseManagedMediaUrl(url);
      if (!parsed) return;

      const [otherListings, guidebooks] = await Promise.all([
        prisma.listing.count({
          where: {
            id: excludeListingId ? { not: excludeListingId } : undefined,
            photos: { has: url },
          },
        }),
        prisma.guidebook.count({
          where: {
            OR: [
              { coverImage: url },
              { items: { some: { photo: url } } },
              { items: { some: { photos: { has: url } } } },
            ],
          },
        }),
      ]);

      if (otherListings === 0 && guidebooks === 0) {
        await deleteManagedMediaUrl(url);
      }
    } catch (err) {
      console.warn("[listing-media] failed to cleanup media URL:", url, err);
    }
  }
}

export const listingMediaService = new ListingMediaService();
