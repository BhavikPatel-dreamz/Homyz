import { prisma } from "@/lib/db/prisma";
import type { ThreeStateOverride } from "@/lib/permissions/host-permissions";

type ManagedHost = {
  id: string;
  name: string | null;
  email: string | null;
};

async function getManagedHost(hostId: string): Promise<ManagedHost | null> {
  return prisma.user.findUnique({
    where: { id: hostId },
    select: { id: true, name: true, email: true },
  });
}

async function getPermissionContext(hostId: string) {
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
  if (!host) return null;

  const overrides = prisma.hostPermissionOverride
    ? await prisma.hostPermissionOverride.findMany({ where: { hostId } })
    : [];
  return { host, overrides };
}

function getOverridesDelegate() {
  if (!prisma.hostPermissionOverride) {
    throw new Error("Database client not ready for host permission overrides");
  }
  return prisma.hostPermissionOverride;
}

async function updateOverride(input: {
  hostId: string;
  permission: string;
  effect: ThreeStateOverride;
  reason?: string;
  createdById: string;
}) {
  const host = await getManagedHost(input.hostId);
  if (!host) throw new Error("Host user not found");

  const overrides = getOverridesDelegate();
  const existing = await overrides.findUnique({
    where: {
      hostId_permission: {
        hostId: input.hostId,
        permission: input.permission,
      },
    },
  });
  const previousEffect = existing?.effect ?? "INHERITED";

  if (input.effect === "INHERITED") {
    if (existing) await overrides.delete({ where: { id: existing.id } });
  } else {
    await overrides.upsert({
      where: {
        hostId_permission: {
          hostId: input.hostId,
          permission: input.permission,
        },
      },
      create: {
        hostId: input.hostId,
        permission: input.permission,
        effect: input.effect,
        reason: input.reason?.trim() || null,
        createdById: input.createdById,
      },
      update: {
        effect: input.effect,
        reason: input.reason?.trim() || null,
        createdById: input.createdById,
      },
    });
  }

  return { host, previousEffect };
}

async function bulkUpdateOverrides(input: {
  hostId: string;
  permissions: string[];
  effect: ThreeStateOverride;
  reason?: string;
  createdById: string;
}) {
  const host = await getManagedHost(input.hostId);
  if (!host) throw new Error("Host user not found");
  const overrides = getOverridesDelegate();

  if (input.effect === "INHERITED") {
    await overrides.deleteMany({
      where: { hostId: input.hostId, permission: { in: input.permissions } },
    });
  } else {
    for (const permission of input.permissions) {
      await overrides.upsert({
        where: { hostId_permission: { hostId: input.hostId, permission } },
        create: {
          hostId: input.hostId,
          permission,
          effect: input.effect,
          reason: input.reason?.trim() || null,
          createdById: input.createdById,
        },
        update: {
          effect: input.effect,
          reason: input.reason?.trim() || null,
          createdById: input.createdById,
        },
      });
    }
  }

  return { host };
}

async function resetOverrides(hostId: string) {
  const host = await getManagedHost(hostId);
  if (!host) throw new Error("Host user not found");
  const deleted = await getOverridesDelegate().deleteMany({ where: { hostId } });
  return { host, removedCount: deleted.count };
}

export const hostPermissionService = {
  getPermissionContext,
  updateOverride,
  bulkUpdateOverrides,
  resetOverrides,
};
