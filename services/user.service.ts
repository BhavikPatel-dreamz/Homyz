import { AppError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { deleteCache, getOrSetCache } from "@/lib/redis/cache";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import { keys } from "@/lib/redis/keys";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/lib/validation/user";
import type { UpdateHostPublicProfileInput } from "@/lib/validation/host-profile";

import { revivePublicUser, toPublicUser, type PublicUser } from "./mappers";

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
  const data: {
    name?: string;
    image?: string;
    phone?: string;
    phoneVerified?: Date | null;
    publicProfile?: any;
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
    data.publicProfile = pub;
  }

  try {
    const user = await prisma.user.update({ where: { id: userId }, data });
    // Invalidate the cached profile after the write commits (fail-open).
    await deleteCache(keys.userProfile(userId));
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
  const nextProfile = {
    ...current,
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.prompts !== undefined ? { prompts: { ...currentPrompts, ...input.prompts } } : {}),
    ...(input.languages !== undefined ? { languages: [...new Set(input.languages)] } : {}),
    ...(input.interests !== undefined ? { interests: [...new Set(input.interests)] } : {}),
    ...(input.stampsVisible !== undefined ? { stampsVisible: input.stampsVisible } : {}),
    ...(input.selectedStamps !== undefined ? { selectedStamps: [...new Set(input.selectedStamps)].slice(0, 10) } : {}),
  };
  const user = await prisma.user.update({
    where: { id: userId },
    data: { publicProfile: nextProfile },
  });
  await deleteCache(keys.userProfile(userId));
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
  return { success: true };
}

async function getUserStats(userId: string) {
  const tripsCount = await prisma.booking.count({ where: { userId } });
  const photosCount = await prisma.tripPhoto.count({ where: { userId } });
  return {
    trips: Math.max(tripsCount, photosCount),
    likes: 0,
    reviews: 0,
  };
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
};
