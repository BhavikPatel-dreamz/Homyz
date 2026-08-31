import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { acceptInvitationSchema } from "@/lib/validation/admin";
import { invitationService } from "@/services/invitation.service";

// POST /api/v1/auth/invitations/accept — accept invitation and set password
export const POST = apiHandler(async (req) => {
  const body = await req.json();
  const input = acceptInvitationSchema.parse(body);

  const result = await invitationService.acceptInvitation(input);
  return ok(result);
});
