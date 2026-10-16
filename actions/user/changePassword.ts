"use server";

import { runAction } from "@/lib/actions/result";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation/user";
import { userService } from "@/services/user.service";

export async function changePasswordAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    if (!actor) throw AppError.unauthorized();
    const data = changePasswordSchema.parse(input);
    return userService.changePassword(actor.id, data);
  });
}
