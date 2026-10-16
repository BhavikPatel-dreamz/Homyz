import { apiHandler } from "@/lib/api/handler";
import { getRequestMeta } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { mobileLoginSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/login — email/password → access + refresh tokens (mobile).
export const POST = apiHandler(async (req) => {
  const { email, password } = mobileLoginSchema.parse(await req.json());
  const result = await authService.mobileLogin(
    email,
    password,
    getRequestMeta(req),
  );
  return ok(result);
});
