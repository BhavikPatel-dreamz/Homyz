import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { BookingStatus, ReviewStatus } from "@/generated/prisma/client";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";

import type { TravelProfileDTO, TravelProfileStatsDTO } from "@/types/travel";
export type { TravelProfileDTO, TravelProfileStatsDTO };

export interface UpdateTravelProfileInput {
  displayName?: string | null;
  handle?: string | null;
  bio?: string | null;
  homeLocation?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY";
  coverUrl?: string | null;
  avatarUrl?: string | null;
}

export const HANDLE_REGEX = /^[a-z0-9_.-]{3,30}$/;

export function normalizeHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/^@+/, "");
  return cleaned || null;
}

export function validateHandle(handle: string): string {
  const normalized = normalizeHandle(handle);
  if (!normalized || !HANDLE_REGEX.test(normalized)) {
    throw AppError.badRequest(
      "Handle must be 3-30 characters long and contain only lowercase letters, numbers, underscores, dashes, or dots.",
    );
  }
  return normalized;
}

export async function getTravelProfileByUserId(userId: string): Promise<TravelProfileDTO> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
      publicProfile: true,
      travelProfile: true,
    },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  const pub = (user.publicProfile as Record<string, unknown> | null) || {};
  // A profile is created lazily for legacy accounts. Its database default
  // assigns the permanent public ID exactly once.
  const tp = user.travelProfile ?? await prisma.travelProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return {
    id: tp.id,
    userId: user.id,
    publicProfileId: tp.publicId,
    handle: tp.handle || null,
    displayName: tp.displayName || user.name || "Traveler",
    bio: tp.bio !== undefined && tp.bio !== null ? tp.bio : (typeof pub.bio === "string" ? pub.bio : null),
    homeLocation:
      tp.homeLocation !== undefined && tp.homeLocation !== null
        ? tp.homeLocation
        : (typeof pub.whereILive === "string" ? pub.whereILive : null),
    coverUrl: tp.coverUrl || null,
    visibility: tp.visibility as "PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY",
    showStamps: tp.showStamps,
    createdAt: tp.createdAt,
    updatedAt: tp.updatedAt,
    user: {
      id: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
    },
  };
}

export async function getTravelProfileStats(userId: string): Promise<TravelProfileStatsDTO> {
  const [confirmedBookings, profileLikes, photoLikes, tripLikes, reviewsCount] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.profileLike.count({
      where: { targetUserId: userId },
    }),
    prisma.travelPhotoLike.count({ where: { photo: { is: { userId } } } }),
    prisma.travelTripLike.count({ where: { trip: { is: { userId } } } }),
    prisma.review.count({
      where: {
        authorId: userId,
        status: ReviewStatus.PUBLISHED,
      },
    }),
  ]);

  const completedTrips = confirmedBookings.filter((b) =>
    isCompletedConfirmedBooking({
      dbStatus: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
    }),
  ).length;

  return {
    trips: completedTrips,
    // “Likes” consistently means reactions received across this travel profile,
    // its photos, and its trips — never likes the owner has given.
    likes: profileLikes + photoLikes + tripLikes,
    reviews: reviewsCount,
  };
}

export async function updateTravelProfile(
  userId: string,
  input: UpdateTravelProfileInput,
): Promise<TravelProfileDTO> {
  let normalizedHandle: string | null | undefined = undefined;

  if (input.handle !== undefined) {
    if (input.handle === null || input.handle.trim() === "") {
      normalizedHandle = null;
    } else {
      normalizedHandle = validateHandle(input.handle);

      const existing = await prisma.travelProfile.findFirst({
        where: {
          handle: normalizedHandle,
          NOT: { userId },
        },
      });

      if (existing) {
        throw AppError.conflict("Handle is already taken. Please choose another.");
      }
    }
  }

  const cleanDisplayName = input.displayName !== undefined
    ? (input.displayName ? input.displayName.trim().slice(0, 100) : null)
    : undefined;

  const cleanBio = input.bio !== undefined
    ? (input.bio ? input.bio.trim().slice(0, 500) : null)
    : undefined;

  const cleanLocation = input.homeLocation !== undefined
    ? (input.homeLocation ? input.homeLocation.trim().slice(0, 120) : null)
    : undefined;

  if (input.avatarUrl !== undefined && input.avatarUrl) {
    await prisma.user.update({
      where: { id: userId },
      data: { image: input.avatarUrl },
    });
  }

  await prisma.travelProfile.upsert({
    where: { userId },
    create: {
      userId,
      handle: normalizedHandle !== undefined ? normalizedHandle : null,
      displayName: cleanDisplayName !== undefined ? cleanDisplayName : null,
      bio: cleanBio !== undefined ? cleanBio : null,
      homeLocation: cleanLocation !== undefined ? cleanLocation : null,
      coverUrl: input.coverUrl !== undefined ? input.coverUrl : null,
      visibility: input.visibility || "PUBLIC",
    },
    update: {
      ...(normalizedHandle !== undefined && { handle: normalizedHandle }),
      ...(cleanDisplayName !== undefined && { displayName: cleanDisplayName }),
      ...(cleanBio !== undefined && { bio: cleanBio }),
      ...(cleanLocation !== undefined && { homeLocation: cleanLocation }),
      ...(input.coverUrl !== undefined && { coverUrl: input.coverUrl }),
      ...(input.visibility !== undefined && { visibility: input.visibility }),
    },
  });

  return getTravelProfileByUserId(userId);
}

export async function toggleProfileLike(
  actorId: string,
  targetUserId: string,
): Promise<{ liked: boolean; count: number }> {
  if (actorId === targetUserId) {
    throw AppError.badRequest("You cannot like your own travel profile.");
  }

  const existing = await prisma.profileLike.findUnique({
    where: {
      actorId_targetUserId: {
        actorId,
        targetUserId,
      },
    },
  });

  if (existing) {
    await prisma.profileLike.delete({
      where: {
        actorId_targetUserId: {
          actorId,
          targetUserId,
        },
      },
    });
  } else {
    await prisma.profileLike.create({
      data: {
        actorId,
        targetUserId,
      },
    });
  }

  const count = await prisma.profileLike.count({
    where: { targetUserId },
  });

  return {
    liked: !existing,
    count,
  };
}

export async function getProfileLikeStatus(
  actorId: string | null | undefined,
  targetUserId: string,
): Promise<{ liked: boolean; count: number }> {
  const [count, liked] = await Promise.all([
    prisma.profileLike.count({
      where: { targetUserId },
    }),
    actorId
      ? prisma.profileLike
          .findUnique({
            where: {
              actorId_targetUserId: {
                actorId,
                targetUserId,
              },
            },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  return {
    liked,
    count,
  };
}
