import { apiHandler } from "@/lib/api/handler";
import { created } from "@/lib/api/response";
import { registerSchema } from "@/lib/validation/auth";
import { authService } from "@/services/auth.service";

// POST /api/v1/auth/register — create a USER or HOST account (never ADMIN).
export const POST = apiHandler(async (req) => {
  const body = registerSchema.parse(await req.json());
  const user = await authService.register(body);
  return created(user);
});
