"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { userService } from "@/services/user.service";

export async function getTripPhotosAction(targetUserId?: string) {
  return runAction(async () => {
    let userId = targetUserId;
    if (!userId) {
      const actor = await getSessionUser();
      if (!actor) throw AppError.unauthorized();
      userId = actor.id;
    }
    return userService.getTripPhotos(userId);
  });
}

export async function uploadTripPhotosAction(
  photos: Array<{ url: string; caption?: string; location?: string; tags?: string[] }>
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const created = await userService.createTripPhotos(actor.id, photos);
    revalidatePath("/profile");
    revalidatePath("/profile-management");
    return created;
  });
}

export async function updateTripPhotoAction(
  photoId: string,
  input: { caption?: string; location?: string; tags?: string[] }
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const updated = await userService.updateTripPhoto(actor.id, photoId, input);
    revalidatePath("/profile");
    revalidatePath("/profile-management");
    return updated;
  });
}

export async function deleteTripPhotoAction(photoId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const res = await userService.deleteTripPhoto(actor.id, photoId);
    revalidatePath("/profile");
    revalidatePath("/profile-management");
    return res;
  });
}
