"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { assertPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { Role } from "@/generated/prisma/enums";
import {
  inviteAdminSchema,
  acceptInvitationSchema,
} from "@/lib/validation/admin";
import { invitationService } from "@/services/invitation.service";

export async function inviteAdminAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_CREATE);

    const data = inviteAdminSchema.parse(input);
    const result = await invitationService.createInvitation(actor, data);

    revalidatePath("/admin/admins");
    revalidatePath("/admin/admins/invitations");
    return result;
  });
}

export async function resendInvitationAction(invitationId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_CREATE);

    const result = await invitationService.resendInvitation(actor, invitationId);

    revalidatePath("/admin/admins/invitations");
    return result;
  });
}

export async function revokeInvitationAction(invitationId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_EDIT);

    const result = await invitationService.revokeInvitation(actor, invitationId);

    revalidatePath("/admin/admins/invitations");
    return result;
  });
}

export async function listInvitationsAction(options: {
  skip?: number;
  take?: number;
  search?: string;
  status?: string;
  role?: string;
  dateRange?: string;
}) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_VIEW);

    return invitationService.listInvitations({
      skip: options.skip ?? 0,
      take: options.take ?? 20,
      search: options.search,
      status: options.status,
      role: options.role,
      dateRange: options.dateRange,
    });
  });
}

export async function acceptInvitationAction(input: unknown) {
  return runAction(async () => {
    const data = acceptInvitationSchema.parse(input);
    return invitationService.acceptInvitation(data);
  });
}
