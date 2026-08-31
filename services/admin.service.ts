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
import { invitationService } from "./invitation.service";
import { hostRegistrationService } from "./host-registration.service";
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

async function createAdmin(
  actor: AuthUser,
  input: CreateAdminInput,
): Promise<PublicUser> {
  const inv = await invitationService.createInvitation(actor, {
    name: input.name,
    email: input.email,
    role: input.role,
    adminRoleSlug: input.adminRoleSlug || "admin",
  });

  const user = await prisma.user.findUnique({
    where: { email: inv.email },
    include: { adminRole: { select: { name: true, slug: true } } },
  });

  if (!user) throw AppError.notFound("User not found after invitation creation");

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

// ── Unified Host Management Data Layer ──────────────────────────────────────

export interface UnifiedHostItem {
  id: string;
  applicationId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  accountStatus: "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";
  applicationStatus: "PENDING" | "IN_REVIEW" | "WAITING_FOR_DOCUMENTS" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED";
  onboardingStage: string;
  onboardingStageLabel: string;
  verificationStatus: "VERIFIED" | "PENDING" | "ACTION_REQUIRED" | "REJECTED" | "UNVERIFIED";
  complianceStatus: "COMPLIANT" | "PENDING" | "ACTION_REQUIRED" | "NON_COMPLIANT" | "UNDER_REVIEW";
  listingsCount: number;
  bookingsCount: number;
  rating: number;
  assignedReviewer: { id: string; name: string | null; email: string | null } | null;
  createdAt: Date;
  lastActive: Date;
  isRestricted: boolean;
  status: string; // backwards compatibility alias for accountStatus
}

export interface UnifiedHostAnalytics {
  totalHosts: number;
  activeHosts: number;
  pendingOnboarding: number;
  underReview: number;
  documentsPending: number;
  compliancePending: number;
  actionRequired: number;
  approved: number;
  suspended: number;
  hostsWithActiveListings: number;
  pendingUnverifiedHosts: number;
  suspendedHosts: number;
  registrationGrowth: Array<{ month: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number; percentage: number }>;
}

export interface ListUnifiedHostsInput {
  search?: string;
  accountStatus?: string;
  applicationStatus?: string;
  onboardingStage?: string;
  verificationStatus?: string;
  complianceStatus?: string;
  reviewerId?: string;
  dateRange?: string;
  sortBy?: "createdAt" | "name" | "listingsCount";
  sortOrder?: "asc" | "desc";
  skip?: number;
  take?: number;
  status?: string; // fallback alias
}

export interface HostDetailsData {
  host: {
    id: string;
    applicationId?: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    status: UserStatus | string;
    role: Role | string;
    createdAt: Date;
    lastActive: Date;
    accountStatus: string;
    applicationStatus: string;
    onboardingStage: string;
    onboardingStageLabel: string;
    verificationStatus: string;
    complianceStatus: string;
    progressPercent: number;
    onboardingProgress?: number;
    completedStepsCount: number;
    totalStepsCount: number;
  };
  registrationRequest: {
    id: string;
    applicationId: string;
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string | null;
    registrationType: string;
    businessName: string | null;
    propertyCount: number;
    location: string | null;
    notes: string | null;
    status: string;
    onboardingStage: string;
    assignedReviewer: { id: string; name: string | null; email: string | null } | null;
    reviewedBy: { id: string; name: string | null; email: string | null } | null;
    approvedBy: { id: string; name: string | null; email: string | null } | null;
    approvedAt: Date | string | null;
    rejectionReason: string | null;
    createdAt: Date | string;
  } | null;
  documents: Array<{
    id: string;
    requestId: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    mimeType: string | null;
    fileSize: number | null;
    status: string;
    uploadedAt: Date | string;
    expiryDate: Date | string | null;
    verifiedBy: { id: string; name: string | null; email: string | null } | null;
    verifiedAt: Date | string | null;
    rejectedBy: { id: string; name: string | null; email: string | null } | null;
    rejectedAt: Date | string | null;
    rejectionReason: string | null;
    resubmissionRequested: boolean;
    resubmissionInstructions: string | null;
  }>;
  compliance: {
    complianceStatus: string;
    lastReviewedAt?: Date | string | null;
    lastReviewedBy?: { id: string; name: string | null; email: string | null } | null;
    eligibility?: {
      eligible: boolean;
      reasons: string[];
      details: Record<string, any>;
    };
    summary?: {
      totalChecks: number;
      completedChecks: number;
      pendingChecks: number;
      openIssuesCount: number;
    };
    checks: Array<{
      id: string;
      checkKey?: string;
      checkType?: string;
      checkName: string;
      status: string;
      notes: string | null;
      completedAt?: Date | string | null;
      reviewer?: { id: string; name: string | null; email: string | null } | null;
    }>;
    issues: Array<{
      id: string;
      issueType: string;
      description: string;
      severity: string;
      status: string;
      createdAt: Date | string;
      resolvedAt: Date | string | null;
      resolutionNotes: string | null;
      createdBy?: { id: string; name: string | null; email: string | null } | null;
      resolvedBy?: { id: string; name: string | null; email: string | null } | null;
    }>;
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

export interface HostPhase1Analytics extends UnifiedHostAnalytics {}
export interface ListHostsPhase1Input extends ListUnifiedHostsInput {}

function mapStageLabel(stage: string): string {
  switch (stage) {
    case "INITIAL_INTAKE":
    case "REGISTRATION_SUBMITTED":
      return "Registration Submitted";
    case "PROFILE_COMPLETION":
      return "Profile Completion";
    case "APPLICATION_REVIEW":
    case "DOCUMENT_INTAKE":
      return "Application Review";
    case "DOCUMENT_VERIFICATION":
      return "Document Verification";
    case "COMPLIANCE_REVIEW":
      return "Compliance Review";
    case "APPROVAL_REVIEW":
    case "READY_FOR_APPROVAL":
      return "Ready for Approval";
    case "APPROVED":
    case "HOST_ACTIVATION":
      return "Approved";
    case "ONBOARDING_COMPLETE":
      return "Onboarding Complete";
    default:
      return stage.replace(/_/g, " ");
  }
}

async function listUnifiedHosts(input: ListUnifiedHostsInput = {}) {
  const {
    search,
    accountStatus = "ALL",
    applicationStatus = "ALL",
    onboardingStage = "ALL",
    verificationStatus = "ALL",
    complianceStatus = "ALL",
    reviewerId = "ALL",
    dateRange = "ALL",
    sortBy = "createdAt",
    sortOrder = "desc",
    skip = 0,
    take = 20,
    status,
  } = input;

  const activeAccountFilter = accountStatus !== "ALL" ? accountStatus : (status && status !== "ALL" ? status : "ALL");

  const [users, unlinkedRequests] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { role: Role.HOST },
          { listings: { some: {} } },
          { hostRegistrations: { some: {} } },
        ],
      },
      include: {
        hostRegistrations: {
          include: {
            assignedReviewer: { select: { id: true, name: true, email: true } },
            documents: true,
            complianceChecks: true,
            complianceIssues: true,
          },
          orderBy: { createdAt: "desc" },
        },
        listings: {
          include: {
            bookings: { select: { id: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.hostRegistrationRequest.findMany({
      where: {
        hostId: null,
      },
      include: {
        assignedReviewer: { select: { id: true, name: true, email: true } },
        documents: true,
        complianceChecks: true,
        complianceIssues: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rawList: UnifiedHostItem[] = [];
  const processedEmails = new Set<string>();

  for (const user of users) {
    if (user.email) processedEmails.add(user.email.toLowerCase());
    const primaryReq = user.hostRegistrations[0] || null;

    let accStatus: "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED" =
      user.status === UserStatus.ACTIVE
        ? "ACTIVE"
        : user.status === UserStatus.SUSPENDED
        ? "SUSPENDED"
        : "PENDING";

    let appStatus: "PENDING" | "IN_REVIEW" | "WAITING_FOR_DOCUMENTS" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED" =
      (primaryReq?.status as any) || (accStatus === "ACTIVE" ? "APPROVED" : "PENDING");

    let stage = primaryReq?.onboardingStage || (accStatus === "ACTIVE" ? (user.listings.some((l) => l.published) ? "ONBOARDING_COMPLETE" : "APPROVED") : "REGISTRATION_SUBMITTED");

    let verifStatus: "VERIFIED" | "PENDING" | "ACTION_REQUIRED" | "REJECTED" | "UNVERIFIED" = "UNVERIFIED";
    if (primaryReq?.documents && primaryReq.documents.length > 0) {
      const docs = primaryReq.documents;
      if (docs.some((d) => d.status === "REJECTED")) {
        verifStatus = "ACTION_REQUIRED";
      } else if (docs.every((d) => d.status === "VERIFIED")) {
        verifStatus = "VERIFIED";
      } else {
        verifStatus = "PENDING";
      }
    } else {
      verifStatus = accStatus === "ACTIVE" ? "VERIFIED" : "UNVERIFIED";
    }

    let compStatus: "COMPLIANT" | "PENDING" | "ACTION_REQUIRED" | "NON_COMPLIANT" | "UNDER_REVIEW" =
      (primaryReq?.complianceStatus as any) || (accStatus === "ACTIVE" ? "COMPLIANT" : "PENDING");

    const listingsCount = user.listings.length;
    const bookingsCount = user.listings.reduce((acc, l) => acc + l.bookings.length, 0);

    rawList.push({
      id: user.id,
      applicationId: primaryReq?.applicationId || user.id,
      name: user.name || primaryReq?.applicantName || "Unnamed Host",
      email: user.email,
      phone: user.phone || primaryReq?.applicantPhone || null,
      accountStatus: accStatus,
      applicationStatus: appStatus,
      onboardingStage: stage,
      onboardingStageLabel: mapStageLabel(stage),
      verificationStatus: verifStatus,
      complianceStatus: compStatus,
      listingsCount,
      bookingsCount,
      rating: 4.8,
      assignedReviewer: primaryReq?.assignedReviewer || null,
      createdAt: user.createdAt,
      lastActive: user.lastLoginAt || user.createdAt,
      isRestricted: accStatus === "SUSPENDED",
      status: accStatus,
    });
  }

  for (const req of unlinkedRequests) {
    if (req.applicantEmail && processedEmails.has(req.applicantEmail.toLowerCase())) {
      continue;
    }

    let accStatus: "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED" =
      req.status === "REJECTED" ? "REJECTED" : "PENDING";

    let appStatus: "PENDING" | "IN_REVIEW" | "WAITING_FOR_DOCUMENTS" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED" =
      (req.status as any) || "PENDING";

    let stage = req.onboardingStage || "REGISTRATION_SUBMITTED";

    let verifStatus: "VERIFIED" | "PENDING" | "ACTION_REQUIRED" | "REJECTED" | "UNVERIFIED" = "UNVERIFIED";
    if (req.documents && req.documents.length > 0) {
      if (req.documents.some((d) => d.status === "REJECTED")) {
        verifStatus = "ACTION_REQUIRED";
      } else if (req.documents.every((d) => d.status === "VERIFIED")) {
        verifStatus = "VERIFIED";
      } else {
        verifStatus = "PENDING";
      }
    }

    let compStatus: "COMPLIANT" | "PENDING" | "ACTION_REQUIRED" | "NON_COMPLIANT" | "UNDER_REVIEW" =
      (req.complianceStatus as any) || "PENDING";

    rawList.push({
      id: req.id,
      applicationId: req.applicationId,
      name: req.applicantName || "Applicant Host",
      email: req.applicantEmail,
      phone: req.applicantPhone,
      accountStatus: accStatus,
      applicationStatus: appStatus,
      onboardingStage: stage,
      onboardingStageLabel: mapStageLabel(stage),
      verificationStatus: verifStatus,
      complianceStatus: compStatus,
      listingsCount: 0,
      bookingsCount: 0,
      rating: 0,
      assignedReviewer: req.assignedReviewer || null,
      createdAt: req.createdAt,
      lastActive: req.updatedAt,
      isRestricted: false,
      status: accStatus,
    });
  }

  // Calculate Overall Analytics KPIs
  const totalHosts = rawList.length;
  const activeHosts = rawList.filter((h) => h.accountStatus === "ACTIVE").length;
  const suspendedHosts = rawList.filter((h) => h.accountStatus === "SUSPENDED").length;
  const pendingOnboarding = rawList.filter((h) => h.onboardingStage !== "ONBOARDING_COMPLETE" && h.accountStatus !== "REJECTED").length;
  const underReview = rawList.filter((h) => h.applicationStatus === "IN_REVIEW" || h.applicationStatus === "PENDING").length;
  const documentsPending = rawList.filter((h) => h.verificationStatus === "PENDING" || h.applicationStatus === "WAITING_FOR_DOCUMENTS").length;
  const compliancePending = rawList.filter((h) => h.complianceStatus === "PENDING" || h.complianceStatus === "UNDER_REVIEW").length;
  const actionRequired = rawList.filter((h) => h.complianceStatus === "ACTION_REQUIRED" || h.verificationStatus === "ACTION_REQUIRED" || h.applicationStatus === "ACTION_REQUIRED").length;
  const approved = rawList.filter((h) => h.applicationStatus === "APPROVED").length;
  const hostsWithActiveListings = rawList.filter((h) => h.listingsCount > 0).length;
  const pendingUnverifiedHosts = rawList.filter((h) => h.verificationStatus !== "VERIFIED").length;

  const now = new Date();
  const registrationGrowth: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleString("default", { month: "short" });
    const count = rawList.filter((h) => {
      const created = new Date(h.createdAt);
      return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
    }).length;
    registrationGrowth.push({ month: monthLabel, count });
  }

  const activePercent = totalHosts > 0 ? Math.round((activeHosts / totalHosts) * 100) : 0;
  const pendingPercent = totalHosts > 0 ? Math.round((pendingOnboarding / totalHosts) * 100) : 0;
  const suspendedPercent = totalHosts > 0 ? Math.round((suspendedHosts / totalHosts) * 100) : 0;

  const statusDistribution = [
    { status: "Active", count: activeHosts, percentage: activePercent },
    { status: "Pending / Onboarding", count: pendingOnboarding, percentage: pendingPercent },
    { status: "Suspended / Inactive", count: suspendedHosts, percentage: suspendedPercent },
  ];

  const analytics: UnifiedHostAnalytics = {
    totalHosts,
    activeHosts,
    pendingOnboarding,
    underReview,
    documentsPending,
    compliancePending,
    actionRequired,
    approved,
    suspended: suspendedHosts,
    hostsWithActiveListings,
    pendingUnverifiedHosts,
    suspendedHosts,
    registrationGrowth,
    statusDistribution,
  };

  // Apply Filtering
  let filtered = rawList.filter((item) => {
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = item.name?.toLowerCase().includes(q);
      const matchEmail = item.email?.toLowerCase().includes(q);
      const matchPhone = item.phone?.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      const matchAppId = item.applicationId.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchId && !matchAppId) return false;
    }

    if (activeAccountFilter !== "ALL" && item.accountStatus !== activeAccountFilter) {
      return false;
    }

    if (applicationStatus !== "ALL" && item.applicationStatus !== applicationStatus) {
      return false;
    }

    if (onboardingStage !== "ALL" && item.onboardingStage !== onboardingStage) {
      return false;
    }

    if (verificationStatus !== "ALL" && item.verificationStatus !== verificationStatus) {
      return false;
    }

    if (complianceStatus !== "ALL" && item.complianceStatus !== complianceStatus) {
      return false;
    }

    if (reviewerId !== "ALL") {
      if (reviewerId === "UNASSIGNED" && item.assignedReviewer !== null) return false;
      if (reviewerId !== "UNASSIGNED" && item.assignedReviewer?.id !== reviewerId) return false;
    }

    if (dateRange !== "ALL") {
      const created = new Date(item.createdAt).getTime();
      const nowMs = new Date().getTime();
      if (dateRange === "LAST_30_DAYS" && nowMs - created > 30 * 24 * 60 * 60 * 1000) return false;
      if (dateRange === "LAST_90_DAYS" && nowMs - created > 90 * 24 * 60 * 60 * 1000) return false;
      if (dateRange === "THIS_YEAR") {
        if (new Date(item.createdAt).getFullYear() !== new Date().getFullYear()) return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    let valA: string | number | Date = a[sortBy] ?? 0;
    let valB: string | number | Date = b[sortBy] ?? 0;

    if (sortBy === "createdAt") {
      valA = new Date(a.createdAt).getTime();
      valB = new Date(b.createdAt).getTime();
    } else if (sortBy === "name") {
      valA = (a.name || "").toLowerCase();
      valB = (b.name || "").toLowerCase();
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const total = filtered.length;
  const paginatedItems = filtered.slice(skip, skip + take);

  return {
    items: paginatedItems,
    total,
    page: Math.floor(skip / take) + 1,
    totalPages: Math.ceil(total / take) || 1,
    analytics,
  };
}

async function getHostAnalyticsPhase1(): Promise<HostPhase1Analytics> {
  const result = await listUnifiedHosts({ take: 1000 });
  return result.analytics;
}

async function listHostsPhase1(input: ListHostsPhase1Input = {}) {
  const result = await listUnifiedHosts(input);
  return {
    items: result.items,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  };
}

async function getHostDetails(hostId: string): Promise<HostDetailsData> {
  // Find User by ID or email
  const user = (await prisma.user.findFirst({
    where: { OR: [{ id: hostId }, { email: hostId }] },
    include: {
      hostRegistrations: {
        include: {
          assignedReviewer: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          documents: {
            include: {
              verifiedBy: { select: { id: true, name: true, email: true } },
              rejectedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          complianceChecks: {
            include: {
              reviewer: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          complianceIssues: {
            orderBy: { createdAt: "desc" },
          },
          reviewNotes: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      listings: {
        orderBy: { createdAt: "desc" },
        include: {
          bookings: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  })) as any;

  // Find or provision Registration Request by ID, applicationId, or hostId
  let req = await prisma.hostRegistrationRequest.findFirst({
    where: {
      OR: [
        { id: hostId },
        { applicationId: hostId },
        { hostId: user?.id || hostId },
      ],
    },
    include: {
      assignedReviewer: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      complianceReviewedBy: { select: { id: true, name: true, email: true } },
      documents: {
        include: {
          verifiedBy: { select: { id: true, name: true, email: true } },
          rejectedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      complianceChecks: {
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      complianceIssues: {
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          resolvedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviewNotes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user && !req) {
    throw AppError.notFound("Host account or application record not found");
  }

  // If host user exists but has no registration request record, auto-provision one
  if (!req && user) {
    req = await prisma.hostRegistrationRequest.create({
      data: {
        hostId: user.id,
        applicantName: user.name || user.email || "Host User",
        applicantEmail: user.email!,
        applicantPhone: user.phone || null,
        registrationType: "INDIVIDUAL",
        status: user.status === UserStatus.ACTIVE ? "APPROVED" : "PENDING",
        onboardingStage: user.status === UserStatus.ACTIVE ? "ONBOARDING_COMPLETE" : "INITIAL_INTAKE",
        complianceStatus: user.status === UserStatus.ACTIVE ? "COMPLIANT" : "PENDING",
      },
      include: {
        assignedReviewer: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        complianceReviewedBy: { select: { id: true, name: true, email: true } },
        documents: {
          include: {
            verifiedBy: { select: { id: true, name: true, email: true } },
            rejectedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        complianceChecks: {
          include: { reviewer: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
        complianceIssues: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            resolvedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        reviewNotes: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  const primaryReq = req!;
  const targetId = user?.id || primaryReq.hostId || primaryReq.id;
  const targetEmail = user?.email || primaryReq.applicantEmail;

  // Ensure 6 standard compliance checks are auto-initialized for this host
  await hostRegistrationService.getComplianceDetails(primaryReq.id);
  
  // Re-fetch compliance checks and issues after initialization
  const [refetchedChecks, refetchedIssues, eligibilityResult] = await Promise.all([
    prisma.hostComplianceCheck.findMany({
      where: { requestId: primaryReq.id },
      include: { reviewer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.hostComplianceIssue.findMany({
      where: { requestId: primaryReq.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    hostRegistrationService.validateApprovalEligibility(primaryReq.id),
  ]);

  const listings = user?.listings || [];
  const totalListings = listings.length;
  const allBookings = listings.flatMap((l: any) =>
    l.bookings.map((b: any) => ({
      ...b,
      listingTitle: l.title,
      price: l.price,
    }))
  );
  const listingIds = listings.map((l: any) => l.id);
  const bookingIds = allBookings.map((b: any) => b.id);
  const totalBookings = allBookings.length;
  const confirmedBookings = allBookings.filter((b: any) => b.status === "CONFIRMED");
  const totalEarnings = confirmedBookings.reduce((sum: number, b: any) => sum + b.price, 0);

  // Comprehensive Activity Logs Query for this host
  const rawAuditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { actorId: targetId },
        { resourceId: targetId },
        { actorEmail: targetEmail },
        { resourceId: primaryReq.id },
        { resourceId: primaryReq.applicationId },
        ...(listingIds.length > 0 ? [{ resourceId: { in: listingIds } }] : []),
        ...(bookingIds.length > 0 ? [{ resourceId: { in: bookingIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const formattedActivityLogs = rawAuditLogs.map((log) => {
    const act = log.action.toUpperCase();
    let category = "ADMIN_ACTIONS";
    if (act.includes("REGISTR") || act.includes("ACCOUNT_CREATED")) category = "REGISTRATION";
    else if (act.includes("APPLICATION") || act.includes("REVIEW")) category = "APPLICATION";
    else if (act.includes("DOCUMENT")) category = "DOCUMENTS";
    else if (act.includes("COMPLIANCE") || act.includes("INFO_REQUEST")) category = "COMPLIANCE";
    else if (act.includes("APPROV") || act.includes("REJECT")) category = "APPROVAL";
    else if (act.includes("PROFILE") || act.includes("ROLE") || act.includes("PERMISSION")) category = "ACCOUNT";
    else if (act.includes("LISTING")) category = "LISTINGS";
    else if (act.includes("BOOKING")) category = "BOOKINGS";
    else if (act.includes("SUSPEND") || act.includes("UNSUSPEND") || act.includes("DELETE")) category = "ADMIN_ACTIONS";
    else if (act.includes("LOGIN") || act.includes("LOGOUT") || act.includes("SECURITY") || act.includes("PASSWORD")) category = "SECURITY";

    let actorType = "SYSTEM";
    let actorDisplay = log.actorEmail || "System Automation";
    if (log.actor) {
      if (log.actor.id === targetId) {
        actorType = "HOST";
        actorDisplay = `Host — ${log.actor.name || log.actor.email}`;
      } else if (log.actor.role === Role.ADMIN) {
        actorType = "ADMIN";
        actorDisplay = `Admin — ${log.actor.name || log.actor.email}`;
      } else {
        actorType = "USER";
        actorDisplay = log.actor.name || log.actor.email || "User";
      }
    } else if (log.actorEmail) {
      actorType = log.actorEmail.includes("admin") ? "ADMIN" : "HOST";
      actorDisplay = log.actorEmail;
    }

    const meta = (log.metadata as any) || {};

    return {
      id: log.id,
      action: log.action,
      category,
      description: log.description,
      status: log.status,
      actorType,
      actorDisplay,
      actorEmail: log.actorEmail || log.actor?.email || null,
      createdAt: log.createdAt,
      ip: log.ip || null,
      before: meta.before || meta.previousStatus || meta.previousState || null,
      after: meta.after || meta.newStatus || meta.newState || null,
      reason: meta.reason || meta.rejectionReason || meta.notes || null,
      documentType: meta.documentType || null,
      checkKey: meta.checkKey || null,
      severity: meta.severity || null,
    };
  });

  const accStatus = user
    ? user.status === UserStatus.ACTIVE
      ? "ACTIVE"
      : "SUSPENDED"
    : primaryReq.status === "REJECTED"
    ? "REJECTED"
    : "PENDING";

  const appStatus = primaryReq.status || (accStatus === "ACTIVE" ? "APPROVED" : "PENDING");
  const stage = primaryReq.onboardingStage || (accStatus === "ACTIVE" ? (totalListings > 0 ? "ONBOARDING_COMPLETE" : "APPROVED") : "REGISTRATION_SUBMITTED");

  const docs = primaryReq.documents || [];
  let verifStatus = "UNVERIFIED";
  if (docs.length > 0) {
    if (docs.some((d: any) => d.status === "REJECTED")) verifStatus = "ACTION_REQUIRED";
    else if (docs.every((d: any) => d.status === "VERIFIED")) verifStatus = "VERIFIED";
    else verifStatus = "PENDING";
  } else {
    verifStatus = accStatus === "ACTIVE" ? "VERIFIED" : "UNVERIFIED";
  }

  const compStatus = primaryReq.complianceStatus || (accStatus === "ACTIVE" ? "COMPLIANT" : "PENDING");

  // Step calculations (out of 7 total steps)
  let stepsCompleted = 1;
  if (appStatus === "APPROVED" || stage === "ONBOARDING_COMPLETE") {
    stepsCompleted = 7;
  } else {
    if (appStatus !== "PENDING") stepsCompleted = Math.max(stepsCompleted, 2);
    if (docs.length > 0) stepsCompleted = Math.max(stepsCompleted, 3);
    if (verifStatus === "VERIFIED" || docs.some((d: any) => d.status === "VERIFIED")) stepsCompleted = Math.max(stepsCompleted, 4);
    if (compStatus === "COMPLIANT") stepsCompleted = Math.max(stepsCompleted, 5);
  }

  const progressPercent = Math.round((stepsCompleted / 7) * 100);

  const completedChecksCount = refetchedChecks.filter((c) => c.status === "PASSED").length;
  const totalChecksCount = refetchedChecks.length;
  const openIssuesCount = refetchedIssues.filter((i) => i.status === "OPEN" || i.status === "UNDER_REVIEW").length;

  return {
    host: {
      id: targetId,
      applicationId: primaryReq.applicationId,
      name: user?.name || primaryReq.applicantName || "Unnamed Host",
      email: targetEmail,
      phone: user?.phone || primaryReq.applicantPhone || null,
      image: user?.image || null,
      status: (user?.status as any) || accStatus,
      role: (user?.role as any) || Role.HOST,
      createdAt: user?.createdAt || primaryReq.createdAt || new Date(),
      lastActive: user?.lastLoginAt || user?.createdAt || primaryReq.updatedAt || new Date(),
      accountStatus: accStatus,
      applicationStatus: appStatus,
      onboardingStage: stage,
      onboardingStageLabel: mapStageLabel(stage),
      verificationStatus: verifStatus,
      complianceStatus: compStatus,
      progressPercent,
      onboardingProgress: progressPercent,
      completedStepsCount: stepsCompleted,
      totalStepsCount: 7,
    },
    registrationRequest: {
      id: primaryReq.id,
      applicationId: primaryReq.applicationId,
      applicantName: primaryReq.applicantName,
      applicantEmail: primaryReq.applicantEmail,
      applicantPhone: primaryReq.applicantPhone,
      registrationType: primaryReq.registrationType,
      businessName: primaryReq.businessName,
      propertyCount: primaryReq.propertyCount,
      location: primaryReq.location,
      notes: primaryReq.notes,
      status: primaryReq.status,
      onboardingStage: primaryReq.onboardingStage,
      assignedReviewer: primaryReq.assignedReviewer,
      reviewedBy: primaryReq.reviewedBy,
      approvedBy: primaryReq.approvedBy,
      approvedAt: primaryReq.approvedAt,
      rejectionReason: primaryReq.rejectionReason,
      createdAt: primaryReq.createdAt,
    },
    documents: docs.map((d: any) => ({
      id: d.id,
      requestId: d.requestId,
      documentType: d.documentType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      status: d.status,
      uploadedAt: d.uploadedAt,
      expiryDate: d.expiryDate,
      verifiedBy: d.verifiedBy,
      verifiedAt: d.verifiedAt,
      rejectedBy: d.rejectedBy,
      rejectedAt: d.rejectedAt,
      rejectionReason: d.rejectionReason,
      resubmissionRequested: d.resubmissionRequested,
      resubmissionInstructions: d.resubmissionInstructions,
    })),
    compliance: {
      complianceStatus: compStatus,
      lastReviewedAt: primaryReq.complianceReviewedAt || null,
      lastReviewedBy: primaryReq.complianceReviewedBy || null,
      eligibility: {
        eligible: eligibilityResult.eligible,
        reasons: eligibilityResult.reasons,
        details: eligibilityResult.details,
      },
      summary: {
        totalChecks: totalChecksCount,
        completedChecks: completedChecksCount,
        pendingChecks: totalChecksCount - completedChecksCount,
        openIssuesCount,
      },
      checks: refetchedChecks.map((c: any) => ({
        id: c.id,
        checkKey: c.checkKey,
        checkName: c.checkName,
        status: c.status,
        notes: c.notes || null,
        completedAt: c.completedAt || null,
        reviewer: c.reviewer || null,
      })),
      issues: refetchedIssues.map((i: any) => ({
        id: i.id,
        issueType: i.issueType,
        description: i.description,
        severity: i.severity,
        status: i.status,
        createdAt: i.createdAt,
        createdBy: i.createdBy || null,
        resolvedAt: i.resolvedAt || null,
        resolvedBy: i.resolvedBy || null,
        resolutionNotes: i.resolutionNotes || null,
      })),
    },
    metrics: {
      totalListings,
      totalBookings,
      totalEarnings,
      averageRating: 4.8,
      reviewsCount: Math.max(1, Math.round(totalBookings * 0.7)),
    },
    listings: listings.map((l: any) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      published: l.published,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      bookingsCount: l.bookings.length,
    })),
    bookings: allBookings.map((b: any) => ({
      id: b.id,
      status: b.status,
      startDate: b.startDate,
      endDate: b.endDate,
      createdAt: b.createdAt,
      listingTitle: b.listingTitle,
      guestName: b.user?.name || null,
      guestEmail: b.user?.email || null,
      amount: b.price,
    })),
    activity: formattedActivityLogs,
  };
}

const getUnifiedHostDetails = getHostDetails;

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

async function approveHostApplication(hostId: string, actorUser?: AuthUser) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: hostId }, { email: hostId }] },
  });

  const req = await prisma.hostRegistrationRequest.findFirst({
    where: { OR: [{ id: hostId }, { applicationId: hostId }, ...(user ? [{ hostId: user.id }] : [])] },
  });

  if (!user && !req) throw AppError.notFound("Host account or registration request not found");

  if (req) {
    const eligibility = await hostRegistrationService.validateApprovalEligibility(req.id);
    if (!eligibility.eligible) {
      throw AppError.badRequest(
        `Cannot approve application: ${eligibility.reasons.join(". ")}`
      );
    }
  }

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: Role.HOST,
        status: UserStatus.ACTIVE,
      },
    });
  }

  if (req) {
    await prisma.hostRegistrationRequest.update({
      where: { id: req.id },
      data: {
        status: "APPROVED",
        onboardingStage: "ONBOARDING_COMPLETE",
        complianceStatus: "COMPLIANT",
        approvedAt: new Date(),
        approvedById: actorUser?.id || null,
      },
    });
  }

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "HOST_APPLICATION_APPROVED",
      resourceType: "Host",
      resourceId: user?.id || req?.id || hostId,
      description: `Approved host application for ${user?.email || req?.applicantEmail}`,
    });
  }

  return { success: true, message: "Host application approved successfully" };
}

async function updateComplianceCheck(
  hostId: string,
  checkId: string,
  status: "PENDING" | "PASSED" | "FAILED",
  notes?: string,
  actorUser?: AuthUser
) {
  if (!actorUser) throw AppError.unauthorized("Authentication required");
  return await hostRegistrationService.updateComplianceCheck(actorUser, checkId, status, notes);
}

async function createComplianceIssue(
  hostId: string,
  issueType: string,
  description: string,
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  actorUser?: AuthUser
) {
  if (!actorUser) throw AppError.unauthorized("Authentication required");
  const req = await prisma.hostRegistrationRequest.findFirst({
    where: { OR: [{ id: hostId }, { applicationId: hostId }, { hostId }] },
  });
  if (!req) throw AppError.notFound("Registration request not found");
  return await hostRegistrationService.createComplianceIssue(actorUser, req.id, issueType, description, severity);
}

async function resolveComplianceIssue(
  hostId: string,
  issueId: string,
  status: "RESOLVED" | "REJECTED",
  resolutionNotes?: string,
  actorUser?: AuthUser
) {
  if (!actorUser) throw AppError.unauthorized("Authentication required");
  return await hostRegistrationService.resolveComplianceIssue(actorUser, issueId, status, resolutionNotes);
}

async function updateComplianceStatus(
  hostId: string,
  status: "COMPLIANT" | "NON_COMPLIANT" | "ACTION_REQUIRED" | "UNDER_REVIEW" | "PENDING",
  notes?: string,
  actorUser?: AuthUser
) {
  if (!actorUser) throw AppError.unauthorized("Authentication required");
  const req = await prisma.hostRegistrationRequest.findFirst({
    where: { OR: [{ id: hostId }, { applicationId: hostId }, { hostId }] },
  });
  if (!req) throw AppError.notFound("Registration request not found");
  return await hostRegistrationService.updateComplianceDecision(actorUser, req.id, status as any, notes);
}

async function requestInfo(
  hostId: string,
  informationRequired: string,
  reason: string,
  deadline?: Date | string | null,
  actorUser?: AuthUser
) {
  if (!actorUser) throw AppError.unauthorized("Authentication required");
  const req = await prisma.hostRegistrationRequest.findFirst({
    where: { OR: [{ id: hostId }, { applicationId: hostId }, { hostId }] },
  });
  if (!req) throw AppError.notFound("Registration request not found");
  return await hostRegistrationService.requestAdditionalInformation(actorUser, req.id, informationRequired, reason, deadline);
}

async function rejectHostApplication(hostId: string, reason: string, actorUser?: AuthUser) {
  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Rejection reason is required to reject an application.");
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: hostId }, { email: hostId }] },
  });

  const req = await prisma.hostRegistrationRequest.findFirst({
    where: { OR: [{ id: hostId }, { applicationId: hostId }, ...(user ? [{ hostId: user.id }] : [])] },
  });

  if (!req) throw AppError.notFound("Host registration request not found");

  await prisma.hostRegistrationRequest.update({
    where: { id: req.id },
    data: {
      status: "REJECTED",
      onboardingStage: "APPROVAL",
      rejectionReason: reason.trim(),
    },
  });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "HOST_APPLICATION_REJECTED",
      resourceType: "Host",
      resourceId: user?.id || req.id,
      description: `Rejected host application for ${req.applicantEmail}. Reason: ${reason.trim()}`,
    });
  }

  return { success: true, message: "Host application rejected" };
}

async function requestHostAction(hostId: string, notes: string, actorUser?: AuthUser) {
  const req = await prisma.hostRegistrationRequest.findFirst({
    where: { OR: [{ id: hostId }, { applicationId: hostId }, { hostId }] },
  });

  if (!req) throw AppError.notFound("Host registration request not found");

  await prisma.hostRegistrationRequest.update({
    where: { id: req.id },
    data: {
      status: "WAITING_FOR_DOCUMENTS",
      onboardingStage: "DOCUMENT_VERIFICATION",
      notes: notes || "Updates requested by administrator",
    },
  });

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: "HOST_ACTION_REQUESTED",
      resourceType: "Host",
      resourceId: req.id,
      description: `Requested host application action for ${req.applicantEmail}: ${notes}`,
    });
  }

  return { success: true, message: "Action request sent to host" };
}

async function updateDocumentStatus(
  documentId: string,
  status: "VERIFIED" | "REJECTED",
  reason?: string,
  actorUser?: AuthUser
) {
  const doc = await prisma.hostRegistrationDocument.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) throw AppError.notFound("Host document not found");

  const updated = await prisma.hostRegistrationDocument.update({
    where: { id: documentId },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? reason || "Document invalid or unreadable" : null,
      resubmissionRequested: status === "REJECTED",
      verifiedById: status === "VERIFIED" ? actorUser?.id || null : null,
      verifiedAt: status === "VERIFIED" ? new Date() : null,
      rejectedById: status === "REJECTED" ? actorUser?.id || null : null,
      rejectedAt: status === "REJECTED" ? new Date() : null,
    },
  });

  // If document was rejected, set request status to WAITING_FOR_DOCUMENTS
  if (status === "REJECTED") {
    await prisma.hostRegistrationRequest.update({
      where: { id: doc.requestId },
      data: {
        status: "WAITING_FOR_DOCUMENTS",
        onboardingStage: "DOCUMENT_VERIFICATION",
      },
    });
  }

  if (actorUser) {
    await auditService.record({
      actorId: actorUser.id,
      actorEmail: actorUser.email,
      action: status === "VERIFIED" ? "HOST_DOCUMENT_VERIFIED" : "HOST_DOCUMENT_REJECTED",
      resourceType: "HostRegistrationDocument",
      resourceId: documentId,
      description: `${status === "VERIFIED" ? "Verified" : "Rejected"} document ${doc.documentType} for ${doc.request.applicantEmail}`,
    });
  }

  return updated;
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
  listUnifiedHosts,
  getHostDetails,
  getUnifiedHostDetails,
  updateHostProfile,
  updateHostVerification,
  approveHostApplication,
  rejectHostApplication,
  requestHostAction,
  updateDocumentStatus,
  updateComplianceCheck,
  createComplianceIssue,
  resolveComplianceIssue,
  updateComplianceStatus,
  requestInfo,
  toggleHostSuspension,
  deleteHost,
  getGuestAnalytics,
  listGuests,
  getGuestDetails,
  updateGuestProfile,
  toggleGuestSuspension,
  deleteGuest,
};
