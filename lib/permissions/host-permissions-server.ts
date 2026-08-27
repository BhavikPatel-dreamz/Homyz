import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { UserStatus } from "@/generated/prisma/enums";
import {
  ALL_HOST_PERMISSIONS,
  type EffectiveState,
  type HostPermissionsResolution,
  type ResolvedHostPermission,
  type ThreeStateOverride,
} from "./host-permissions";

/**
 * Resolves effective permissions for a specific host by combining
 * default host permissions with individual host permission overrides.
 */
export async function getEffectiveHostPermissions(
  hostId: string,
): Promise<HostPermissionsResolution> {
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!host) {
    throw AppError.notFound(`Host account not found: ${hostId}`);
  }

  // Fetch overrides from database
  const overrides = prisma.hostPermissionOverride
    ? await prisma.hostPermissionOverride.findMany({
        where: { hostId },
      })
    : [];

  const overrideMap = new Map<string, "ALLOW" | "DENY">();
  for (const o of overrides) {
    if (o.effect === "ALLOW" || o.effect === "DENY") {
      overrideMap.set(o.permission, o.effect);
    }
  }

  let inheritedCount = 0;
  let allowedOverridesCount = 0;
  let deniedOverridesCount = 0;
  let effectiveAllowedCount = 0;
  let effectiveDeniedCount = 0;

  const resolvedPermissions: ResolvedHostPermission[] = ALL_HOST_PERMISSIONS.map(
    (def) => {
      const dbOverride = overrideMap.get(def.slug);
      let overrideEffect: ThreeStateOverride = "INHERITED";
      let effectiveEffect: EffectiveState = def.defaultEffect;
      let source: "INHERITED" | "EXPLICIT_ALLOW" | "EXPLICIT_DENY" = "INHERITED";
      let sourceLabel = "Inherited from Host Role";

      if (dbOverride === "ALLOW") {
        overrideEffect = "ALLOW";
        effectiveEffect = "ALLOW";
        source = "EXPLICIT_ALLOW";
        sourceLabel = "Explicitly Allowed by Admin";
        allowedOverridesCount++;
      } else if (dbOverride === "DENY") {
        overrideEffect = "DENY";
        effectiveEffect = "DENY";
        source = "EXPLICIT_DENY";
        sourceLabel = "Denied by Admin";
        deniedOverridesCount++;
      } else {
        inheritedCount++;
      }

      // Account Status Guard: If host is suspended, effective effect is DENY
      if (host.status !== UserStatus.ACTIVE) {
        effectiveEffect = "DENY";
      }

      if (effectiveEffect === "ALLOW") {
        effectiveAllowedCount++;
      } else {
        effectiveDeniedCount++;
      }

      return {
        slug: def.slug,
        category: def.category,
        label: def.label,
        description: def.description,
        defaultEffect: def.defaultEffect,
        overrideEffect,
        effectiveEffect,
        source,
        sourceLabel,
      };
    },
  );

  return {
    hostId: host.id,
    hostName: host.name,
    hostEmail: host.email,
    hostStatus: host.status,
    isHostActive: host.status === UserStatus.ACTIVE,
    permissions: resolvedPermissions,
    summary: {
      totalCount: ALL_HOST_PERMISSIONS.length,
      inheritedCount,
      allowedOverridesCount,
      deniedOverridesCount,
      effectiveAllowedCount,
      effectiveDeniedCount,
    },
  };
}

/**
 * Backend authorization check for host operations.
 * Resolves host status & effective host permissions.
 */
export async function checkHostPermission(
  hostId: string,
  permissionSlug: string,
): Promise<boolean> {
  const resolution = await getEffectiveHostPermissions(hostId);

  // Guard 1: Suspended account
  if (!resolution.isHostActive) {
    return false;
  }

  // Guard 2: Effective permission check
  const perm = resolution.permissions.find((p) => p.slug === permissionSlug);
  if (!perm) return false;

  return perm.effectiveEffect === "ALLOW";
}

/**
 * Backend authorization assertion for host operations. Throws AppError.forbidden if denied.
 */
export async function assertHostPermission(
  hostId: string,
  permissionSlug: string,
): Promise<void> {
  const resolution = await getEffectiveHostPermissions(hostId);

  if (!resolution.isHostActive) {
    throw AppError.forbidden(
      "Host account is suspended. Restricted actions are blocked.",
    );
  }

  const perm = resolution.permissions.find((p) => p.slug === permissionSlug);
  if (!perm || perm.effectiveEffect !== "ALLOW") {
    throw AppError.forbidden(
      `Host does not have required permission: ${permissionSlug}`,
    );
  }
}
