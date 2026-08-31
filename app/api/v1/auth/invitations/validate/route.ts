import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { invitationService } from "@/services/invitation.service";

// GET /api/v1/auth/invitations/validate?token=... — validate invitation token
export const GET = apiHandler(async (req) => {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const invitation = await invitationService.validateToken(token);
  return ok(invitation);
});
