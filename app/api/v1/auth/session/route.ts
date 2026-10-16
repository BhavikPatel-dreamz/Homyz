import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { userService } from "@/services/user.service";

// GET /api/v1/auth/session — the current caller's profile (web cookie or
// mobile Bearer). 401 when unauthenticated.
export const GET = apiHandler(async (req) => {
  const auth = await requireApiAuth(req);
  const user = await userService.getById(auth.id);
  return ok(user);
});
