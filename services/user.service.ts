import { AppError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { deleteCache, getOrSetCache, incrCounter } from "@/lib/redis/cache";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import { keys } from "@/lib/redis/keys";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/lib/validation/user";
import type { UpdateHostPublicProfileInput } from "@/lib/validation/host-profile";

import { deleteManagedMediaUrl, deleteManagedMediaUrls } from "@/lib/storage/media";
import type { Prisma } from "@/generated/prisma/client";
import { BookingStatus, ListingStatus, ReviewStatus } from "@/generated/prisma/enums";
import { qualificationService } from "@/services/qualification.service";

import { revivePublicUser, toPublicUser, type PublicUser } from "./mappers";

function customStampIconUrls(profile: unknown): string[] {
  if (!profile || typeof profile !== "object" || !("customStamps" in profile)) return [];
  const stamps = (profile as { customStamps?: unknown }).customStamps;
  if (!Array.isArray(stamps)) return [];
  return stamps
    .map((stamp) => {
      if (!stamp || typeof stamp !== "object" || !("iconUrl" in stamp)) return "";
      const url = (stamp as { iconUrl?: unknown }).iconUrl;
      return typeof url === "string" ? url : "";
    })
    .filter(Boolean);
}

// The profile payload is a pure function of the target user row (viewer-
// independent), so the key is the target id and the entry is safe to share
// across authorized callers. If getById ever returns viewer-dependent fields,
// this MUST be re-keyed by viewer to avoid cross-user leakage.
const USER_PROFILE_TTL = 180;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function getById(id: string): Promise<PublicUser> {
  return getOrSetCache(
    keys.userProfile(id),
    async () => {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw AppError.notFound("User not found");
      return toPublicUser(user);
    },
    { ttl: USER_PROFILE_TTL, revive: revivePublicUser },
  );
}

async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { image: true, publicProfile: true },
  });

  const data: {
    name?: string;
    image?: string;
    phone?: string;
    phoneVerified?: Date | null;
    publicProfile?: Prisma.InputJsonValue;
  } = {};
  if (input.name) data.name = input.name;
  if (input.image) data.image = input.image;
  if (input.phone) {
    data.phone = input.phone;
    data.phoneVerified = null;
  }
  if (input.publicProfile !== undefined) {
    const pub = { ...input.publicProfile };
    if (pub.selectedStamps && Array.isArray(pub.selectedStamps)) {
      // Backend enforcement: remove duplicates & enforce max 10 stamps limit
      pub.selectedStamps = Array.from(new Set(pub.selectedStamps as string[])).slice(0, 10);
    }
    if (pub.stampsVisible === undefined) {
      pub.stampsVisible = true;
    }
    data.publicProfile = pub as Prisma.InputJsonValue;
  }

  try {
    const user = await prisma.user.update({ where: { id: userId }, data });
    // Invalidate the cached profile after the write commits (fail-open).
    await deleteCache(keys.userProfile(userId));
    if (input.image && current?.image && current.image !== input.image) {
      await deleteManagedMediaUrl(current.image);
    }
    if (input.publicProfile !== undefined) {
      const previousIcons = customStampIconUrls(current?.publicProfile);
      const nextIcons = customStampIconUrls(data.publicProfile);
      await deleteManagedMediaUrls(previousIcons.filter((url) => !nextIcons.includes(url)));
    }
    return toPublicUser(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw AppError.conflict("That phone number is already in use");
    }
    throw err;
  }
}

/** Merge the listing-editor fields into the shared public profile. */
async function updateHostPublicProfile(userId: string, input: UpdateHostPublicProfileInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicProfile: true },
  });
  if (!existing) throw AppError.notFound("User not found");

  const current = (existing.publicProfile as Record<string, unknown> | null) ?? {};
  const currentPrompts = (current.prompts as Record<string, unknown> | undefined) ?? {};
  const uniqueStrings = (values: string[]) => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const nextProfile = {
    ...current,
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.prompts !== undefined ? { prompts: { ...currentPrompts, ...input.prompts } } : {}),
    ...(input.languages !== undefined ? { languages: uniqueStrings(input.languages) } : {}),
    ...(input.interests !== undefined ? { interests: uniqueStrings(input.interests) } : {}),
    ...(input.stampsVisible !== undefined ? { stampsVisible: input.stampsVisible } : {}),
    ...(input.selectedStamps !== undefined ? { selectedStamps: [...new Set(input.selectedStamps)].slice(0, 10) } : {}),
  };
  const user = await prisma.user.update({
    where: { id: userId },
    data: { publicProfile: nextProfile },
  });
  await Promise.all([
    deleteCache(keys.userProfile(userId)),
    // Public listing search also reads host-profile languages. Bump its
    // version whenever those languages change so filter counts/results do not
    // wait for the previous cache entry to expire.
    input.languages !== undefined ? incrCounter(keys.listingsPublicVersion()) : Promise.resolve(),
  ]);
  return toPublicUser(user);
}

async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<{ success: true }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash) {
    throw AppError.badRequest("Password change is not available for this account");
  }
  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) throw AppError.badRequest("Current password is incorrect");

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Invalidate mobile sessions after a password change.
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await invalidateUserCache(userId);
  return { success: true };
}

async function getTripPhotos(userId: string) {
  return prisma.tripPhoto.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

async function createTripPhotos(
  userId: string,
  photos: Array<{ url: string; caption?: string; location?: string; tags?: string[] }>
) {
  if (!photos.length) return [];
  const created = await Promise.all(
    photos.map((p) =>
      prisma.tripPhoto.create({
        data: {
          userId,
          url: p.url,
          caption: p.caption || null,
          location: p.location || null,
          tags: p.tags || [],
        },
      })
    )
  );
  return created;
}

async function updateTripPhoto(
  userId: string,
  photoId: string,
  input: { caption?: string; location?: string; tags?: string[] }
) {
  const photo = await prisma.tripPhoto.findUnique({ where: { id: photoId } });
  if (!photo) throw AppError.notFound("Trip photo not found");
  if (photo.userId !== userId) {
    throw AppError.forbidden("You do not have permission to modify this photo");
  }

  return prisma.tripPhoto.update({
    where: { id: photoId },
    data: {
      ...(input.caption !== undefined && { caption: input.caption }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.tags !== undefined && { tags: input.tags }),
    },
  });
}

async function deleteTripPhoto(userId: string, photoId: string) {
  const photo = await prisma.tripPhoto.findUnique({ where: { id: photoId } });
  if (!photo) throw AppError.notFound("Trip photo not found");
  if (photo.userId !== userId) {
    throw AppError.forbidden("You do not have permission to delete this photo");
  }

  await prisma.tripPhoto.delete({ where: { id: photoId } });
  await deleteManagedMediaUrl(photo.url);
  return { success: true };
}

async function getUserStats(userId: string) {
  const [tripsCount, photosCount, reviewsCount] = await Promise.all([
    prisma.booking.count({ where: { userId } }),
    prisma.tripPhoto.count({ where: { userId } }),
    prisma.review.count({ where: { authorId: userId, status: ReviewStatus.PUBLISHED } }),
  ]);
  return {
    trips: Math.max(tripsCount, photosCount),
    likes: 0,
    reviews: reviewsCount,
  };
}

export type PublicHostProfile = {
  host: {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: Date;
    publicProfile: Record<string, unknown>;
    isSuperhost: boolean;
  };
  stats: { reviewCount: number; averageRating: number | null; listingCount: number };
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    createdAt: Date;
    author: { name: string | null; image: string | null };
    listing: { title: string };
  }>;
  listings: Array<{
    id: string;
    customSlug: string | null;
    title: string;
    photos: string[];
    city: string | null;
    country: string | null;
    listingType: string | null;
    price: number;
  }>;
};

/** Public, privacy-safe data for the dedicated host profile page. */
async function getPublicHostProfile(userId: string, options: { reviewLimit?: number } = {}): Promise<PublicHostProfile> {
  const reviewLimit = Math.min(100, Math.max(1, options.reviewLimit ?? 3));
  const host = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true, createdAt: true, publicProfile: true },
  });
  if (!host) throw AppError.notFound("Host not found");

  const profile = host.publicProfile && typeof host.publicProfile === "object" && !Array.isArray(host.publicProfile)
    ? host.publicProfile as Record<string, unknown>
    : null;
  if (!profile || profile.profileVisible === false) throw AppError.notFound("Host profile is unavailable");

  const publicListingWhere = {
    hostId: host.id,
    published: true,
    status: ListingStatus.ACTIVE,
    isPaused: false,
    deletedAt: null,
  };
  const [listings, reviewSummary, latestReviews, bookingGroups] = await Promise.all([
    prisma.listing.findMany({
      where: publicListingWhere,
      select: { id: true, customSlug: true, title: true, photos: true, city: true, country: true, listingType: true, price: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    prisma.review.aggregate({
      where: { status: ReviewStatus.PUBLISHED, listing: publicListingWhere },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { status: ReviewStatus.PUBLISHED, comment: { not: "" }, listing: publicListingWhere },
      select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { name: true, image: true } }, listing: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: reviewLimit,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { listing: { hostId: host.id }, status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] } },
      _count: { _all: true },
    }),
  ]);
  const bookingSummary = {
    confirmed: bookingGroups.find((group: { status: BookingStatus; _count: { _all: number } }) => group.status === BookingStatus.CONFIRMED)?._count._all ?? 0,
    cancelled: bookingGroups.find((group: { status: BookingStatus; _count: { _all: number } }) => group.status === BookingStatus.CANCELLED)?._count._all ?? 0,
  };

  return {
    host: {
      id: host.id,
      name: host.name,
      image: host.image,
      createdAt: host.createdAt,
      publicProfile: profile,
      isSuperhost: qualificationService.isSuperhost({ createdAt: host.createdAt, publicProfile: profile, bookingSummary }),
    },
    stats: {
      reviewCount: reviewSummary._count._all,
      averageRating: reviewSummary._avg.rating === null ? null : Math.round(reviewSummary._avg.rating * 100) / 100,
      listingCount: listings.length,
    },
    reviews: latestReviews,
    listings,
  };
}

async function searchUsers(query: string, limit = 10) {
  const term = query.trim();
  return prisma.user.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        }
      : {},
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
    take: Math.min(100, Math.max(1, limit)),
  });
}

export const userService = {
  getById,
  updateProfile,
  updateHostPublicProfile,
  changePassword,
  getTripPhotos,
  createTripPhotos,
  updateTripPhoto,
  deleteTripPhoto,
  getUserStats,
  getPublicHostProfile,
  searchUsers,
};
