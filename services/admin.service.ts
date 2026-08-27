import { randomInt } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { deleteCache, getOrSetCache } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import { Role, UserStatus } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { sendAdminInvitationEmail } from "@/lib/services/email";
import { auditService } from "./audit.service";
import { sessionService } from "./session.service";
import { ALL_PERMISSIONS } from "@/lib/permissions/permissions";
import type { AuthUser } from "@/lib/auth/types";
import type {
  CreateAdminInput,
  CreateRoleInput,
  EditRoleInput,
  UpdateAdminInput,
} from "@/lib/validation/admin";
import { toPublicUser, type PublicUser } from "./mappers";

const STATS_TTL = 60;

// ── Users & Admins Management ──────────────────────────────────────────────

async function listUsers(opts: {
  skip: number;
  take: number;
  role?: Role;
  search?: string;
  status?: UserStatus;
}): Promise<{ items: PublicUser[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (opts.role) where.role = opts.role;
  if (opts.status) where.status = opts.status;
  if (opts.search) {
    const q = opts.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
      include: { adminRole: { select: { name: true, slug: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map(toPublicUser), total };
}

async function listAdmins(opts: {
  skip: number;
  take: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
}): Promise<{ items: PublicUser[]; total: number }> {
  const where: Record<string, unknown> = {
    OR: [
      { role: Role.ADMIN },
      { adminRoleId: { not: null } },
    ],
  };

  if (opts.status) where.status = opts.status;
  if (opts.search) {
    const q = opts.search.trim();
    where.AND = [
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
      include: { adminRole: { select: { name: true, slug: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map(toPublicUser), total };
}

async function getAdminById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { adminRole: { select: { name: true, slug: true } } },
  });
  if (!user) throw AppError.notFound("User not found");
  return toPublicUser(user);
}

function generateRandomAdminPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + nums + symbols;

  let pwd = "";
  pwd += upper[randomInt(0, upper.length)];
  pwd += lower[randomInt(0, lower.length)];
  pwd += nums[randomInt(0, nums.length)];
  pwd += symbols[randomInt(0, symbols.length)];

  for (let i = pwd.length; i < length; i++) {
    pwd += all[randomInt(0, all.length)];
  }

  return pwd.split("").sort(() => 0.5 - Math.random()).join("");
}

async function createAdmin(
  actor: AuthUser,
  input: CreateAdminInput,
): Promise<PublicUser> {
  const emailAddr = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: emailAddr } });
  if (existing) throw AppError.conflict("User with this email already exists");

  let adminRoleId: string | null = null;
  if (input.adminRoleSlug) {
    const roleRecord = await prisma.adminRole.findUnique({
      where: { slug: input.adminRoleSlug },
    });
    if (roleRecord) adminRoleId = roleRecord.id;
  }

  // Automatically generate secure password if not provided by creator
  const rawPassword = input.password?.trim() || generateRandomAdminPassword(12);
  const passwordHash = await hashPassword(rawPassword);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: emailAddr,
      passwordHash,
      role: input.role as Role,
      adminRoleId,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
    include: { adminRole: { select: { name: true, slug: true } } },
  });

  const roleDisplay =
    user.adminRole?.name || (user.role === Role.ADMIN ? "Administrator" : "Staff");

  // Send invitation email with credentials to newly created admin
  try {
    await sendAdminInvitationEmail(
      user.email ?? emailAddr,
      user.name,
      rawPassword,
      roleDisplay,
    );
  } catch (emailErr) {
    console.error(
      "[admin:invite-email] Failed to deliver credentials email:",
      emailErr,
    );
  }

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_CREATED",
    resourceType: "User",
    resourceId: user.id,
    description: `Created new admin ${user.email} with role ${roleDisplay}. Credentials dispatched to user email.`,
  });

  await deleteCache(keys.statsGlobal());

  return toPublicUser(user);
}

async function updateAdmin(
  actor: AuthUser,
  targetUserId: string,
  input: UpdateAdminInput,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { adminRole: true },
  });
  if (!user) throw AppError.notFound("User not found");

  // Prevent demoting last remaining Super Admin
  if (user.adminRole?.slug === "super_admin" && input.adminRoleSlug && input.adminRoleSlug !== "super_admin") {
    const superCount = await prisma.user.count({
      where: { adminRole: { slug: "super_admin" }, status: UserStatus.ACTIVE },
    });
    if (superCount <= 1) {
      throw AppError.conflict("Cannot demote the last remaining Super Admin");
    }
  }

  let adminRoleId: string | null | undefined = undefined;
  if (input.adminRoleSlug !== undefined) {
    if (input.adminRoleSlug === null || input.adminRoleSlug === "") {
      adminRoleId = null;
    } else {
      const roleRecord = await prisma.adminRole.findUnique({
        where: { slug: input.adminRoleSlug },
      });
      if (roleRecord) adminRoleId = roleRecord.id;
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.role ? { role: input.role as Role } : {}),
      ...(input.status ? { status: input.status as UserStatus } : {}),
      ...(adminRoleId !== undefined ? { adminRoleId } : {}),
    },
    include: { adminRole: { select: { name: true, slug: true } } },
  });

  await deleteCache(keys.userProfile(targetUserId));

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_UPDATED",
    resourceType: "User",
    resourceId: targetUserId,
    description: `Updated administrator ${updated.email} details/role/status`,
  });

  return toPublicUser(updated);
}

async function toggleUserStatus(
  actor: AuthUser,
  targetUserId: string,
  status: UserStatus,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { adminRole: true },
  });
  if (!user) throw AppError.notFound("User not found");

  if (targetUserId === actor.id && status === UserStatus.SUSPENDED) {
    throw AppError.badRequest("You cannot suspend your own account");
  }

  if (user.adminRole?.slug === "super_admin" && status === UserStatus.SUSPENDED) {
    const superCount = await prisma.user.count({
      where: { adminRole: { slug: "super_admin" }, status: UserStatus.ACTIVE },
    });
    if (superCount <= 1) {
      throw AppError.conflict("Cannot suspend the last active Super Admin");
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    include: { adminRole: { select: { name: true, slug: true } } },
  });

  // If user is suspended, invalidate all active sessions immediately
  if (status === UserStatus.SUSPENDED) {
    await sessionService.revokeAllForUser(targetUserId, undefined, actor.id, actor.email ?? undefined);
  }

  await deleteCache(keys.userProfile(targetUserId));

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: status === UserStatus.ACTIVE ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    resourceType: "User",
    resourceId: targetUserId,
    description: `${status === UserStatus.ACTIVE ? "Activated" : "Suspended"} user ${updated.email}`,
  });

  return toPublicUser(updated);
}

async function deleteAdmin(
  actor: AuthUser,
  targetUserId: string,
): Promise<{ success: boolean; id: string }> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { adminRole: true },
  });
  if (!user) throw AppError.notFound("Administrator not found");

  // Prevent deleting oneself
  if (targetUserId === actor.id) {
    throw AppError.badRequest("You cannot delete your own administrator account");
  }

  // Prevent deleting last remaining Super Admin
  if (user.adminRole?.slug === "super_admin") {
    const superCount = await prisma.user.count({
      where: { adminRole: { slug: "super_admin" }, status: UserStatus.ACTIVE },
    });
    if (superCount <= 1) {
      throw AppError.conflict("Cannot delete the last active Super Admin");
    }
  }

  // Revoke all sessions first
  await sessionService.revokeAllForUser(
    targetUserId,
    undefined,
    actor.id,
    actor.email ?? undefined,
  );

  // Delete user record (cascades sessions, accounts, refresh tokens, password reset tokens)
  await prisma.user.delete({
    where: { id: targetUserId },
  });

  await Promise.all([
    deleteCache(keys.userProfile(targetUserId)),
    deleteCache(keys.statsGlobal()),
  ]);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_DELETED",
    resourceType: "User",
    resourceId: targetUserId,
    description: `Permanently deleted administrator ${user.email} (${user.adminRole?.name ?? user.role})`,
  });

  return { success: true, id: targetUserId };
}

async function resetAdminPassword(
  actor: AuthUser,
  targetUserId: string,
  newPassword: string,
): Promise<{ success: true }> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw AppError.notFound("User not found");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: targetUserId },
    data: { passwordHash },
  });

  // Revoke all sessions so the user must log in with new password
  await sessionService.revokeAllForUser(targetUserId, undefined, actor.id, actor.email ?? undefined);

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_PASSWORD_RESET",
    resourceType: "User",
    resourceId: targetUserId,
    description: `Reset password for user ${user.email}`,
  });

  return { success: true };
}

async function setUserRole(
  targetUserId: string,
  role: Role,
  actor?: AuthUser,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw AppError.notFound("User not found");

  if (user.role === Role.ADMIN && role !== Role.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount <= 1) {
      throw AppError.conflict("Cannot demote the last remaining admin");
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    include: { adminRole: { select: { name: true, slug: true } } },
  });

  await deleteCache(keys.userProfile(targetUserId));

  if (actor) {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ROLE_CHANGED",
      resourceType: "User",
      resourceId: targetUserId,
      description: `Changed role of user ${updated.email} to ${role}`,
    });
  }

  return toPublicUser(updated);
}

// ── Roles & Permissions Management ─────────────────────────────────────────

async function listRoles() {
  const roles = await prisma.adminRole.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { users: true, permissions: true } },
      permissions: {
        include: { permission: true },
      },
    },
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.users,
    permissionCount: r._count.permissions,
    permissions: r.permissions.map((p) => p.permission.slug),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

async function getRoleById(id: string) {
  const role = await prisma.adminRole.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
      permissions: {
        include: { permission: true },
      },
    },
  });
  if (!role) throw AppError.notFound("Role not found");

  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissions: role.permissions.map((p) => p.permission.slug),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

async function createRole(actor: AuthUser, input: CreateRoleInput) {
  const existing = await prisma.adminRole.findFirst({
    where: {
      OR: [{ name: input.name }, { slug: input.slug }],
    },
  });
  if (existing) throw AppError.conflict("A role with this name or slug already exists");

  // Get matching permission records
  const permissions = await prisma.adminPermission.findMany({
    where: { slug: { in: input.permissions } },
  });

  const newRole = await prisma.adminRole.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      isSystem: false,
      permissions: {
        create: permissions.map((p) => ({
          permissionId: p.id,
        })),
      },
    },
    include: {
      permissions: { include: { permission: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ROLE_CREATED",
    resourceType: "AdminRole",
    resourceId: newRole.id,
    description: `Created administrative role ${newRole.name} with ${permissions.length} permissions`,
  });

  return {
    id: newRole.id,
    name: newRole.name,
    slug: newRole.slug,
    description: newRole.description,
    isSystem: newRole.isSystem,
    permissions: newRole.permissions.map((p) => p.permission.slug),
  };
}

async function updateRole(actor: AuthUser, id: string, input: EditRoleInput) {
  const role = await prisma.adminRole.findUnique({ where: { id } });
  if (!role) throw AppError.notFound("Role not found");

  // Protect Super Admin from losing all permissions or critical name alteration
  if (role.slug === "super_admin" && input.permissions && input.permissions.length < 5) {
    throw AppError.badRequest("Cannot remove core permissions from Super Admin role");
  }

  await prisma.$transaction(async (tx) => {
    if (input.name || input.description !== undefined) {
      await tx.adminRole.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
    }

    if (input.permissions) {
      // Re-assign permissions
      await tx.adminRolePermission.deleteMany({ where: { roleId: id } });
      const perms = await tx.adminPermission.findMany({
        where: { slug: { in: input.permissions } },
      });
      if (perms.length > 0) {
        await tx.adminRolePermission.createMany({
          data: perms.map((p) => ({
            roleId: id,
            permissionId: p.id,
          })),
        });
      }
    }
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ROLE_UPDATED",
    resourceType: "AdminRole",
    resourceId: id,
    description: `Updated role ${role.name} (${role.slug}) permissions/details`,
  });

  return getRoleById(id);
}

async function deleteRole(actor: AuthUser, id: string) {
  const role = await prisma.adminRole.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw AppError.notFound("Role not found");

  if (role.isSystem || role.slug === "super_admin" || role.slug === "admin") {
    throw AppError.badRequest("System roles cannot be deleted");
  }

  if (role._count.users > 0) {
    throw AppError.conflict(
      `Cannot delete role '${role.name}' because ${role._count.users} user(s) are currently assigned to it. Reassign them first.`,
    );
  }

  await prisma.adminRole.delete({ where: { id } });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ROLE_DELETED",
    resourceType: "AdminRole",
    resourceId: id,
    description: `Deleted role ${role.name}`,
  });

  return { success: true };
}

function listPermissions() {
  return ALL_PERMISSIONS;
}

// ── Platform Stats ─────────────────────────────────────────────────────────

async function stats(): Promise<{
  users: number;
  hosts: number;
  admins: number;
  listings: number;
  bookings: number;
  activeSessions: number;
}> {
  return getOrSetCache(
    keys.statsGlobal(),
    async () => {
      const [users, hosts, admins, listings, bookings, activeSessions] =
        await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { role: Role.HOST } }),
          prisma.user.count({ where: { role: Role.ADMIN } }),
          prisma.listing.count(),
          prisma.booking.count(),
          prisma.session.count({ where: { isRevoked: false, expires: { gt: new Date() } } }),
        ]);
      return { users, hosts, admins, listings, bookings, activeSessions };
    },
    { ttl: STATS_TTL },
  );
}

export const adminService = {
  listUsers,
  listAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  toggleUserStatus,
  resetAdminPassword,
  setUserRole,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  stats,
};
