import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { TravelProfileVisibility, TravelFollowStatus } from "@/generated/prisma/client";
import type { TravelFollowListItemDTO } from "@/types/travel";
import { notificationService } from "@/services/notification.service";

export interface TravelAccessCheckResult {
  canView: boolean;
  isOwner: boolean;
  isBlocked: boolean;
  isFollowing: boolean;
  followStatus: TravelFollowStatus | "NONE";
  effectiveVisibility: TravelProfileVisibility;
  restrictionReason?: "BLOCKED" | "PRIVATE" | "FOLLOWERS_ONLY" | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Centralized Access Policy & Authorization Matrix
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a viewer is authorized to view an owner's travel profile.
 * Applies bi-directional blocking, owner bypass, and followers-only resolution.
 */
export async function canViewTravelProfile(
  viewerId: string | null | undefined,
  ownerId: string,
): Promise<TravelAccessCheckResult> {
  const isOwner = Boolean(viewerId && viewerId === ownerId);

  // Profile owner can always view their own profile
  if (isOwner) {
    return {
      canView: true,
      isOwner: true,
      isBlocked: false,
      isFollowing: false,
      followStatus: "NONE",
      effectiveVisibility: TravelProfileVisibility.PUBLIC,
      restrictionReason: null,
    };
  }

  // 1. Bi-directional blocking check
  if (viewerId) {
    const block = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: ownerId, blockedId: viewerId },
          { blockerId: viewerId, blockedId: ownerId },
        ],
      },
    });

    if (block) {
      return {
        canView: false,
        isOwner: false,
        isBlocked: true,
        isFollowing: false,
        followStatus: "NONE",
        effectiveVisibility: TravelProfileVisibility.PRIVATE,
        restrictionReason: "BLOCKED",
      };
    }
  }

  // 2. Fetch Owner's TravelProfile visibility
  const profile = await prisma.travelProfile.findUnique({
    where: { userId: ownerId },
    select: { visibility: true },
  });

  const visibility = profile?.visibility || TravelProfileVisibility.PUBLIC;

  if (visibility === TravelProfileVisibility.PUBLIC) {
    let followStatus: TravelFollowStatus | "NONE" = "NONE";
    let isFollowing = false;
    if (viewerId) {
      const follow = await prisma.travelFollow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      });
      if (follow) {
        followStatus = follow.status;
        isFollowing = follow.status === TravelFollowStatus.ACCEPTED;
      }
    }

    return {
      canView: true,
      isOwner: false,
      isBlocked: false,
      isFollowing,
      followStatus,
      effectiveVisibility: TravelProfileVisibility.PUBLIC,
      restrictionReason: null,
    };
  }

  if (visibility === TravelProfileVisibility.PRIVATE) {
    return {
      canView: false,
      isOwner: false,
      isBlocked: false,
      isFollowing: false,
      followStatus: "NONE",
      effectiveVisibility: TravelProfileVisibility.PRIVATE,
      restrictionReason: "PRIVATE",
    };
  }

  // 3. FOLLOWERS_ONLY Visibility
  if (!viewerId) {
    return {
      canView: false,
      isOwner: false,
      isBlocked: false,
      isFollowing: false,
      followStatus: "NONE",
      effectiveVisibility: TravelProfileVisibility.FOLLOWERS_ONLY,
      restrictionReason: "FOLLOWERS_ONLY",
    };
  }

  const follow = await prisma.travelFollow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewerId,
        followingId: ownerId,
      },
    },
  });

  const isApproved = follow?.status === TravelFollowStatus.ACCEPTED;

  return {
    canView: isApproved,
    isOwner: false,
    isBlocked: false,
    isFollowing: isApproved,
    followStatus: follow?.status || "NONE",
    effectiveVisibility: TravelProfileVisibility.FOLLOWERS_ONLY,
    restrictionReason: isApproved ? null : "FOLLOWERS_ONLY",
  };
}

/**
 * Checks whether a viewer is authorized to access a specific travel photo.
 * Enforces hierarchical permission: Profile -> Trip -> Photo.
 */
export async function canAccessTravelPhoto(
  viewerId: string | null | undefined,
  photoId: string,
): Promise<{ canAccess: boolean; reason?: string }> {
  const photo = await prisma.travelPhoto.findUnique({
    where: { id: photoId },
    include: {
      trip: { select: { id: true, visibility: true, userId: true } },
    },
  });

  if (!photo) {
    return { canAccess: false, reason: "NOT_FOUND" };
  }

  if (viewerId && viewerId === photo.userId) {
    return { canAccess: true };
  }

  // Check parent profile access first
  const profileAccess = await canViewTravelProfile(viewerId, photo.userId);
  if (!profileAccess.canView) {
    return { canAccess: false, reason: profileAccess.restrictionReason || "RESTRICTED_PROFILE" };
  }

  // Check parent trip visibility if photo belongs to a trip
  if (photo.trip) {
    if (photo.trip.visibility === TravelProfileVisibility.PRIVATE) {
      return { canAccess: false, reason: "RESTRICTED_TRIP" };
    }
    if (photo.trip.visibility === TravelProfileVisibility.FOLLOWERS_ONLY && !profileAccess.isFollowing) {
      return { canAccess: false, reason: "RESTRICTED_TRIP_FOLLOWERS_ONLY" };
    }
  }

  // Check photo-level visibility
  if (photo.visibility === TravelProfileVisibility.PRIVATE) {
    return { canAccess: false, reason: "RESTRICTED_PHOTO" };
  }
  if (photo.visibility === TravelProfileVisibility.FOLLOWERS_ONLY && !profileAccess.isFollowing) {
    return { canAccess: false, reason: "RESTRICTED_PHOTO_FOLLOWERS_ONLY" };
  }

  return { canAccess: true };
}

/** Batch counterpart for feed/list views; avoids one privacy query per card. */
export async function getAccessibleTravelPhotoIds(
  viewerId: string | null | undefined,
  photoIds: string[],
): Promise<Set<string>> {
  if (!photoIds.length) return new Set();
  const photos = await prisma.travelPhoto.findMany({
    where: { id: { in: photoIds } },
    select: {
      id: true, userId: true, visibility: true,
      trip: { select: { visibility: true } },
      user: {
        select: {
          travelProfile: { select: { visibility: true } },
          travelFollowers: viewerId ? { where: { followerId: viewerId, status: TravelFollowStatus.ACCEPTED }, select: { id: true } } : false,
        },
      },
    },
  });
  const ownerIds = [...new Set(photos.map((photo) => photo.userId))];
  const blocks = viewerId ? await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId, blockedId: { in: ownerIds } }, { blockerId: { in: ownerIds }, blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  }) : [];
  const blockedOwners = new Set(blocks.map((block) => block.blockerId === viewerId ? block.blockedId : block.blockerId));
  return new Set(photos.filter((photo) => {
    if (viewerId === photo.userId) return true;
    if (blockedOwners.has(photo.userId)) return false;
    const profileVisibility = photo.user.travelProfile?.visibility || TravelProfileVisibility.PUBLIC;
    const following = Array.isArray(photo.user.travelFollowers) && photo.user.travelFollowers.length > 0;
    if (profileVisibility === TravelProfileVisibility.PRIVATE || (profileVisibility === TravelProfileVisibility.FOLLOWERS_ONLY && !following)) return false;
    if (photo.trip?.visibility === TravelProfileVisibility.PRIVATE || (photo.trip?.visibility === TravelProfileVisibility.FOLLOWERS_ONLY && !following)) return false;
    if (photo.visibility === TravelProfileVisibility.PRIVATE || (photo.visibility === TravelProfileVisibility.FOLLOWERS_ONLY && !following)) return false;
    return true;
  }).map((photo) => photo.id));
}

/**
 * Checks whether a viewer is authorized to access a specific travel trip album.
 */
export async function canAccessTravelTrip(
  viewerId: string | null | undefined,
  tripId: string,
): Promise<{ canAccess: boolean; reason?: string }> {
  const trip = await prisma.travelTrip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    return { canAccess: false, reason: "NOT_FOUND" };
  }

  if (viewerId && viewerId === trip.userId) {
    return { canAccess: true };
  }

  const profileAccess = await canViewTravelProfile(viewerId, trip.userId);
  if (!profileAccess.canView) {
    return { canAccess: false, reason: profileAccess.restrictionReason || "RESTRICTED_PROFILE" };
  }

  if (trip.visibility === TravelProfileVisibility.PRIVATE) {
    return { canAccess: false, reason: "RESTRICTED_TRIP" };
  }

  if (trip.visibility === TravelProfileVisibility.FOLLOWERS_ONLY && !profileAccess.isFollowing) {
    return { canAccess: false, reason: "RESTRICTED_TRIP_FOLLOWERS_ONLY" };
  }

  return { canAccess: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Blocking Management
// ─────────────────────────────────────────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (blockerId === blockedId) {
    throw AppError.badRequest("You cannot block yourself");
  }

  // Revoke any follow relationships in both directions
  await prisma.travelFollow.deleteMany({
    where: {
      OR: [
        { followerId: blockerId, followingId: blockedId },
        { followerId: blockedId, followingId: blockerId },
      ],
    },
  });

  // Idempotently create block record
  await prisma.userBlock.upsert({
    where: {
      blockerId_blockedId: { blockerId, blockedId },
    },
    update: {},
    create: { blockerId, blockedId },
  });

  return true;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  await prisma.userBlock.deleteMany({
    where: { blockerId, blockedId },
  });
  return true;
}

export async function getBlockedUsers(userId: string): Promise<{ id: string; name: string | null; image: string | null }[]> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    include: {
      blocked: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return blocks.map((b) => b.blocked);
}

// ─────────────────────────────────────────────────────────────────────────────
// Follower Management
// ─────────────────────────────────────────────────────────────────────────────

export async function followTraveler(
  followerId: string,
  followingId: string,
): Promise<{ status: TravelFollowStatus }> {
  if (followerId === followingId) {
    throw AppError.badRequest("You cannot follow yourself");
  }

  // Prevent following if blocked
  const isBlocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: followingId, blockedId: followerId },
        { blockerId: followerId, blockedId: followingId },
      ],
    },
  });

  if (isBlocked) {
    throw AppError.forbidden("Unable to follow this user");
  }

  // The current product has no approval workflow, so every permitted follow is accepted.
  const targetStatus = TravelFollowStatus.ACCEPTED;

  const follow = await prisma.travelFollow.upsert({
    where: {
      followerId_followingId: { followerId, followingId },
    },
    update: { status: targetStatus },
    create: {
      followerId,
      followingId,
      status: targetStatus,
    },
  });

  void notificationService.create({
    userId: followingId,
    type: "SYSTEM",
    title: "New follower",
    message: "Someone started following your travel profile.",
    entityId: follow.id,
    entityType: "travel-follow",
    link: "/travel-profile",
  }).catch(() => {});

  return { status: follow.status };
}

export async function unfollowTraveler(followerId: string, followingId: string): Promise<boolean> {
  await prisma.travelFollow.deleteMany({
    where: { followerId, followingId },
  });
  return true;
}

export async function getTravelFollowCounts(userId: string): Promise<{ followersCount: number; followingCount: number }> {
  const [followersCount, followingCount] = await Promise.all([
    prisma.travelFollow.count({ where: { followingId: userId, status: TravelFollowStatus.ACCEPTED } }),
    prisma.travelFollow.count({ where: { followerId: userId, status: TravelFollowStatus.ACCEPTED } }),
  ]);
  return { followersCount, followingCount };
}

export async function getTravelFollowList(
  actorId: string | null | undefined,
  profileUserId: string,
  kind: "followers" | "following",
  options: { search?: string; cursor?: string; limit?: number } = {},
): Promise<{ items: TravelFollowListItemDTO[]; nextCursor: string | null; totalCount: number }> {
  const access = await canViewTravelProfile(actorId, profileUserId);
  if (!access.isOwner && (!access.canView || access.effectiveVisibility !== TravelProfileVisibility.PUBLIC)) {
    throw AppError.forbidden("This follower list is private.");
  }
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const search = options.search?.trim();
  const userWhere = search ? { OR: [
    { name: { contains: search, mode: "insensitive" as const } },
    { travelProfile: { is: { handle: { contains: search.toLowerCase(), mode: "insensitive" as const } } } },
  ] } : undefined;
  const where = kind === "followers"
    ? { followingId: profileUserId, status: TravelFollowStatus.ACCEPTED, ...(userWhere ? { follower: userWhere } : {}) }
    : { followerId: profileUserId, status: TravelFollowStatus.ACCEPTED, ...(userWhere ? { following: userWhere } : {}) };
  const follows = await prisma.travelFollow.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: {
      follower: { select: { id: true, name: true, image: true, travelProfile: { select: { publicId: true, handle: true } } } },
      following: { select: { id: true, name: true, image: true, travelProfile: { select: { publicId: true, handle: true } } } },
    },
  });
  const page = follows.slice(0, limit);
  return {
    items: page.map((follow) => {
      const user = kind === "followers" ? follow.follower : follow.following;
      return {
        id: user.id,
        name: user.name,
        image: user.image,
        publicProfileId: user.travelProfile?.publicId || null,
        handle: user.travelProfile?.handle || null,
        followedAt: follow.createdAt,
      };
    }),
    nextCursor: follows.length > limit ? page.at(-1)?.id || null : null,
    totalCount: await prisma.travelFollow.count({ where }),
  };
}

export async function updateProfileVisibility(
  userId: string,
  visibility: TravelProfileVisibility,
): Promise<TravelProfileVisibility> {
  const updated = await prisma.travelProfile.upsert({
    where: { userId },
    update: { visibility },
    create: {
      userId,
      visibility,
    },
  });
  return updated.visibility;
}

export async function updateTripVisibility(
  userId: string,
  tripId: string,
  visibility: TravelProfileVisibility,
): Promise<TravelProfileVisibility> {
  const trip = await prisma.travelTrip.findUnique({ where: { id: tripId } });
  if (!trip || trip.userId !== userId) {
    throw AppError.notFound("Trip not found or unauthorized");
  }

  const updated = await prisma.travelTrip.update({
    where: { id: tripId },
    data: { visibility },
  });
  return updated.visibility;
}

export async function updatePhotoVisibility(
  userId: string,
  photoId: string,
  visibility: TravelProfileVisibility,
): Promise<TravelProfileVisibility> {
  const photo = await prisma.travelPhoto.findUnique({ where: { id: photoId } });
  if (!photo || photo.userId !== userId) {
    throw AppError.notFound("Photo not found or unauthorized");
  }

  const updated = await prisma.travelPhoto.update({
    where: { id: photoId },
    data: { visibility },
  });
  return updated.visibility;
}
