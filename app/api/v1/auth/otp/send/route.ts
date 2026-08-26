import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { sendOtpSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/otp/send — issue a one-time code via SMS or email.
export const POST = apiHandler(async (req) => {
  const body = sendOtpSchema.parse(await req.json());
  const result = await authService.sendOtp(body);
  return ok(result);
});
