import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { refreshSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/logout — revoke the supplied refresh token (mobile).
export const POST = apiHandler(async (req) => {
  const { refreshToken } = refreshSchema.parse(await req.json());
  const result = await authService.logout(refreshToken);
  return ok(result);
});
