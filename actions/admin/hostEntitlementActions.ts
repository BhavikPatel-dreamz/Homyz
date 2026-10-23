"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import {
  hostEntitlementService,
  type HostEntitlementSummary,
} from "@/services/host-entitlement.service";
import type { ActionResult } from "@/lib/actions/result";

async function assertAdminAccess() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin privileges required");
  }
  if (
    !hasPermission(user, PERMISSIONS.HOSTS_MANAGE_PERMISSIONS) &&
    !hasPermission(user, PERMISSIONS.HOSTS_EDIT) &&
    !hasPermission(user, PERMISSIONS.USERS_EDIT) &&
    user.adminRoleSlug !== "super_admin"
  ) {
    throw new Error("Forbidden: Missing permissions to manage host Dashboard Plus entitlements");
  }
  return user;
}

export async function getHostEntitlementSummaryAction(
  hostId: string,
): Promise<ActionResult<HostEntitlementSummary>> {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      throw new Error("Unauthorized: Admin privileges required");
    }
    if (
      !hasPermission(user, PERMISSIONS.HOSTS_VIEW) &&
      !hasPermission(user, PERMISSIONS.HOSTS_MANAGE_PERMISSIONS) &&
      user.adminRoleSlug !== "super_admin"
    ) {
      throw new Error("Forbidden: Missing permission to view host entitlements");
    }

    const summary = await hostEntitlementService.getHostEntitlementSummary(hostId);
    return { ok: true, data: summary };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to load host entitlement summary" };
  }
}

export async function grantComplimentaryPlusAction(input: {
  hostId: string;
  startsAt?: string;
  expiresAt?: string | null;
  reason?: string;
  notes?: string;
}): Promise<ActionResult<HostEntitlementSummary>> {
  try {
    const admin = await assertAdminAccess();

    const startsAt = input.startsAt ? new Date(input.startsAt) : undefined;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("Invalid expiration date format");
    }

    const summary = await hostEntitlementService.grantComplimentaryPlus({
      hostId: input.hostId,
      adminId: admin.id,
      adminEmail: admin.email,
      startsAt,
      expiresAt,
      reason: input.reason,
      notes: input.notes,
    });

    revalidatePath(`/admin/hosts`);
    revalidatePath(`/admin/hosts/${input.hostId}`);

    return { ok: true, data: summary };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to grant complimentary Dashboard Plus" };
  }
}

export async function revokeComplimentaryPlusAction(input: {
  hostId: string;
  reason?: string;
}): Promise<ActionResult<HostEntitlementSummary>> {
  try {
    const admin = await assertAdminAccess();

    const summary = await hostEntitlementService.revokeComplimentaryPlus({
      hostId: input.hostId,
      adminId: admin.id,
      adminEmail: admin.email,
      reason: input.reason,
    });

    revalidatePath(`/admin/hosts`);
    revalidatePath(`/admin/hosts/${input.hostId}`);

    return { ok: true, data: summary };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to revoke complimentary Dashboard Plus" };
  }
}

export async function setStandardOnlyAction(input: {
  hostId: string;
  reason?: string;
}): Promise<ActionResult<HostEntitlementSummary>> {
  try {
    const admin = await assertAdminAccess();

    const summary = await hostEntitlementService.setStandardOnly({
      hostId: input.hostId,
      adminId: admin.id,
      adminEmail: admin.email,
      reason: input.reason,
    });

    revalidatePath(`/admin/hosts`);
    revalidatePath(`/admin/hosts/${input.hostId}`);

    return { ok: true, data: summary };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to set host to Standard Only" };
  }
}

export async function updateGrantExpirationAction(input: {
  hostId: string;
  expiresAt: string | null;
  reason?: string;
  notes?: string;
}): Promise<ActionResult<HostEntitlementSummary>> {
  try {
    const admin = await assertAdminAccess();

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new Error("Invalid expiration date format");
    }

    const summary = await hostEntitlementService.updateGrantExpiration({
      hostId: input.hostId,
      adminId: admin.id,
      adminEmail: admin.email,
      expiresAt,
      reason: input.reason,
      notes: input.notes,
    });

    revalidatePath(`/admin/hosts`);
    revalidatePath(`/admin/hosts/${input.hostId}`);

    return { ok: true, data: summary };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update grant expiration" };
  }
}

