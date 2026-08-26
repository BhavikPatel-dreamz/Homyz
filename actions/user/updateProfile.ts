"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { updateProfileSchema } from "@/lib/validation/user";
import { userService } from "@/services/user.service";

export async function updateProfileAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const data = updateProfileSchema.parse(input);
    const updated = await userService.updateProfile(actor.id, data);
    revalidatePath("/profile");
    return updated;
  });
}
