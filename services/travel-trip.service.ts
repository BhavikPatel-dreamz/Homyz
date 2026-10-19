import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { TravelMediaUploadStatus, TravelMediaProcessingStatus } from "@/generated/prisma/enums";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import type {
  AllPhotosQuery,
  AttachTripPhotoInput,
  CreateTripInput,
  SetTripCoverInput,
  TravelPhotoOwnerDto,
  TravelTripOwnerDto,
  UpdateTravelPhotoInput,
  UpdateTripInput,
} from "@/lib/validation/travel-trip";

const MAX_PHOTOS_PER_TRIP = 5;

export type LegacyTripPhotoOwnerDto = {
  id: string;
  url: string;
  caption: string | null;
  location: string | null;
  tags: string[];
  createdAt: string;
};

type TripWithPhotosAndDestination = Prisma.TravelTripGetPayload<{
  include: {
    destination: true;
    photos: {
      include: {
        mediaAsset: true;
        destination: true;
        tags: { include: { taggedUser: { select: { id: true; name: true; image: true } } } };
      };
    };
  };
}>;

type PhotoWithMediaAsset = TripWithPhotosAndDestination["photos"][number];

type TaggedPhotoTag = {
  id: string;
  photoId: string;
  taggedUserId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  taggedUser: { id: string; name: string | null; image: string | null };
  createdAt: Date;
};

type OwnerPhotoWithTrip = PhotoWithMediaAsset & {
  trip: { id: string; title: string; coverPhotoId: string | null };
};

export class TravelTripService {
  /**
   * Creates a new personal travel album.
   * Default visibility is PRIVATE; does not mutate user role.
   */
  async createTrip(userId: string, input: CreateTripInput): Promise<TravelTripOwnerDto> {
    // Validate destinationId reference if supplied
    if (input.destinationId) {
      const destination = await prisma.destination.findUnique({
        where: { id: input.destinationId },
      });
      if (!destination) {
        throw AppError.badRequest("Destination not found.");
      }
    }

    const created = await prisma.travelTrip.create({
      data: {
        userId,
        title: input.title,
        description: input.description,
        destinationId: input.destinationId,
        startedAt: input.startedAt ? new Date(input.startedAt) : null,
        endedAt: input.endedAt ? new Date(input.endedAt) : null,
        visibility: "PRIVATE",
        status: "DRAFT",
      },
      include: {
        destination: true,
      },
    });

    await invalidateUserCache(userId);

    return {
      id: created.id,
      title: created.title,
      description: created.description,
      destination: created.destination,
      startedAt: created.startedAt ? created.startedAt.toISOString() : null,
      endedAt: created.endedAt ? created.endedAt.toISOString() : null,
      visibility: created.visibility,
      status: created.status,
      coverPhotoId: null,
      coverThumbnailUrl: null,
      photoCount: 0,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves an owner's travel trip with active photos and cover.
   */
  async getTrip(userId: string, tripId: string): Promise<TravelTripOwnerDto> {
    const trip = await prisma.travelTrip.findUnique({
      where: { id: tripId },
      include: {
        destination: true,
        photos: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          include: {
            mediaAsset: true,
            destination: true,
            tags: { include: { taggedUser: { select: { id: true, name: true, image: true } } } },
          },
        },
      },
    });

    if (!trip || trip.deletedAt) {
      throw AppError.notFound("Travel trip not found.");
    }

    if (trip.userId !== userId) {
      throw AppError.forbidden("You do not have permission to view this travel trip.");
    }

    const typedTrip = trip as TripWithPhotosAndDestination;

    const photos: TravelPhotoOwnerDto[] = typedTrip.photos.map((p: PhotoWithMediaAsset) => ({
      id: p.id,
      tripId: p.tripId,
      tripTitle: typedTrip.title,
      mediaAssetId: p.mediaAssetId,
      caption: p.caption,
      location: p.location,
      destinationId: p.destinationId,
      destination: p.destination,
      displayOrder: p.displayOrder,
      isCover: typedTrip.coverPhotoId === p.id,
      thumbnailUrl: `/api/v1/travel-media/${p.mediaAssetId}/file?variant=thumbnail`,
      mediumUrl: `/api/v1/travel-media/${p.mediaAssetId}/file?variant=medium`,
      tags: p.tags?.map((t: (typeof p.tags)[number]) => ({
        id: t.id,
        photoId: t.photoId,
        taggedUserId: t.taggedUserId,
        status: t.status,
        user: {
          id: t.taggedUser.id,
          name: t.taggedUser.name,
          image: t.taggedUser.image,
        },
        createdAt: t.createdAt.toISOString(),
      })),
      createdAt: p.createdAt.toISOString(),
    }));

    const coverPhoto = typedTrip.photos.find((p: PhotoWithMediaAsset) => p.id === typedTrip.coverPhotoId) || typedTrip.photos[0];
    const coverThumbnailUrl = coverPhoto
      ? `/api/v1/travel-media/${coverPhoto.mediaAssetId}/file?variant=thumbnail`
      : null;

    return {
      id: typedTrip.id,
      title: typedTrip.title,
      description: typedTrip.description,
      destination: typedTrip.destination,
      startedAt: typedTrip.startedAt ? typedTrip.startedAt.toISOString() : null,
      endedAt: typedTrip.endedAt ? typedTrip.endedAt.toISOString() : null,
      visibility: typedTrip.visibility,
      status: typedTrip.status,
      coverPhotoId: typedTrip.coverPhotoId,
      coverThumbnailUrl,
      photoCount: photos.length,
      photos,
      createdAt: typedTrip.createdAt.toISOString(),
      updatedAt: typedTrip.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an owner's travel trip.
   */
  async updateTrip(
    userId: string,
    tripId: string,
    input: UpdateTripInput,
  ): Promise<TravelTripOwnerDto> {
    const trip = await prisma.travelTrip.findUnique({
      where: { id: tripId },
    });

    if (!trip || trip.deletedAt) {
      throw AppError.notFound("Travel trip not found.");
    }

    if (trip.userId !== userId) {
      throw AppError.forbidden("You do not have permission to edit this travel trip.");
    }

    if (input.destinationId) {
      const destination = await prisma.destination.findUnique({
        where: { id: input.destinationId },
      });
      if (!destination) {
        throw AppError.badRequest("Destination not found.");
      }
    }

    // If coverPhotoId is provided, verify it belongs to this trip
    if (input.coverPhotoId) {
      const photo = await prisma.travelPhoto.findUnique({
        where: { id: input.coverPhotoId },
      });
      if (!photo || photo.tripId !== tripId || photo.deletedAt) {
        throw AppError.badRequest("Selected cover photo does not belong to this trip.");
      }
    }

    const updated = await prisma.travelTrip.update({
      where: { id: tripId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.destinationId !== undefined ? { destinationId: input.destinationId } : {}),
        ...(input.startedAt !== undefined
          ? { startedAt: input.startedAt ? new Date(input.startedAt) : null }
          : {}),
        ...(input.endedAt !== undefined
          ? { endedAt: input.endedAt ? new Date(input.endedAt) : null }
          : {}),
        ...(input.coverPhotoId !== undefined ? { coverPhotoId: input.coverPhotoId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        destination: true,
        photos: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    await invalidateUserCache(userId);

    const coverPhoto = updated.photos.find((p: (typeof updated.photos)[number]) => p.id === updated.coverPhotoId) || updated.photos[0];
    const coverThumbnailUrl = coverPhoto
      ? `/api/v1/travel-media/${coverPhoto.mediaAssetId}/file?variant=thumbnail`
      : null;

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      destination: updated.destination,
      startedAt: updated.startedAt ? updated.startedAt.toISOString() : null,
      endedAt: updated.endedAt ? updated.endedAt.toISOString() : null,
      visibility: updated.visibility,
      status: updated.status,
      coverPhotoId: updated.coverPhotoId,
      coverThumbnailUrl,
      photoCount: updated.photos.length,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Soft-deletes a travel trip safely without deleting bookings or media assets.
   */
  async deleteTrip(userId: string, tripId: string): Promise<{ deleted: boolean }> {
    const trip = await prisma.travelTrip.findUnique({
      where: { id: tripId },
    });

    if (!trip || trip.deletedAt) {
      throw AppError.notFound("Travel trip not found.");
    }

    if (trip.userId !== userId) {
      throw AppError.forbidden("You do not have permission to delete this travel trip.");
    }

    await prisma.travelTrip.update({
      where: { id: tripId },
      data: { deletedAt: new Date() },
    });

    await invalidateUserCache(userId);
    return { deleted: true };
  }

  /**
   * Lists the owner's trips using cursor-based pagination.
   */
  async listTrips(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ trips: TravelTripOwnerDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    const items = await prisma.travelTrip.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        destination: true,
        photos: {
          where: { deletedAt: null },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          take: 5,
        },
      },
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    type TripItem = (typeof items)[number];

    const trips: TravelTripOwnerDto[] = pageItems.map((trip: TripItem) => {
      const coverPhoto = trip.photos.find((p: (typeof trip.photos)[number]) => p.id === trip.coverPhotoId) || trip.photos[0];
      const coverThumbnailUrl = coverPhoto
        ? `/api/v1/travel-media/${coverPhoto.mediaAssetId}/file?variant=thumbnail`
        : null;

      return {
        id: trip.id,
        title: trip.title,
        description: trip.description,
        destination: trip.destination,
        startedAt: trip.startedAt ? trip.startedAt.toISOString() : null,
        endedAt: trip.endedAt ? trip.endedAt.toISOString() : null,
        visibility: trip.visibility,
        status: trip.status,
        coverPhotoId: trip.coverPhotoId,
        coverThumbnailUrl,
        photoCount: trip.photos.length,
        createdAt: trip.createdAt.toISOString(),
        updatedAt: trip.updatedAt.toISOString(),
      };
    });

    return { trips, nextCursor };
  }

  /**
   * Attaches a READY TravelMediaAsset to a trip transactionally.
   * Concurrency-safe: Enforces the strict maximum of 5 active photos per trip.
   */
  async attachPhotoToTrip(
    userId: string,
    tripId: string,
    input: AttachTripPhotoInput,
  ): Promise<TravelPhotoOwnerDto> {
    const attachedPhoto = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Verify trip exists and user is owner
      const trip = await tx.travelTrip.findUnique({
        where: { id: tripId },
      });

      if (!trip || trip.deletedAt) {
        throw AppError.notFound("Travel trip not found.");
      }
      if (trip.userId !== userId) {
        throw AppError.forbidden("You do not have permission to modify this travel trip.");
      }

      // 2. Verify media asset exists, belongs to user, and is in READY state
      const asset = await tx.travelMediaAsset.findUnique({
        where: { id: input.mediaAssetId },
      });

      if (!asset || asset.deletedAt) {
        throw AppError.notFound("Travel media asset not found.");
      }
      if (asset.ownerId !== userId) {
        throw AppError.forbidden("You do not own this media asset.");
      }
      if (
        asset.uploadStatus !== TravelMediaUploadStatus.READY ||
        asset.processingStatus !== TravelMediaProcessingStatus.READY
      ) {
        throw AppError.badRequest(
          "Media asset is not ready for attachment (upload or processing incomplete).",
        );
      }

      // 3. Check if already attached to this trip
      const existingPhoto = await tx.travelPhoto.findUnique({
        where: {
          tripId_mediaAssetId: {
            tripId,
            mediaAssetId: input.mediaAssetId,
          },
        },
      });

      if (existingPhoto && !existingPhoto.deletedAt) {
        return {
          id: existingPhoto.id,
          tripId: existingPhoto.tripId,
          mediaAssetId: existingPhoto.mediaAssetId,
          caption: existingPhoto.caption,
          displayOrder: existingPhoto.displayOrder,
          isCover: trip.coverPhotoId === existingPhoto.id,
          thumbnailUrl: `/api/v1/travel-media/${existingPhoto.mediaAssetId}/file?variant=thumbnail`,
          mediumUrl: `/api/v1/travel-media/${existingPhoto.mediaAssetId}/file?variant=medium`,
          createdAt: existingPhoto.createdAt.toISOString(),
        };
      }

      // 4. Strict capacity check: maximum 5 active photos per trip
      const currentActiveCount = await tx.travelPhoto.count({
        where: {
          tripId,
          deletedAt: null,
        },
      });

      if (currentActiveCount >= MAX_PHOTOS_PER_TRIP) {
        throw AppError.badRequest(
          `[TRIP_PHOTO_LIMIT_EXCEEDED] This travel album has reached its maximum capacity of ${MAX_PHOTOS_PER_TRIP} photos. Please remove a photo before adding another.`,
        );
      }

      // 5. Create or restore photo
      let photo;
      if (existingPhoto && existingPhoto.deletedAt) {
        photo = await tx.travelPhoto.update({
          where: { id: existingPhoto.id },
          data: {
            deletedAt: null,
            caption: input.caption !== undefined ? input.caption : existingPhoto.caption,
            location: input.location !== undefined ? input.location : existingPhoto.location,
            destinationId: input.destinationId !== undefined ? input.destinationId : existingPhoto.destinationId,
            displayOrder: input.displayOrder ?? currentActiveCount,
          },
          include: { destination: true },
        });
      } else {
        photo = await tx.travelPhoto.create({
          data: {
            tripId,
            userId,
            mediaAssetId: input.mediaAssetId,
            caption: input.caption,
            location: input.location,
            destinationId: input.destinationId,
            displayOrder: input.displayOrder ?? currentActiveCount,
          },
          include: { destination: true },
        });
      }

      // 6. If trip has no cover photo, set this newly attached photo as the cover
      if (!trip.coverPhotoId) {
        await tx.travelTrip.update({
          where: { id: tripId },
          data: { coverPhotoId: photo.id },
        });
      }

      return {
        id: photo.id,
        tripId: photo.tripId,
        tripTitle: trip.title,
        mediaAssetId: photo.mediaAssetId,
        caption: photo.caption,
        location: photo.location,
        destinationId: photo.destinationId,
        destination: photo.destination,
        displayOrder: photo.displayOrder,
        isCover: !trip.coverPhotoId || trip.coverPhotoId === photo.id,
        thumbnailUrl: `/api/v1/travel-media/${photo.mediaAssetId}/file?variant=thumbnail`,
        mediumUrl: `/api/v1/travel-media/${photo.mediaAssetId}/file?variant=medium`,
        tags: [],
        createdAt: photo.createdAt.toISOString(),
      };
    });

    await invalidateUserCache(userId);
    return attachedPhoto;
  }

  /**
   * Detaches a photo from a trip.
   * If the detached photo was the trip cover, safely reassigns to another remaining photo or clears it.
   */
  async detachPhotoFromTrip(
    userId: string,
    tripId: string,
    photoId: string,
  ): Promise<{ detached: boolean }> {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const trip = await tx.travelTrip.findUnique({
        where: { id: tripId },
      });

      if (!trip || trip.deletedAt) {
        throw AppError.notFound("Travel trip not found.");
      }
      if (trip.userId !== userId) {
        throw AppError.forbidden("You do not have permission to modify this travel trip.");
      }

      const photo = await tx.travelPhoto.findUnique({
        where: { id: photoId },
      });

      if (!photo || photo.tripId !== tripId || photo.deletedAt) {
        throw AppError.notFound("Photo not found on this trip.");
      }

      // Detach photo by deleting record
      await tx.travelPhoto.delete({
        where: { id: photoId },
      });

      // If this photo was the cover photo, pick the first remaining active photo or null
      if (trip.coverPhotoId === photoId) {
        const nextPhoto = await tx.travelPhoto.findFirst({
          where: {
            tripId,
            deletedAt: null,
            id: { not: photoId },
          },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        });

        await tx.travelTrip.update({
          where: { id: tripId },
          data: { coverPhotoId: nextPhoto ? nextPhoto.id : null },
        });
      }

      return { detached: true };
    });

    await invalidateUserCache(userId);
    return result;
  }

  /**
   * Selects an existing active trip photo as the album cover.
   */
  async setTripCover(
    userId: string,
    tripId: string,
    input: SetTripCoverInput,
  ): Promise<{ coverPhotoId: string }> {
    const trip = await prisma.travelTrip.findUnique({
      where: { id: tripId },
    });

    if (!trip || trip.deletedAt) {
      throw AppError.notFound("Travel trip not found.");
    }
    if (trip.userId !== userId) {
      throw AppError.forbidden("You do not have permission to edit this travel trip.");
    }

    const photo = await prisma.travelPhoto.findUnique({
      where: { id: input.photoId },
    });

    if (!photo || photo.tripId !== tripId || photo.deletedAt) {
      throw AppError.badRequest("Selected photo does not belong to this trip.");
    }

    await prisma.travelTrip.update({
      where: { id: tripId },
      data: { coverPhotoId: photo.id },
    });

    await invalidateUserCache(userId);
    return { coverPhotoId: photo.id };
  }

  /**
   * Updates metadata for an active trip photo (caption, location, destinationId).
   */
  async updatePhotoMetadata(
    userId: string,
    photoId: string,
    input: UpdateTravelPhotoInput,
  ): Promise<TravelPhotoOwnerDto> {
    const photo = await prisma.travelPhoto.findUnique({
      where: { id: photoId },
      include: {
        trip: { select: { id: true, userId: true, title: true, coverPhotoId: true } },
      },
    });

    if (!photo || photo.deletedAt) {
      throw AppError.notFound("Photo not found.");
    }

    if (photo.userId !== userId && photo.trip.userId !== userId) {
      throw AppError.forbidden("You do not have permission to edit this photo.");
    }

    if (input.destinationId) {
      const dest = await prisma.destination.findUnique({
        where: { id: input.destinationId },
      });
      if (!dest) {
        throw AppError.badRequest("Selected destination does not exist.");
      }
    }

    const updated = await prisma.travelPhoto.update({
      where: { id: photoId },
      data: {
        caption: input.caption !== undefined ? input.caption : undefined,
        location: input.location !== undefined ? input.location : undefined,
        destinationId: input.destinationId !== undefined ? input.destinationId : undefined,
      },
      include: {
        trip: { select: { id: true, title: true, coverPhotoId: true } },
        destination: true,
        tags: {
          include: {
            taggedUser: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    await invalidateUserCache(userId);

    return {
      id: updated.id,
      tripId: updated.tripId,
      tripTitle: updated.trip.title,
      mediaAssetId: updated.mediaAssetId,
      caption: updated.caption,
      location: updated.location,
      destinationId: updated.destinationId,
      destination: updated.destination,
      displayOrder: updated.displayOrder,
      isCover: updated.trip.coverPhotoId === updated.id,
      thumbnailUrl: `/api/v1/travel-media/${updated.mediaAssetId}/file?variant=thumbnail`,
      mediumUrl: `/api/v1/travel-media/${updated.mediaAssetId}/file?variant=medium`,
      tags: updated.tags.map((t: TaggedPhotoTag) => ({
        id: t.id,
        photoId: t.photoId,
        taggedUserId: t.taggedUserId,
        status: t.status,
        user: {
          id: t.taggedUser.id,
          name: t.taggedUser.name,
          image: t.taggedUser.image,
        },
        createdAt: t.createdAt.toISOString(),
      })),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves all active photos owned by the user across trips with filtering and pagination.
   */
  async getAllOwnerPhotos(
    userId: string,
    query: AllPhotosQuery,
  ): Promise<{ photos: TravelPhotoOwnerDto[]; nextCursor: string | null; totalCount: number }> {
    const limit = Math.min(Math.max(query.limit ?? 24, 1), 50);

    const whereClause: Prisma.TravelPhotoWhereInput = {
      userId,
      deletedAt: null,
      trip: {
        deletedAt: null,
        ...(query.tripId ? { id: query.tripId } : {}),
      },
      ...(query.destinationId
        ? {
            OR: [
              { destinationId: query.destinationId },
              { trip: { destinationId: query.destinationId } },
            ],
          }
        : {}),
    };

    const [totalCount, items] = await Promise.all([
      prisma.travelPhoto.count({ where: whereClause }),
      prisma.travelPhoto.findMany({
        where: whereClause,
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          trip: { select: { id: true, title: true, coverPhotoId: true } },
          destination: true,
          tags: {
            include: {
              taggedUser: { select: { id: true, name: true, image: true } },
            },
          },
        },
      }),
    ]);

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    const photos: TravelPhotoOwnerDto[] = pageItems.map((p: OwnerPhotoWithTrip) => ({
      id: p.id,
      tripId: p.tripId,
      tripTitle: p.trip.title,
      mediaAssetId: p.mediaAssetId,
      caption: p.caption,
      location: p.location,
      destinationId: p.destinationId,
      destination: p.destination,
      displayOrder: p.displayOrder,
      isCover: p.trip.coverPhotoId === p.id,
      thumbnailUrl: `/api/v1/travel-media/${p.mediaAssetId}/file?variant=thumbnail`,
      mediumUrl: `/api/v1/travel-media/${p.mediaAssetId}/file?variant=medium`,
      tags: p.tags.map((t: TaggedPhotoTag) => ({
        id: t.id,
        photoId: t.photoId,
        taggedUserId: t.taggedUserId,
        status: t.status,
        user: {
          id: t.taggedUser.id,
          name: t.taggedUser.name,
          image: t.taggedUser.image,
        },
        createdAt: t.createdAt.toISOString(),
      })),
      createdAt: p.createdAt.toISOString(),
    }));

    return { photos, nextCursor, totalCount };
  }

  /**
   * Owner-only compatibility projection for images uploaded before TravelTrip
   * and TravelPhoto existed. These public legacy URLs are not represented as
   * secure album media and must never be returned from public profile APIs.
   */
  async getLegacyOwnerPhotos(userId: string): Promise<LegacyTripPhotoOwnerDto[]> {
    const photos = await prisma.tripPhoto.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        caption: true,
        location: true,
        tags: true,
        createdAt: true,
      },
    });

    return photos.map((photo: {
      id: string;
      url: string;
      caption: string | null;
      location: string | null;
      tags: string[];
      createdAt: Date;
    }) => ({
      id: photo.id,
      url: photo.url,
      caption: photo.caption,
      location: photo.location,
      tags: photo.tags,
      createdAt: photo.createdAt.toISOString(),
    }));
  }
}

export const travelTripService = new TravelTripService();
