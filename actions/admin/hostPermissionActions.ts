"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  getEffectiveHostPermissions,
} from "@/lib/permissions/host-permissions-server";
import {
  type ThreeStateOverride,
  type HostPermissionsResolution,
} from "@/lib/permissions/host-permissions";
import { auditService } from "@/services/audit.service";
import type { ActionResult } from "@/lib/actions/result";

async function assertAdminAccess() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin privileges required");
  }
  if (
    !hasPermission(user, PERMISSIONS.USERS_EDIT) &&
    !hasPermission(user, PERMISSIONS.ROLES_EDIT) &&
    user.adminRoleSlug !== "super_admin"
  ) {
    throw new Error("Forbidden: Missing permissions to manage host access rules");
  }
  return user;
}

export async function getHostPermissionsAction(
  hostId: string,
): Promise<ActionResult<HostPermissionsResolution>> {
  try {
    await assertAdminAccess();
    const resolution = await getEffectiveHostPermissions(hostId);
    return { ok: true, data: resolution };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to load host permissions" };
  }
}

export async function updateHostPermissionOverrideAction(
  hostId: string,
  permissionSlug: string,
  effect: ThreeStateOverride,
  reason?: string,
): Promise<ActionResult<HostPermissionsResolution>> {
  try {
    const admin = await assertAdminAccess();

    const host = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, name: true, email: true },
    });
    if (!host) throw new Error("Host user not found");

    if (!prisma.hostPermissionOverride) {
      throw new Error("Database client not ready for host permission overrides");
    }

    const existing = await prisma.hostPermissionOverride.findUnique({
      where: {
        hostId_permission: {
          hostId,
          permission: permissionSlug,
        },
      },
    });

    const previousEffect = existing ? existing.effect : "INHERITED";

    if (effect === "INHERITED") {
      if (existing) {
        await prisma.hostPermissionOverride.delete({
          where: { id: existing.id },
        });
      }
    } else {
      await prisma.hostPermissionOverride.upsert({
        where: {
          hostId_permission: {
            hostId,
            permission: permissionSlug,
          },
        },
        create: {
          hostId,
          permission: permissionSlug,
          effect,
          reason: reason?.trim() || null,
          createdById: admin.id,
        },
        update: {
          effect,
          reason: reason?.trim() || null,
          createdById: admin.id,
        },
      });
    }

    await auditService.record({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "HOST_PERMISSION_CHANGED",
      resourceType: "HOST",
      resourceId: hostId,
      description: `Changed permission '${permissionSlug}' for Host #${hostId} (${host.name || host.email}) from ${previousEffect} to ${effect}`,
      status: "SUCCESS",
      metadata: {
        hostId,
        hostEmail: host.email,
        permission: permissionSlug,
        previousValue: previousEffect,
        newValue: effect,
        reason: reason?.trim() || null,
      },
    });

    revalidatePath(`/admin/hosts/${hostId}`);
    const updated = await getEffectiveHostPermissions(hostId);
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update permission override" };
  }
}

export async function bulkUpdateHostPermissionsAction(
  hostId: string,
  permissionSlugs: string[],
  effect: ThreeStateOverride,
  reason?: string,
): Promise<ActionResult<HostPermissionsResolution>> {
  try {
    const admin = await assertAdminAccess();

    const host = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, name: true, email: true },
    });
    if (!host) throw new Error("Host user not found");

    if (!permissionSlugs || permissionSlugs.length === 0) {
      throw new Error("No permissions selected for bulk update");
    }

    if (effect === "INHERITED") {
      await prisma.hostPermissionOverride.deleteMany({
        where: {
          hostId,
          permission: { in: permissionSlugs },
        },
      });
    } else {
      for (const slug of permissionSlugs) {
        await prisma.hostPermissionOverride.upsert({
          where: {
            hostId_permission: {
              hostId,
              permission: slug,
            },
          },
          create: {
            hostId,
            permission: slug,
            effect,
            reason: reason?.trim() || null,
            createdById: admin.id,
          },
          update: {
            effect,
            reason: reason?.trim() || null,
            createdById: admin.id,
          },
        });
      }
    }

    await auditService.record({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "HOST_BULK_PERMISSIONS_CHANGED",
      resourceType: "HOST",
      resourceId: hostId,
      description: `Bulk updated ${permissionSlugs.length} permissions to '${effect}' for Host #${hostId} (${host.name || host.email})`,
      status: "SUCCESS",
      metadata: {
        hostId,
        hostEmail: host.email,
        updatedPermissions: permissionSlugs,
        newEffect: effect,
        count: permissionSlugs.length,
        reason: reason?.trim() || null,
      },
    });

    revalidatePath(`/admin/hosts/${hostId}`);
    const updated = await getEffectiveHostPermissions(hostId);
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to execute bulk permission update" };
  }
}

export async function resetHostPermissionsAction(
  hostId: string,
  reason?: string,
): Promise<ActionResult<HostPermissionsResolution>> {
  try {
    const admin = await assertAdminAccess();

    const host = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, name: true, email: true },
    });
    if (!host) throw new Error("Host user not found");

    const deleted = await prisma.hostPermissionOverride.deleteMany({
      where: { hostId },
    });

    await auditService.record({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "HOST_PERMISSIONS_RESET",
      resourceType: "HOST",
      resourceId: hostId,
      description: `Reset all custom permission overrides (${deleted.count} removed) for Host #${hostId} (${host.name || host.email}) to default Host permissions`,
      status: "SUCCESS",
      metadata: {
        hostId,
        hostEmail: host.email,
        removedOverridesCount: deleted.count,
        reason: reason?.trim() || null,
      },
    });

    revalidatePath(`/admin/hosts/${hostId}`);
    const updated = await getEffectiveHostPermissions(hostId);
    return { ok: true, data: updated };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to reset host permissions" };
  }
}
