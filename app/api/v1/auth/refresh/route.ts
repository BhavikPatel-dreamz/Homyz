import { apiHandler } from "@/lib/api/handler";
import { getRequestMeta } from "@/lib/api/request";
import { ok } from "@/lib/api/response";
import { refreshSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/refresh — rotate a refresh token for a new token pair.
export const POST = apiHandler(async (req) => {
  const { refreshToken } = refreshSchema.parse(await req.json());
  const tokens = await authService.refresh(refreshToken, getRequestMeta(req));
  return ok(tokens);
});
