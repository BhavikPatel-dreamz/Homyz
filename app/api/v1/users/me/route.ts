import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { updateProfileSchema } from "@/lib/validation/user";
import { userService } from "@/services/user.service";

// GET /api/v1/users/me — the current caller's profile.
export const GET = apiHandler(async (req) => {
  const auth = await requireApiAuth(req);
  const user = await userService.getById(auth.id);
  return ok(user);
});

// PATCH /api/v1/users/me — update the caller's own profile.
export const PATCH = apiHandler(async (req) => {
  const auth = await requireApiAuth(req);
  const body = updateProfileSchema.parse(await req.json());
  const user = await userService.updateProfile(auth.id, body);
  return ok(user);
});
