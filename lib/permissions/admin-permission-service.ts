import { prisma } from "@/lib/db/prisma";
import { ALL_PERMISSIONS, isSuperAdmin } from "@/lib/permissions/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";
import { randomUUID } from "crypto";

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
  const adminUser = await prisma.user.findUnique({
    where: { id: adminId },
    include: {
      adminRole: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  // Load individual admin overrides separately to avoid relying on a specific
  // prisma client relation shape that may be out-of-sync in some dev builds.
  // Try to use the generated client model API; fall back to a raw query
  // if the property is not available on the `prisma` instance (can happen
  // in some dev or build states where the generated client shape isn't present).
  let adminOverrides: any[] = [];
  if ((prisma as any).adminPermissionOverride && typeof (prisma as any).adminPermissionOverride.findMany === "function") {
    adminOverrides = await (prisma as any).adminPermissionOverride.findMany({ where: { adminId } });
  } else {
    adminOverrides = await prisma.$queryRaw`
      SELECT id, "adminId", permission, effect, reason, "createdById", "createdAt", "updatedAt"
      FROM "AdminPermissionOverride"
      WHERE "adminId" = ${adminId}
    ` as any[];
  }

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
  const targetAdmin = await prisma.user.findUnique({
    where: { id: adminId },
    include: { adminRole: true },
  });

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

  // Process updates
  for (const update of updates) {
    if (update.effect === "INHERIT") {
      if ((prisma as any).adminPermissionOverride && typeof (prisma as any).adminPermissionOverride.deleteMany === "function") {
        await (prisma as any).adminPermissionOverride.deleteMany({
          where: { adminId, permission: update.permission },
        });
      } else {
        await prisma.$executeRaw`
          DELETE FROM "AdminPermissionOverride"
          WHERE "adminId" = ${adminId} AND permission = ${update.permission}
        `;
      }
    } else {
      if ((prisma as any).adminPermissionOverride && typeof (prisma as any).adminPermissionOverride.upsert === "function") {
        await (prisma as any).adminPermissionOverride.upsert({
          where: { adminId_permission: { adminId, permission: update.permission } },
          create: {
            adminId,
            permission: update.permission,
            effect: update.effect,
            reason,
            createdById: actor.id,
          },
          update: { effect: update.effect, reason, createdById: actor.id },
        });
      } else {
        // Fallback: attempt an UPDATE, then INSERT if no rows updated.
        const updated = await prisma.$executeRaw`
          UPDATE "AdminPermissionOverride"
          SET effect = ${update.effect}, reason = ${reason}, "createdById" = ${actor.id}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE "adminId" = ${adminId} AND permission = ${update.permission}
        `;
        if (!updated || Number(updated) === 0) {
          const newId = randomUUID();
          await prisma.$executeRaw`
            INSERT INTO "AdminPermissionOverride" (id, "adminId", permission, effect, reason, "createdById", "createdAt", "updatedAt")
            VALUES (${newId}, ${adminId}, ${update.permission}, ${update.effect}, ${reason}, ${actor.id}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("adminId", permission) DO UPDATE
            SET effect = EXCLUDED.effect, reason = EXCLUDED.reason, "createdById" = EXCLUDED."createdById", "updatedAt" = CURRENT_TIMESTAMP
          `;
        }
      }
    }
  }

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
  const targetAdmin = await prisma.user.findUnique({
    where: { id: adminId },
    include: { adminRole: true },
  });

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

  await prisma.adminPermissionOverride.deleteMany({
    where: { adminId },
  });

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
  const targetAdmin = await prisma.user.findUnique({
    where: { id: adminId },
    include: { adminRole: true },
  });

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

  const updatedAdmin = await prisma.user.update({
    where: { id: adminId },
    data: { status: "ACTIVE" },
  });

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
