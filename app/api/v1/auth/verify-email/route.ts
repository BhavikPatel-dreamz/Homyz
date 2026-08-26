import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/verify-email — consume an email-verification token.
export const POST = apiHandler(async (req) => {
  const { token } = verifyEmailSchema.parse(await req.json());
  const result = await authService.verifyEmail(token);
  return ok(result);
});
