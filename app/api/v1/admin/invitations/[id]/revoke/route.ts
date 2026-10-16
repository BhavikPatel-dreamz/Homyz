import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { invitationService } from "@/services/invitation.service";

// POST /api/v1/admin/invitations/[id]/revoke — revoke pending invitation
export const POST = apiHandler(async (req, { params }) => {
  const actor = await requireApiPermission(req, PERMISSIONS.ADMINS_EDIT);
  const { id } = await params;

  const result = await invitationService.revokeInvitation(actor, id);
  return ok(result);
});
