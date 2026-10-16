"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { completeRegistrationProfileSchema } from "@/lib/validation/user";
import { userService } from "@/services/user.service";

export async function completeRegistrationProfileAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();

    const data = completeRegistrationProfileSchema.parse(input);
    const user = await userService.completeRegistrationProfile(actor.id, data);
    revalidatePath("/", "layout");
    return user;
  });
}
