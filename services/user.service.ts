import { AppError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { deleteCache, getOrSetCache } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/lib/validation/user";

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
    data.publicProfile = input.publicProfile;
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
  return { success: true };
}

export const userService = {
  getById,
  updateProfile,
  changePassword,
};
