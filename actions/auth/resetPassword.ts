"use server";

import { runAction } from "@/lib/actions/result";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

export async function resetPasswordAction(input: unknown) {
  return runAction(async () => {
    const { token, password } = resetPasswordSchema.parse(input);
    return authService.resetPassword(token, password);
  });
}
