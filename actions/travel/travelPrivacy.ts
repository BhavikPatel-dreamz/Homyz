"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/api/errors";
import { TravelProfileVisibility } from "@/generated/prisma/client";
import {
  updateProfileVisibility,
  blockUser,
  unblockUser,
  getBlockedUsers,
  followTraveler,
  unfollowTraveler,
} from "@/services/travel-privacy.service";

export async function updateProfileVisibilityAction(
  visibility: TravelProfileVisibility,
): Promise<TravelProfileVisibility> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  const result = await updateProfileVisibility(user.id, visibility);
  revalidatePath("/travel-profile");
  return result;
}

export async function blockUserAction(blockedId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  const result = await blockUser(user.id, blockedId);
  revalidatePath("/travel-profile");
  return result;
}

export async function unblockUserAction(blockedId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  const result = await unblockUser(user.id, blockedId);
  revalidatePath("/travel-profile");
  return result;
}

export async function getBlockedUsersAction(): Promise<{ id: string; name: string | null; image: string | null }[]> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  return getBlockedUsers(user.id);
}

export async function followTravelerAction(followingId: string): Promise<{ status: string }> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  const result = await followTraveler(user.id, followingId);
  revalidatePath("/travel-profile");
  return result;
}

export async function unfollowTravelerAction(followingId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user?.id) throw AppError.unauthorized("Authentication required");

  const result = await unfollowTraveler(user.id, followingId);
  revalidatePath("/travel-profile");
  return result;
}

