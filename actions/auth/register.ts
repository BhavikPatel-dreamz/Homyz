"use server";

import { runAction } from "@/lib/actions/result";
import { registerSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// Public signup. Creates a USER or HOST (never ADMIN) and sends a verification
// email. The client then signs in via NextAuth `signIn("credentials", …)`.
export async function registerAction(input: unknown) {
  return runAction(async () => {
    const data = registerSchema.parse(input);
    return authService.register(data);
  });
}
