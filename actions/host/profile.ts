"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { updateHostPublicProfileSchema } from "@/lib/validation/host-profile";
import { userService } from "@/services/user.service";

export async function updateHostPublicProfileAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const profile = await userService.updateHostPublicProfile(
      actor.id,
      updateHostPublicProfileSchema.parse(input),
    );
    revalidatePath("/host/listings", "layout");
    revalidatePath("/listings", "layout");
    return profile;
  });
}
