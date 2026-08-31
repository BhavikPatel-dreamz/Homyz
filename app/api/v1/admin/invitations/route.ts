import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { inviteAdminSchema } from "@/lib/validation/admin";
import { invitationService } from "@/services/invitation.service";

// GET /api/v1/admin/invitations — list admin invitations
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.ADMINS_VIEW);

  const url = req.nextUrl;
  const skip = Number(url.searchParams.get("skip") ?? "0");
  const take = Number(url.searchParams.get("take") ?? "20");
  const search = url.searchParams.get("search") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const role = url.searchParams.get("role") ?? undefined;
  const dateRange = url.searchParams.get("dateRange") ?? undefined;

  const result = await invitationService.listInvitations({
    skip,
    take,
    search,
    status,
    role,
    dateRange,
  });

  return ok(result);
});

// POST /api/v1/admin/invitations — invite a new admin user
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.ADMINS_CREATE);
  const body = await req.json();
  const input = inviteAdminSchema.parse(body);

  const invitation = await invitationService.createInvitation(actor, input);
  return created(invitation);
});
