import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/forgot-password — email a reset link if the account exists.
// Always returns success (no account enumeration).
export const POST = apiHandler(async (req) => {
  const { email } = forgotPasswordSchema.parse(await req.json());
  const result = await authService.forgotPassword(email);
  return ok(result);
});
