import { ALL_PERMISSIONS, isSuperAdmin } from "@/lib/permissions/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";
import { adminPermissionService } from "@/services/admin-permission.service";

export type ThreeStateOverride = "INHERIT" | "ALLOW" | "DENY";

export interface EffectiveAdminPermission {
  slug: string;
  module: string;
  action: string;
  description: string;
  roleDefault: boolean;
  overrideEffect: ThreeStateOverride;
  effectiveAllowed: boolean;
  status: "Inherited" | "Allowed" | "Denied";
  source: "Super Admin" | "Individual Admin Override" | "Admin Role";
  isOverridden: boolean;
}

export interface AdminPermissionSummary {
  totalPermissions: number;
  allowed: number;
  denied: number;
  inherited: number;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminStatus: string;
  roleName: string;
  roleSlug: string;
  isSuperAdmin: boolean;
}

export interface AdminPermissionResolution {
  summary: AdminPermissionSummary;
  permissions: EffectiveAdminPermission[];
}

/** Get resolved permission matrix for a specific Admin user. */
export async function getAdminPermissionResolution(adminId: string): Promise<AdminPermissionResolution> {
  const [adminUser, adminOverrides] = await Promise.all([
    adminPermissionService.getAdminWithPermissionGraph(adminId),
    adminPermissionService.listOverrides(adminId),
  ]);

  if (!adminUser) {
    throw AppError.notFound("Admin user not found");
  }

  const roleSlug = adminUser.adminRole?.slug || "admin";
  const roleName = adminUser.adminRole?.name || "Admin";
  const isSuper = isSuperAdmin({ role: adminUser.role, adminRoleSlug: roleSlug });

  if (isSuper) {
    const permissions: EffectiveAdminPermission[] = ALL_PERMISSIONS.map((p) => ({
      slug: p.slug,
      module: p.module,
      action: p.action,
      description: p.description,
      roleDefault: true,
      overrideEffect: "INHERIT",
      effectiveAllowed: true,
      status: "Allowed",
      source: "Super Admin",
      isOverridden: false,
    }));

    return {
      summary: {
        totalPermissions: ALL_PERMISSIONS.length,
        allowed: ALL_PERMISSIONS.length,
        denied: 0,
        inherited: ALL_PERMISSIONS.length,
        adminId: adminUser.id,
        adminName: adminUser.name || "Unnamed Admin",
        adminEmail: adminUser.email || "N/A",
        adminStatus: adminUser.status || "ACTIVE",
        roleName,
        roleSlug,
        isSuperAdmin: true,
      },
      permissions,
    };
  }

  // Map role permissions
  const rolePermissionSlugs = new Set<string>();
  if (adminUser.adminRole?.permissions) {
    for (const rp of adminUser.adminRole.permissions) {
      if (rp.permission?.slug) {
        rolePermissionSlugs.add(rp.permission.slug);
      }
    }
  }

  // Map individual overrides
  const overrideMap = new Map<string, "ALLOW" | "DENY">();
  for (const override of adminOverrides) {
    if (override.effect === "ALLOW" || override.effect === "DENY") {
      overrideMap.set(override.permission, override.effect);
    }
  }

  let allowedCount = 0;
  let deniedCount = 0;
  let inheritedCount = 0;

  const permissions: EffectiveAdminPermission[] = ALL_PERMISSIONS.map((p) => {
    const roleDefault = rolePermissionSlugs.has(p.slug);
    const hasOverride = overrideMap.has(p.slug);

    if (hasOverride) {
      const effect = overrideMap.get(p.slug)!;
      const effectiveAllowed = effect === "ALLOW";
      if (effectiveAllowed) allowedCount++;
      else deniedCount++;

      return {
        slug: p.slug,
        module: p.module,
        action: p.action,
        description: p.description,
        roleDefault,
        overrideEffect: effect,
        effectiveAllowed,
        status: effectiveAllowed ? "Allowed" : "Denied",
        source: "Individual Admin Override",
        isOverridden: true,
      };
    }

    // Inherited from role
    inheritedCount++;
    const effectiveAllowed = roleDefault;
    if (effectiveAllowed) allowedCount++;
    else deniedCount++;

    return {
      slug: p.slug,
      module: p.module,
      action: p.action,
      description: p.description,
      roleDefault,
      overrideEffect: "INHERIT",
      effectiveAllowed,
      status: "Inherited",
      source: "Admin Role",
      isOverridden: false,
    };
  });

  return {
    summary: {
      totalPermissions: ALL_PERMISSIONS.length,
      allowed: allowedCount,
      denied: deniedCount,
      inherited: inheritedCount,
      adminId: adminUser.id,
      adminName: adminUser.name || "Unnamed Admin",
      adminEmail: adminUser.email || "N/A",
      adminStatus: adminUser.status || "ACTIVE",
      roleName,
      roleSlug,
      isSuperAdmin: false,
    },
    permissions,
  };
}

/** Save individual permission overrides for an Admin user. */
export async function updateAdminPermissionOverrides(
  actor: AuthUser,
  adminId: string,
  updates: { permission: string; effect: ThreeStateOverride }[],
  reason?: string
): Promise<AdminPermissionResolution> {
  const targetAdmin = await adminPermissionService.getAdminWithRole(adminId);

  if (!targetAdmin) {
    throw AppError.notFound("Target admin user not found");
  }

  const isTargetSuper = isSuperAdmin({ role: targetAdmin.role, adminRoleSlug: targetAdmin.adminRole?.slug });
  if (isTargetSuper) {
    throw AppError.forbidden("Super Admin is a system-level role with fixed full access. Permissions cannot be modified.");
  }

  // Prevent self privilege escalation
  if (actor.id === adminId && !isSuperAdmin(actor)) {
    throw AppError.forbidden("Administrators cannot modify their own permission configuration.");
  }

  await adminPermissionService.applyOverrides({ adminId, actorId: actor.id, reason, updates });

  // Audit Log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_PERMISSIONS_UPDATED",
    resourceType: "AdminUser",
    resourceId: adminId,
    description: `Updated ${updates.length} individual permission overrides for ${targetAdmin.email || targetAdmin.name}`,
    metadata: {
      targetAdminEmail: targetAdmin.email,
      updatesCount: updates.length,
      reason: reason || "Administrative update",
    },
  });

  return getAdminPermissionResolution(adminId);
}

/** Reset all individual permission overrides for an Admin user back to role defaults. */
export async function resetAdminPermissionOverrides(
  actor: AuthUser,
  adminId: string,
  reason?: string
): Promise<AdminPermissionResolution> {
  const targetAdmin = await adminPermissionService.getAdminWithRole(adminId);

  if (!targetAdmin) {
    throw AppError.notFound("Target admin user not found");
  }

  const isTargetSuper = isSuperAdmin({ role: targetAdmin.role, adminRoleSlug: targetAdmin.adminRole?.slug });
  if (isTargetSuper) {
    throw AppError.forbidden("Super Admin permissions cannot be modified or reset.");
  }

  if (actor.id === adminId && !isSuperAdmin(actor)) {
    throw AppError.forbidden("Administrators cannot reset their own permission configuration.");
  }

  await adminPermissionService.resetOverrides(adminId);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_PERMISSIONS_RESET",
    resourceType: "AdminUser",
    resourceId: adminId,
    description: `Reset all individual permission overrides for ${targetAdmin.email || targetAdmin.name} to role defaults`,
    metadata: {
      targetAdminEmail: targetAdmin.email,
      reason: reason || "Reset to role defaults",
    },
  });

  return getAdminPermissionResolution(adminId);
}

/** Set ALL permissions to ALLOW for an Admin user. */
export async function setAllAdminPermissions(
  actor: AuthUser,
  adminId: string,
  reason?: string
): Promise<AdminPermissionResolution> {
  const updates = ALL_PERMISSIONS.map((p) => ({
    permission: p.slug,
    effect: "ALLOW" as ThreeStateOverride,
  }));

  const res = await updateAdminPermissionOverrides(actor, adminId, updates, reason || "Granted all permissions");

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "SET_ALL_PERMISSIONS",
    resourceType: "AdminUser",
    resourceId: adminId,
    description: `Granted all ${ALL_PERMISSIONS.length} administrative permissions for ${res.summary.adminEmail}`,
    metadata: {
      targetAdminEmail: res.summary.adminEmail,
      reason: reason || "Set all permissions",
      totalPermissions: ALL_PERMISSIONS.length,
    },
  });

  return res;
}

/** Clear ALL permissions (set DENY overrides for all permissions) for an Admin user. Keeps account intact. */
export async function clearAllAdminPermissions(
  actor: AuthUser,
  adminId: string,
  reason?: string
): Promise<AdminPermissionResolution> {
  const updates = ALL_PERMISSIONS.map((p) => ({
    permission: p.slug,
    effect: "DENY" as ThreeStateOverride,
  }));

  const res = await updateAdminPermissionOverrides(actor, adminId, updates, reason || "Cleared all permissions");

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "CLEAR_ALL_PERMISSIONS",
    resourceType: "AdminUser",
    resourceId: adminId,
    description: `Revoked all administrative permissions for ${res.summary.adminEmail} (account retained)`,
    metadata: {
      targetAdminEmail: res.summary.adminEmail,
      reason: reason || "Clear all permissions",
    },
  });

  return res;
}

/** Activate a Pending Admin user after verifying permissions are configured. */
export async function activatePendingAdmin(actor: AuthUser, adminId: string) {
  const targetAdmin = await adminPermissionService.getAdminWithRole(adminId);

  if (!targetAdmin) {
    throw AppError.notFound("Target admin user not found");
  }

  const currentStatus = targetAdmin.status as string;
  if (currentStatus !== "INVITATION_PENDING" && currentStatus !== "PENDING_SETUP") {
    throw AppError.badRequest(`Admin account status is '${targetAdmin.status}', expected 'INVITATION_PENDING' or 'PENDING_SETUP'`);
  }

  const resolution = await getAdminPermissionResolution(adminId);
  if (!resolution.summary.isSuperAdmin && resolution.summary.allowed === 0) {
    throw AppError.badRequest("Cannot activate admin account before configuring permissions. Please grant at least one permission.");
  }

  const updatedAdmin = await adminPermissionService.activateAdmin(adminId);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_ACTIVATED",
    resourceType: "AdminUser",
    resourceId: adminId,
    description: `Activated pending admin account for ${targetAdmin.email || targetAdmin.name}`,
    metadata: {
      targetAdminEmail: targetAdmin.email,
      configuredPermissionsCount: resolution.summary.allowed,
    },
  });

  return updatedAdmin;
}

/** Calculate array of effective allowed permission slugs for a user. */
export async function getEffectivePermissionsForUser(userId: string, role: string, adminRoleSlug?: string | null): Promise<string[]> {
  if (isSuperAdmin({ role, adminRoleSlug })) {
    return ["*"];
  }

  const resolution = await getAdminPermissionResolution(userId);
  return resolution.permissions.filter((p) => p.effectiveAllowed).map((p) => p.slug);
}
