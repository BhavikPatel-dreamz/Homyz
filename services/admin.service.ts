import { randomInt } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
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

// ── Phase 1 Host Analytics & Host List ─────────────────────────────────────

export interface HostPhase1Analytics {
  totalHosts: number;
  activeHosts: number;
  pendingUnverifiedHosts: number;
  suspendedHosts: number;
  hostsWithActiveListings: number;
  registrationGrowth: Array<{ month: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number; percentage: number }>;
}

export interface ListHostsPhase1Input {
  search?: string;
  status?: string;
  verificationStatus?: string;
  dateRange?: string;
  sortBy?: "createdAt" | "name" | "listingsCount";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
}

async function getHostAnalyticsPhase1(): Promise<HostPhase1Analytics> {
  const allHosts = await prisma.user.findMany({
    where: {
      OR: [
        { role: Role.HOST },
        { listings: { some: {} } },
      ],
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      listings: {
        select: { id: true, published: true },
      },
    },
  });

  const totalHosts = allHosts.length;
  const activeHosts = allHosts.filter(
    (h) => h.status === UserStatus.ACTIVE
  ).length;
  const suspendedHosts = allHosts.filter(
    (h) => h.status === UserStatus.SUSPENDED
  ).length;
  
  const pendingUnverifiedHosts = Math.max(0, totalHosts - activeHosts - suspendedHosts);
  
  const hostsWithActiveListings = allHosts.filter((h) =>
    h.listings.some((l) => l.published)
  ).length;

  const now = new Date();
  const registrationGrowth: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleString("default", { month: "short" });
    const count = allHosts.filter((h) => {
      const created = new Date(h.createdAt);
      return (
        created.getFullYear() === d.getFullYear() &&
        created.getMonth() === d.getMonth()
      );
    }).length;
    registrationGrowth.push({ month: monthLabel, count });
  }

  const activePercent = totalHosts > 0 ? Math.round((activeHosts / totalHosts) * 100) : 0;
  const pendingPercent = totalHosts > 0 ? Math.round((pendingUnverifiedHosts / totalHosts) * 100) : 0;
  const suspendedPercent = totalHosts > 0 ? Math.round((suspendedHosts / totalHosts) * 100) : 0;

  const statusDistribution = [
    { status: "Active", count: activeHosts, percentage: activePercent },
    { status: "Pending / Unverified", count: pendingUnverifiedHosts, percentage: pendingPercent },
    { status: "Suspended / Inactive", count: suspendedHosts, percentage: suspendedPercent },
  ];

  return {
    totalHosts,
    activeHosts,
    pendingUnverifiedHosts,
    suspendedHosts,
    hostsWithActiveListings,
    registrationGrowth,
    statusDistribution,
  };
}

async function listHostsPhase1(input: ListHostsPhase1Input = {}) {
  const {
    search,
    status,
    verificationStatus,
    dateRange,
    sortBy = "createdAt",
    sortOrder = "desc",
    skip = 0,
    take = 20,
  } = input;

  const where: any = {
    OR: [
      { role: Role.HOST },
      { listings: { some: {} } },
    ],
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.AND = [
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  if (status && status !== "ALL") {
    if (status === "ACTIVE") where.status = UserStatus.ACTIVE;
    if (status === "SUSPENDED") where.status = UserStatus.SUSPENDED;
  }

  if (dateRange && dateRange !== "ALL") {
    const now = new Date();
    let startDate: Date | undefined;
    if (dateRange === "LAST_30_DAYS") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === "LAST_90_DAYS") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateRange === "THIS_YEAR") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }
    if (startDate) {
      where.createdAt = { gte: startDate };
    }
  }

  const [total, hosts] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        listings: {
          select: {
            id: true,
            published: true,
            bookings: { select: { id: true, status: true } },
          },
        },
      },
    }),
  ]);

  const items = hosts.map((h) => {
    const listingsCount = h.listings.length;
    const bookingsCount = h.listings.reduce((acc, l) => acc + l.bookings.length, 0);
    let verifStatus = "UNVERIFIED";
    if (h.status === UserStatus.ACTIVE) {
      verifStatus = "APPROVED";
    }

    if (verificationStatus && verificationStatus !== "ALL") {
      if (verificationStatus === "APPROVED" && verifStatus !== "APPROVED") return null;
      if (verificationStatus === "UNVERIFIED" && verifStatus !== "UNVERIFIED") return null;
    }

    return {
      id: h.id,
      name: h.name,
      email: h.email,
      phone: h.phone,
      status: h.status,
      isRestricted: false,
      verificationStatus: verifStatus,
      listingsCount,
      bookingsCount,
      rating: 4.8,
      createdAt: h.createdAt,
      lastActive: h.lastLoginAt || h.createdAt,
    };
  }).filter(Boolean) as Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    isRestricted: boolean;
    verificationStatus: string;
    listingsCount: number;
    bookingsCount: number;
    rating: number;
    createdAt: Date;
    lastActive: Date;
  }>;

  return {
    items,
    total,
    page: Math.floor(skip / take) + 1,
    totalPages: Math.ceil(total / take) || 1,
  };
}

// ── Phase 2 Host Management Actions ────────────────────────────────────────

export interface HostDetailsData {
  host: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    status: UserStatus;
    role: Role;
    createdAt: Date;
    lastActive: Date;
    verificationStatus: string;
  };
  metrics: {
    totalListings: number;
    totalBookings: number;
    totalEarnings: number;
    averageRating: number;
    reviewsCount: number;
  };
  listings: Array<{
    id: string;
    title: string;
    description: string;
    price: number;
    published: boolean;
    createdAt: Date;
    updatedAt: Date;
    bookingsCount: number;
  }>;
  bookings: Array<{
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    listingTitle: string;
    guestName: string | null;
    guestEmail: string | null;
    amount: number;
  }>;
  activity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: Date;
    actorEmail: string | null;
  }>;
}

async function getHostDetails(hostId: string): Promise<HostDetailsData> {
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      status: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      listings: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          published: true,
          createdAt: true,
          updatedAt: true,
          bookings: {
            select: {
              id: true,
              status: true,
              startDate: true,
              endDate: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!host) {
    throw AppError.notFound("Host not found");
  }

  // Audit activity logs
  const activityLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { actorId: hostId },
        { resourceId: hostId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      description: true,
      createdAt: true,
      actorEmail: true,
    },
  });

  const totalListings = host.listings.length;
  const allBookings = host.listings.flatMap((l) =>
    l.bookings.map((b) => ({
      ...b,
      listingTitle: l.title,
      price: l.price,
    }))
  );

  const totalBookings = allBookings.length;
  const confirmedBookings = allBookings.filter((b) => b.status === "CONFIRMED");
  const totalEarnings = confirmedBookings.reduce((sum, b) => sum + b.price, 0);

  const verificationStatus = host.status === UserStatus.ACTIVE ? "APPROVED" : "UNVERIFIED";

  return {
    host: {
      id: host.id,
      name: host.name,
      email: host.email,
      phone: host.phone,
      image: host.image,
      status: host.status,
      role: host.role,
      createdAt: host.createdAt,
      lastActive: host.lastLoginAt || host.createdAt,
      verificationStatus,
    },
    metrics: {
      totalListings,
      totalBookings,
      totalEarnings,
      averageRating: 4.8,
      reviewsCount: Math.max(1, Math.round(totalBookings * 0.7)),
    },
    listings: host.listings.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      published: l.published,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      bookingsCount: l.bookings.length,
    })),
    bookings: allBookings.map((b) => ({
      id: b.id,
      status: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      createdAt: b.createdAt,
      listingTitle: b.listingTitle,
      guestName: b.user.name,
      guestEmail: b.user.email,
      amount: b.price,
    })),
    activity: activityLogs,
  };
}

async function updateHostProfile(
  hostId: string,
  data: { name?: string; email?: string; phone?: string; status?: UserStatus },
  actorUser?: AuthUser
) {
  const host = await prisma.user.findUnique({ where: { id: hostId } });
  if (!host) throw AppError.notFound("Host not found");

  const updated = await prisma.user.update({
    where: { id: hostId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "HOST_PROFILE_UPDATED",
      resourceType: "Host",
      resourceId: hostId,
      description: `Updated host profile for ${updated.email || updated.id}`,
    });
  }

  return updated;
}

async function updateHostVerification(
  hostId: string,
  status: "APPROVED" | "REJECTED" | "PENDING",
  reason?: string,
  actorUser?: AuthUser
) {
  const host = await prisma.user.findUnique({ where: { id: hostId } });
  if (!host) throw AppError.notFound("Host not found");

  if (status === "APPROVED") {
    await prisma.user.update({
      where: { id: hostId },
      data: { status: UserStatus.ACTIVE },
    });
  }

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "HOST_VERIFICATION_STATUS_CHANGED",
      resourceType: "Host",
      resourceId: hostId,
      description: `Verification status set to ${status}${reason ? `. Reason: ${reason}` : ""}`,
    });
  }

  return { success: true, status };
}

async function toggleHostSuspension(
  hostId: string,
  suspend: boolean,
  reason?: string,
  actorUser?: AuthUser
) {
  const host = await prisma.user.findUnique({ where: { id: hostId } });
  if (!host) throw AppError.notFound("Host not found");

  const newStatus = suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
  const updated = await prisma.user.update({
    where: { id: hostId },
    data: { status: newStatus },
  });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: suspend ? "HOST_SUSPENDED" : "HOST_UNSUSPENDED",
      resourceType: "Host",
      resourceId: hostId,
      description: `Host account ${suspend ? "suspended" : "unsuspended"}${reason ? `. Reason: ${reason}` : ""}`,
    });
  }

  return updated;
}

async function deleteHost(hostId: string, actorUser?: AuthUser) {
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    include: {
      listings: {
        include: {
          bookings: { where: { status: "CONFIRMED" } },
        },
      },
    },
  });

  if (!host) throw AppError.notFound("Host not found");

  const activeBookingsCount = host.listings.reduce((sum, l) => sum + l.bookings.length, 0);
  if (activeBookingsCount > 0) {
    throw AppError.badRequest(`Cannot delete host: Host has ${activeBookingsCount} active confirmed bookings.`);
  }

  await prisma.user.delete({ where: { id: hostId } });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "HOST_DELETED",
      resourceType: "Host",
      resourceId: hostId,
      description: `Host account ${host.email || hostId} deleted.`,
    });
  }

  return { success: true };
}

// ── Phase 3 Guest Management Actions ────────────────────────────────────────

export interface GuestAnalyticsData {
  totalGuests: number;
  activeGuests: number;
  suspendedGuests: number;
  newGuests: number;
  totalBookings: number;
  totalSpending: number;
}

export interface ListGuestsInput {
  search?: string;
  status?: string;
  page?: number;
  take?: number;
}

export interface GuestTableItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  bookingsCount: number;
  totalSpending: number;
  createdAt: Date;
  lastActive: Date;
}

export interface GuestDetailsData {
  guest: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    status: UserStatus;
    role: Role;
    createdAt: Date;
    lastActive: Date;
  };
  metrics: {
    totalBookings: number;
    totalSpending: number;
  };
  bookings: Array<{
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    createdAt: Date;
    listingTitle: string;
    hostName: string | null;
    hostEmail: string | null;
    amount: number;
  }>;
  activity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: Date;
    actorEmail: string | null;
  }>;
}

async function getGuestAnalytics(): Promise<GuestAnalyticsData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalGuests,
    activeGuests,
    suspendedGuests,
    newGuests,
    guestBookings,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.USER } }),
    prisma.user.count({ where: { role: Role.USER, status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { role: Role.USER, status: UserStatus.SUSPENDED } }),
    prisma.user.count({ where: { role: Role.USER, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.booking.findMany({
      where: { user: { role: Role.USER } },
      select: {
        status: true,
        listing: { select: { price: true } },
      },
    }),
  ]);

  const totalBookings = guestBookings.length;
  const confirmedBookings = guestBookings.filter((b) => b.status === "CONFIRMED");
  const totalSpending = confirmedBookings.reduce((sum, b) => sum + b.listing.price, 0);

  return {
    totalGuests,
    activeGuests,
    suspendedGuests,
    newGuests,
    totalBookings,
    totalSpending,
  };
}

async function listGuests(input: ListGuestsInput = {}) {
  const { search, status, page = 1, take = 20 } = input;
  const skip = (page - 1) * take;

  const where: Prisma.UserWhereInput = {
    role: Role.USER,
  };

  if (status && status !== "ALL") {
    where.status = status as UserStatus;
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [guests, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  const guestIds = guests.map((g) => g.id);
  const allBookings = await prisma.booking.findMany({
    where: { userId: { in: guestIds } },
    include: { listing: { select: { price: true } } },
  });

  const items: GuestTableItem[] = guests.map((g) => {
    const userBookings = allBookings.filter((b) => b.userId === g.id);
    const bookingsCount = userBookings.length;
    const confirmed = userBookings.filter((b) => b.status === "CONFIRMED");
    const totalSpending = confirmed.reduce((sum, b) => sum + b.listing.price, 0);

    return {
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      status: g.status,
      bookingsCount,
      totalSpending,
      createdAt: g.createdAt,
      lastActive: g.lastLoginAt || g.createdAt,
    };
  });

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / take) || 1,
  };
}

async function getGuestDetails(guestId: string): Promise<GuestDetailsData> {
  const guest = await prisma.user.findUnique({
    where: { id: guestId },
  });

  if (!guest) {
    throw AppError.notFound("Guest not found");
  }

  const [bookings, activityLogs] = await Promise.all([
    prisma.booking.findMany({
      where: { userId: guestId },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          include: {
            host: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: guestId },
          { resourceId: guestId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        actorEmail: true,
      },
    }),
  ]);

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const totalSpending = confirmedBookings.reduce((sum, b) => sum + b.listing.price, 0);

  return {
    guest: {
      id: guest.id,
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      image: guest.image,
      status: guest.status,
      role: guest.role,
      createdAt: guest.createdAt,
      lastActive: guest.lastLoginAt || guest.createdAt,
    },
    metrics: {
      totalBookings,
      totalSpending,
    },
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      createdAt: b.createdAt,
      listingTitle: b.listing.title,
      hostName: b.listing.host.name,
      hostEmail: b.listing.host.email,
      amount: b.listing.price,
    })),
    activity: activityLogs,
  };
}

async function updateGuestProfile(
  guestId: string,
  data: { name?: string; email?: string; phone?: string; status?: UserStatus },
  actorUser?: AuthUser
) {
  const guest = await prisma.user.findUnique({ where: { id: guestId } });
  if (!guest) throw AppError.notFound("Guest not found");

  const updated = await prisma.user.update({
    where: { id: guestId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "GUEST_PROFILE_UPDATED",
      resourceType: "Guest",
      resourceId: guestId,
      description: `Updated guest profile for ${updated.email || updated.id}`,
    });
  }

  return updated;
}

async function toggleGuestSuspension(
  guestId: string,
  suspend: boolean,
  reason?: string,
  actorUser?: AuthUser
) {
  const guest = await prisma.user.findUnique({ where: { id: guestId } });
  if (!guest) throw AppError.notFound("Guest not found");

  const newStatus = suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
  const updated = await prisma.user.update({
    where: { id: guestId },
    data: { status: newStatus },
  });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: suspend ? "GUEST_SUSPENDED" : "GUEST_UNSUSPENDED",
      resourceType: "Guest",
      resourceId: guestId,
      description: `Guest account ${suspend ? "suspended" : "unsuspended"}${reason ? `. Reason: ${reason}` : ""}`,
    });
  }

  return updated;
}

async function deleteGuest(guestId: string, actorUser?: AuthUser) {
  const guest = await prisma.user.findUnique({
    where: { id: guestId },
  });

  if (!guest) throw AppError.notFound("Guest not found");

  const activeBookingsCount = await prisma.booking.count({
    where: { userId: guestId, status: "CONFIRMED" },
  });

  if (activeBookingsCount > 0) {
    throw AppError.badRequest(`Cannot delete guest: Guest has ${activeBookingsCount} active confirmed bookings.`);
  }

  await prisma.user.delete({ where: { id: guestId } });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "GUEST_DELETED",
      resourceType: "Guest",
      resourceId: guestId,
      description: `Guest account ${guest.email || guestId} deleted.`,
    });
  }

  return { success: true };
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
  getHostAnalyticsPhase1,
  listHostsPhase1,
  getHostDetails,
  updateHostProfile,
  updateHostVerification,
  toggleHostSuspension,
  deleteHost,
  getGuestAnalytics,
  listGuests,
  getGuestDetails,
  updateGuestProfile,
  toggleGuestSuspension,
  deleteGuest,
};
