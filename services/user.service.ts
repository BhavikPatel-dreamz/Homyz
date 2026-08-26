import { AppError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import type {
  ChangePasswordInput,
  UpdateProfileInput,
} from "@/lib/validation/user";

import { toPublicUser, type PublicUser } from "./mappers";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function getById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound("User not found");
  return toPublicUser(user);
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
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.image !== undefined) data.image = input.image;
  if (input.phone !== undefined) {
    data.phone = input.phone;
    // Re-verification required when the phone number changes.
    data.phoneVerified = null;
  }

  try {
    const user = await prisma.user.update({ where: { id: userId }, data });
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
