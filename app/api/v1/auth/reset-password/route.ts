import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/reset-password — consume a reset token and set a new password.
export const POST = apiHandler(async (req) => {
  const { token, password } = resetPasswordSchema.parse(await req.json());
  const result = await authService.resetPassword(token, password);
  return ok(result);
});
