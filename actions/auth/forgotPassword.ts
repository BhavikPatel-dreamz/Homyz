"use server";

import { runAction } from "@/lib/actions/result";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// Always succeeds (no account enumeration).
export async function forgotPasswordAction(input: unknown) {
  return runAction(async () => {
    const { email } = forgotPasswordSchema.parse(input);
    return authService.forgotPassword(email);
  });
}
