"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import {
  getTravelProfileByUserId,
  getTravelProfileStats,
  updateTravelProfile,
  toggleProfileLike,
  type UpdateTravelProfileInput,
} from "@/services/travel-profile.service";

export async function getTravelProfilePageDataAction() {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();

    const [profile, stats] = await Promise.all([
      getTravelProfileByUserId(actor.id),
      getTravelProfileStats(actor.id),
    ]);

    return { profile, stats };
  });
}

export async function updateTravelProfileAction(input: UpdateTravelProfileInput) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();

    const updated = await updateTravelProfile(actor.id, input);
    revalidatePath("/travel-profile");
    revalidatePath("/profile");
    return updated;
  });
}

export async function toggleProfileLikeAction(targetUserId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();

    const res = await toggleProfileLike(actor.id, targetUserId);
    revalidatePath("/travel-profile");
    return res;
  });
}
