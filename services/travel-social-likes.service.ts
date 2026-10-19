import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";

export interface LikedProfileItem {
  id: string;
  profileId: string;
  handle: string | null;
  displayName: string | null;
  image: string | null;
  bio: string | null;
  likedAt: string;
}

export interface LikedPhotoItem {
  id: string;
  photoId: string;
  thumbnailUrl: string;
  caption: string | null;
  location: string | null;
  tripTitle: string;
  ownerName: string | null;
  likedAt: string;
}

export class TravelSocialLikesService {
  /**
   * Toggles a like on a TravelProfile.
   * Enforces accessibility, blocking rules, and prevents self-like.
   */
  async toggleProfileLike(
    actorId: string,
    targetProfileId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const profile = await prisma.travelProfile.findUnique({
      where: { id: targetProfileId },
      include: { user: true },
    });

    if (!profile) {
      throw AppError.notFound("Travel profile not found.");
    }

    if (profile.userId === actorId) {
      throw AppError.badRequest("You cannot like your own travel profile.");
    }

    // Check mutual blocking
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: actorId, blockedId: profile.userId },
          { blockerId: profile.userId, blockedId: actorId },
        ],
      },
    });

    if (block) {
      throw AppError.forbidden("Cannot interact with this profile due to privacy settings.");
    }

    const existingLike = await prisma.travelProfileLike.findUnique({
      where: {
        userId_profileId: {
          userId: actorId,
          profileId: targetProfileId,
        },
      },
    });

    let liked = false;
    if (existingLike) {
      await prisma.travelProfileLike.delete({
        where: { id: existingLike.id },
      });
      liked = false;
    } else {
      await prisma.travelProfileLike.create({
        data: {
          userId: actorId,
          profileId: targetProfileId,
        },
      });
      liked = true;
    }

    const likeCount = await prisma.travelProfileLike.count({
      where: { profileId: targetProfileId },
    });

    return { liked, likeCount };
  }

  /**
   * Retrieves current user's like state and total like count for a profile.
   */
  async getProfileLikeStatus(
    actorId: string | null,
    profileId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const likeCount = await prisma.travelProfileLike.count({
      where: { profileId },
    });

    let liked = false;
    if (actorId) {
      const record = await prisma.travelProfileLike.findUnique({
        where: {
          userId_profileId: {
            userId: actorId,
            profileId,
          },
        },
      });
      liked = Boolean(record);
    }

    return { liked, likeCount };
  }

  /**
   * Toggles a like on a TravelPhoto.
   */
  async togglePhotoLike(
    actorId: string,
    photoId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const photo = await prisma.travelPhoto.findUnique({
      where: { id: photoId },
      include: {
        trip: true,
      },
    });

    if (!photo || photo.deletedAt) {
      throw AppError.notFound("Travel photo not found.");
    }

    // Check mutual blocking with photo owner
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: actorId, blockedId: photo.userId },
          { blockerId: photo.userId, blockedId: actorId },
        ],
      },
    });

    if (block) {
      throw AppError.forbidden("Cannot interact with this photo due to privacy settings.");
    }

    const existingLike = await prisma.travelPhotoLike.findUnique({
      where: {
        userId_photoId: {
          userId: actorId,
          photoId,
        },
      },
    });

    let liked = false;
    if (existingLike) {
      await prisma.travelPhotoLike.delete({
        where: { id: existingLike.id },
      });
      liked = false;
    } else {
      await prisma.travelPhotoLike.create({
        data: {
          userId: actorId,
          photoId,
        },
      });
      liked = true;
    }

    const likeCount = await prisma.travelPhotoLike.count({
      where: { photoId },
    });

    return { liked, likeCount };
  }

  /**
   * Retrieves current user's like state and total like count for a photo.
   */
  async getPhotoLikeStatus(
    actorId: string | null,
    photoId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const likeCount = await prisma.travelPhotoLike.count({
      where: { photoId },
    });

    let liked = false;
    if (actorId) {
      const record = await prisma.travelPhotoLike.findUnique({
        where: {
          userId_photoId: {
            userId: actorId,
            photoId,
          },
        },
      });
      liked = Boolean(record);
    }

    return { liked, likeCount };
  }

  /**
   * Gets profiles liked by the user (Category 1: Liked Profiles).
   */
  async getUserLikedProfiles(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: LikedProfileItem[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    const records = await prisma.travelProfileLike.findMany({
      where: { userId },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        profile: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });

    const hasMore = records.length > limit;
    const pageItems = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    const items: LikedProfileItem[] = pageItems.map(
      (r: {
        id: string;
        createdAt: Date;
        profile: {
          id: string;
          handle: string | null;
          bio: string | null;
          user: { name: string | null; image: string | null };
        };
      }) => ({
        id: r.id,
        profileId: r.profile.id,
        handle: r.profile.handle,
        displayName: r.profile.user.name,
        image: r.profile.user.image,
        bio: r.profile.bio,
        likedAt: r.createdAt.toISOString(),
      }),
    );

    return { items, nextCursor };
  }

  /**
   * Gets pictures liked by the user (Category 2: Liked Pictures).
   */
  async getUserLikedPhotos(
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: LikedPhotoItem[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);

    const records = await prisma.travelPhotoLike.findMany({
      where: {
        userId,
        photo: { deletedAt: null },
      },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        photo: {
          include: {
            trip: { select: { title: true } },
            user: { select: { name: true } },
          },
        },
      },
    });

    const hasMore = records.length > limit;
    const pageItems = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1].id : null;

    const items: LikedPhotoItem[] = pageItems.map(
      (r: {
        id: string;
        createdAt: Date;
        photo: {
          id: string;
          mediaAssetId: string;
          caption: string | null;
          location: string | null;
          trip: { title: string };
          user: { name: string | null };
        };
      }) => ({
        id: r.id,
        photoId: r.photo.id,
        thumbnailUrl: `/api/v1/travel-media/${r.photo.mediaAssetId}/file?variant=thumbnail`,
        caption: r.photo.caption,
        location: r.photo.location,
        tripTitle: r.photo.trip.title,
        ownerName: r.photo.user.name,
        likedAt: r.createdAt.toISOString(),
      }),
    );

    return { items, nextCursor };
  }

  /**
   * Total received likes count for a user (profiles + photos).
   */
  async getTotalReceivedLikes(userId: string): Promise<number> {
    const [profileLikes, photoLikes] = await Promise.all([
      prisma.travelProfileLike.count({
        where: { profile: { userId } },
      }),
      prisma.travelPhotoLike.count({
        where: { photo: { userId, deletedAt: null } },
      }),
    ]);

    return profileLikes + photoLikes;
  }
}

export const travelSocialLikesService = new TravelSocialLikesService();

