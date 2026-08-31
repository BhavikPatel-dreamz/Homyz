"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { getSessionUser } from "@/lib/auth/session";
import { assertRole } from "@/lib/permissions/authorize";
import { assertPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import {
  createAdminSchema,
  createRoleSchema,
  editRoleSchema,
  updateAdminSchema,
  adminResetPasswordSchema,
} from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";
import { sessionService } from "@/services/session.service";
import { Role, UserStatus } from "@/generated/prisma/enums";

export async function createAdminAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_CREATE);

    const data = createAdminSchema.parse(input);
    const newAdmin = await adminService.createAdmin(actor, data);

    revalidatePath("/admin");
    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return newAdmin;
  });
}

export async function updateAdminAction(userId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_EDIT);

    const data = updateAdminSchema.parse(input);
    const updated = await adminService.updateAdmin(actor, userId, data);

    revalidatePath("/admin");
    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return updated;
  });
}

export async function toggleUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.USERS_EDIT);

    const updated = await adminService.toggleUserStatus(
      actor,
      userId,
      status === "ACTIVE" ? UserStatus.ACTIVE : UserStatus.SUSPENDED,
    );

    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return updated;
  });
}

export async function resetAdminPasswordAction(userId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_EDIT);

    const { newPassword } = adminResetPasswordSchema.parse(input);
    const res = await adminService.resetAdminPassword(actor, userId, newPassword);

    revalidatePath("/admin/admins");
    return res;
  });
}

export async function revokeUserSessionsAction(userId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.SESSIONS_REVOKE);

    await sessionService.revokeAllForUser(userId, undefined, actor.id, actor.email ?? undefined);

    revalidatePath("/admin/sessions");
    revalidatePath("/admin/admins");
    return { success: true };
  });
}

export async function deleteAdminAction(userId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_DELETE);

    const res = await adminService.deleteAdmin(actor, userId);

    revalidatePath("/admin");
    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return res;
  });
}

export async function createRoleAction(input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ROLES_CREATE);

    const data = createRoleSchema.parse(input);
    const role = await adminService.createRole(actor, data);

    revalidatePath("/admin/roles");
    return role;
  });
}

export async function updateRoleAction(roleId: string, input: unknown) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ROLES_EDIT);

    const data = editRoleSchema.parse(input);
    const role = await adminService.updateRole(actor, roleId, data);

    revalidatePath("/admin/roles");
    return role;
  });
}

export async function deleteRoleAction(roleId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ROLES_DELETE);

    const res = await adminService.deleteRole(actor, roleId);

    revalidatePath("/admin/roles");
    return res;
  });
}

export async function getAdminPermissionResolutionAction(adminId: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_VIEW);

    const { getAdminPermissionResolution } = await import("@/lib/permissions/admin-permission-service");
    return getAdminPermissionResolution(adminId);
  });
}

export async function updateAdminPermissionsAction(
  adminId: string,
  updates: { permission: string; effect: "INHERIT" | "ALLOW" | "DENY" }[],
  reason?: string
) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_MANAGE_PERMISSIONS);

    const { updateAdminPermissionOverrides } = await import("@/lib/permissions/admin-permission-service");
    const result = await updateAdminPermissionOverrides(actor, adminId, updates, reason);

    revalidatePath(`/admin/admins/${adminId}/permissions`);
    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return result;
  });
}

export async function resetAdminPermissionsAction(adminId: string, reason?: string) {
  return runAction(async () => {
    const actor = await getSessionUser();
    assertRole(actor, [Role.ADMIN]);
    assertPermission(actor, PERMISSIONS.ADMINS_MANAGE_PERMISSIONS);

    const { resetAdminPermissionOverrides } = await import("@/lib/permissions/admin-permission-service");
    const result = await resetAdminPermissionOverrides(actor, adminId, reason);

    revalidatePath(`/admin/admins/${adminId}/permissions`);
    revalidatePath("/admin/admins");
    revalidatePath("/admin/users");
    return result;
  });
}
