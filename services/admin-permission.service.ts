import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

export type AdminPermissionOverrideEffect = "INHERIT" | "ALLOW" | "DENY";

async function getAdminWithPermissionGraph(adminId: string) {
  return prisma.user.findUnique({
    where: { id: adminId },
    include: {
      adminRole: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });
}

async function getAdminWithRole(adminId: string) {
  return prisma.user.findUnique({
    where: { id: adminId },
    include: { adminRole: true },
  });
}

function getOverridesDelegate() {
  return (prisma as any).adminPermissionOverride;
}

async function listOverrides(adminId: string) {
  const overrides = getOverridesDelegate();
  if (overrides && typeof overrides.findMany === "function") {
    return overrides.findMany({ where: { adminId } });
  }
  return prisma.$queryRaw`
    SELECT id, "adminId", permission, effect, reason, "createdById", "createdAt", "updatedAt"
    FROM "AdminPermissionOverride"
    WHERE "adminId" = ${adminId}
  ` as Promise<Array<{ permission: string; effect: string }>>;
}

async function applyOverrides(input: {
  adminId: string;
  actorId: string;
  reason?: string;
  updates: Array<{ permission: string; effect: AdminPermissionOverrideEffect }>;
}): Promise<void> {
  const overrides = getOverridesDelegate();
  for (const update of input.updates) {
    if (update.effect === "INHERIT") {
      if (overrides && typeof overrides.deleteMany === "function") {
        await overrides.deleteMany({ where: { adminId: input.adminId, permission: update.permission } });
      } else {
        await prisma.$executeRaw`
          DELETE FROM "AdminPermissionOverride"
          WHERE "adminId" = ${input.adminId} AND permission = ${update.permission}
        `;
      }
      continue;
    }

    if (overrides && typeof overrides.upsert === "function") {
      await overrides.upsert({
        where: { adminId_permission: { adminId: input.adminId, permission: update.permission } },
        create: {
          adminId: input.adminId,
          permission: update.permission,
          effect: update.effect,
          reason: input.reason,
          createdById: input.actorId,
        },
        update: { effect: update.effect, reason: input.reason, createdById: input.actorId },
      });
      continue;
    }

    const updated = await prisma.$executeRaw`
      UPDATE "AdminPermissionOverride"
      SET effect = ${update.effect}, reason = ${input.reason}, "createdById" = ${input.actorId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "adminId" = ${input.adminId} AND permission = ${update.permission}
    `;
    if (!updated || Number(updated) === 0) {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "AdminPermissionOverride" (id, "adminId", permission, effect, reason, "createdById", "createdAt", "updatedAt")
        VALUES (${id}, ${input.adminId}, ${update.permission}, ${update.effect}, ${input.reason}, ${input.actorId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("adminId", permission) DO UPDATE
        SET effect = EXCLUDED.effect, reason = EXCLUDED.reason, "createdById" = EXCLUDED."createdById", "updatedAt" = CURRENT_TIMESTAMP
      `;
    }
  }
}

async function resetOverrides(adminId: string): Promise<void> {
  await prisma.adminPermissionOverride.deleteMany({ where: { adminId } });
}

async function activateAdmin(adminId: string) {
  return prisma.user.update({
    where: { id: adminId },
    data: { status: "ACTIVE" },
  });
}

export const adminPermissionService = {
  getAdminWithPermissionGraph,
  getAdminWithRole,
  listOverrides,
  applyOverrides,
  resetOverrides,
  activateAdmin,
};
