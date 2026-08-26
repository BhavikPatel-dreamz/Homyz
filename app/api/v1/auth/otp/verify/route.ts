import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { verifyOtpSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/otp/verify — validate a one-time code.
export const POST = apiHandler(async (req) => {
  const body = verifyOtpSchema.parse(await req.json());
  const result = await authService.verifyOtp(body);
  return ok(result);
});
