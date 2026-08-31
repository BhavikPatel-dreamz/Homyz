import { createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { AdminInvitationStatus, Role, UserStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { sendAdminInvitationEmail } from "@/lib/services/email";
import { auditService } from "./audit.service";
import { isSuperAdmin } from "@/lib/permissions/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { checkRateLimit } from "@/lib/services/rate-limit";
import type { AcceptInvitationInput, InviteAdminInput } from "@/lib/validation/admin";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function formatUTCDateTime(value?: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${d.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

export interface PublicInvitation {
  id: string;
  email: string;
  name: string | null;
  role: string;
  adminRoleId: string | null;
  adminRoleName?: string | null;
  status: AdminInvitationStatus;
  invitedById: string | null;
  invitedByEmail: string | null;
  invitedByName?: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  lastResentAt: Date | null;
  message: string | null;
  customPermissions: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

function toPublicInvitation(inv: any): PublicInvitation {
  return {
    id: inv.id,
    email: inv.email,
    name: inv.name,
    role: inv.role,
    adminRoleId: inv.adminRoleId,
    adminRoleName: inv.adminRole?.name || (inv.role === Role.ADMIN ? "Administrator" : "Staff"),
    status: inv.status,
    invitedById: inv.invitedById,
    invitedByEmail: inv.invitedByEmail,
    invitedByName: inv.invitedBy?.name || inv.invitedByEmail,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt,
    revokedAt: inv.revokedAt,
    lastResentAt: inv.lastResentAt,
    message: inv.message,
    customPermissions: Array.isArray(inv.customPermissions) ? (inv.customPermissions as string[]) : null,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

async function createInvitation(
  actor: AuthUser,
  input: InviteAdminInput,
): Promise<PublicInvitation> {
  const emailAddr = input.email.toLowerCase().trim();

  // Prevent non-super admins from inviting Super Admin role
  if (input.adminRoleSlug === "super_admin" || input.adminRoleSlug === "super-admin") {
    if (!isSuperAdmin(actor)) {
      throw AppError.forbidden("Only Super Admins can invite a Super Admin user");
    }
  }

  // 1. Existing Account Check
  const existingUser = await prisma.user.findUnique({ where: { email: emailAddr } });
  if (existingUser) {
    if (existingUser.status === UserStatus.ACTIVE) {
      if (existingUser.role === Role.ADMIN || existingUser.adminRoleId) {
        throw AppError.conflict("An active administrator with this email already exists");
      }
      throw AppError.conflict(
        "An account with this email already exists as a non-admin user. Automatic conversion is not supported."
      );
    }
    if (existingUser.status === UserStatus.SUSPENDED) {
      throw AppError.conflict("This email belongs to a suspended account");
    }
  }

  // 2. Check for active pending invitation for this email
  const existingPending = await prisma.adminInvitation.findFirst({
    where: {
      email: emailAddr,
      status: AdminInvitationStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingPending) {
    throw AppError.conflict(
      "A pending invitation for this email already exists. You can resend or revoke it from the Invitations tab."
    );
  }

  // 3. Resolve AdminRole
  let adminRoleId: string | null = null;
  let roleDisplay = "Administrator";
  if (input.adminRoleSlug) {
    const roleRecord = await prisma.adminRole.findUnique({
      where: { slug: input.adminRoleSlug },
    });
    if (roleRecord) {
      adminRoleId = roleRecord.id;
      roleDisplay = roleRecord.name;
    }
  }

  // 4. Create or update INVITATION_PENDING user account
  let targetUser = existingUser;
  if (!targetUser) {
    targetUser = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: emailAddr,
        role: input.role as Role,
        adminRoleId,
        status: UserStatus.INVITATION_PENDING,
        passwordHash: null,
      },
    });
  } else if (targetUser.status === UserStatus.INVITATION_PENDING) {
    targetUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        name: input.name.trim(),
        role: input.role as Role,
        adminRoleId,
      },
    });
  }

  // 5. Generate secure cryptographically random token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // 6. Store invitation record with hashed token
  const invitation = await prisma.adminInvitation.create({
    data: {
      email: emailAddr,
      name: input.name.trim(),
      role: input.role as Role,
      adminRoleId,
      tokenHash,
      status: AdminInvitationStatus.PENDING,
      invitedById: actor.id,
      invitedByEmail: actor.email,
      expiresAt,
      message: input.message?.trim() || null,
      customPermissions: input.customPermissions ? (input.customPermissions as any) : undefined,
    },
    include: {
      adminRole: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const invitationUrl = `${appUrl()}/accept-invitation?token=${encodeURIComponent(rawToken)}`;

  // 7. Dispatch Invitation Email
  try {
    await sendAdminInvitationEmail(
      emailAddr,
      input.name.trim(),
      invitationUrl,
      roleDisplay,
      "24 hours",
      actor.name || actor.email || undefined,
      input.message?.trim() || undefined,
    );
  } catch (emailErr: any) {
    console.error("[invitationService:sendEmail] Email delivery failed:", emailErr);

    // Mark invitation as failed
    await prisma.adminInvitation.update({
      where: { id: invitation.id },
      data: { status: AdminInvitationStatus.FAILED },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ADMIN_INVITATION_FAILED",
      resourceType: "AdminInvitation",
      resourceId: invitation.id,
      description: `Failed to deliver invitation email to ${emailAddr}: ${emailErr.message || "Unknown error"}`,
      status: "FAILURE",
    });

    throw AppError.internal(
      "Admin invitation created, but email delivery failed. You can resend the invitation from the dashboard."
    );
  }

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_INVITATION_CREATED",
    resourceType: "AdminInvitation",
    resourceId: invitation.id,
    description: `Created admin invitation for ${emailAddr} with role ${roleDisplay}. Setup email sent.`,
  });

  return toPublicInvitation(invitation);
}

async function listInvitations(opts: {
  skip: number;
  take: number;
  search?: string;
  status?: string;
  role?: string;
  dateRange?: string;
}): Promise<{ items: PublicInvitation[]; total: number }> {
  // Update expired pending invitations automatically
  const now = new Date();
  await prisma.adminInvitation.updateMany({
    where: {
      status: AdminInvitationStatus.PENDING,
      expiresAt: { lte: now },
    },
    data: { status: AdminInvitationStatus.EXPIRED },
  });

  const where: Prisma.AdminInvitationWhereInput = {};

  if (opts.status && opts.status !== "ALL") {
    where.status = opts.status as AdminInvitationStatus;
  }

  if (opts.role && opts.role !== "ALL") {
    where.OR = [
      { adminRole: { slug: opts.role } },
      { role: opts.role as Role },
    ];
  }

  if (opts.search) {
    const q = opts.search.trim();
    where.AND = [
      {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { invitedByEmail: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  if (opts.dateRange && opts.dateRange !== "ALL") {
    let startDate: Date | undefined;
    if (opts.dateRange === "LAST_24_HOURS") {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (opts.dateRange === "LAST_7_DAYS") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (opts.dateRange === "LAST_30_DAYS") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (startDate) {
      where.createdAt = { gte: startDate };
    }
  }

  const [items, total] = await Promise.all([
    prisma.adminInvitation.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      orderBy: { createdAt: "desc" },
      include: {
        adminRole: { select: { name: true, slug: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.adminInvitation.count({ where }),
  ]);

  return { items: items.map(toPublicInvitation), total };
}

async function resendInvitation(
  actor: AuthUser,
  invitationId: string,
): Promise<PublicInvitation> {
  const invitation = await prisma.adminInvitation.findUnique({
    where: { id: invitationId },
    include: {
      adminRole: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) throw AppError.notFound("Invitation record not found");

  if (invitation.status === AdminInvitationStatus.ACCEPTED) {
    throw AppError.badRequest("This invitation has already been accepted");
  }
  if (invitation.status === AdminInvitationStatus.REVOKED) {
    throw AppError.badRequest("Cannot resend a revoked invitation");
  }

  // Rate limiting / cooldown: max 1 resend per 60s per invitation
  const rateKey = `invitation_resend:${invitationId}`;
  const rate = checkRateLimit(rateKey, 1, 60);
  if (!rate.allowed) {
    throw AppError.rateLimited(
      `Please wait ${rate.retryAfter} seconds before resending this invitation email.`
    );
  }

  // Generate new secure token and refresh expiration
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const roleDisplay = invitation.adminRole?.name || "Administrator";
  const invitationUrl = `${appUrl()}/accept-invitation?token=${encodeURIComponent(rawToken)}`;

  // Send new email
  try {
    await sendAdminInvitationEmail(
      invitation.email,
      invitation.name,
      invitationUrl,
      roleDisplay,
      "24 hours",
      actor.name || actor.email || undefined,
      invitation.message || undefined,
    );
  } catch (emailErr: any) {
    console.error("[invitationService:resend] Email delivery failed:", emailErr);
    await prisma.adminInvitation.update({
      where: { id: invitationId },
      data: { status: AdminInvitationStatus.FAILED },
    });
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ADMIN_INVITATION_FAILED",
      resourceType: "AdminInvitation",
      resourceId: invitationId,
      description: `Resend failed for ${invitation.email}: ${emailErr.message || "Email service error"}`,
      status: "FAILURE",
    });
    throw AppError.internal("Failed to deliver invitation email. Please try again.");
  }

  const updated = await prisma.adminInvitation.update({
    where: { id: invitationId },
    data: {
      tokenHash,
      status: AdminInvitationStatus.PENDING,
      expiresAt,
      lastResentAt: new Date(),
    },
    include: {
      adminRole: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_INVITATION_RESENT",
    resourceType: "AdminInvitation",
    resourceId: invitationId,
    description: `Resent invitation email to ${invitation.email} with new secure 24h token.`,
  });

  return toPublicInvitation(updated);
}

async function revokeInvitation(
  actor: AuthUser,
  invitationId: string,
): Promise<PublicInvitation> {
  const invitation = await prisma.adminInvitation.findUnique({
    where: { id: invitationId },
    include: {
      adminRole: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) throw AppError.notFound("Invitation not found");

  if (invitation.status === AdminInvitationStatus.ACCEPTED) {
    throw AppError.badRequest("Cannot revoke an invitation that has already been accepted");
  }

  const updated = await prisma.adminInvitation.update({
    where: { id: invitationId },
    data: {
      status: AdminInvitationStatus.REVOKED,
      revokedAt: new Date(),
    },
    include: {
      adminRole: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADMIN_INVITATION_REVOKED",
    resourceType: "AdminInvitation",
    resourceId: invitationId,
    description: `Revoked pending invitation for ${invitation.email}. Token is now permanently invalidated.`,
  });

  return toPublicInvitation(updated);
}

async function validateToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== "string") {
    throw AppError.badRequest("Invitation token is missing");
  }

  const tokenHash = hashToken(rawToken.trim());
  const invitation = await prisma.adminInvitation.findUnique({
    where: { tokenHash },
    include: {
      adminRole: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) {
    await auditService.record({
      action: "INVITATION_TOKEN_INVALID",
      resourceType: "AdminInvitation",
      description: "Attempted to open invitation link with unknown or invalid token hash",
      status: "FAILURE",
    });
    throw AppError.notFound("This invitation link is invalid or does not exist.");
  }

  if (invitation.status === AdminInvitationStatus.REVOKED) {
    await auditService.record({
      action: "REVOKED_TOKEN_USAGE_ATTEMPT",
      resourceType: "AdminInvitation",
      resourceId: invitation.id,
      description: `Attempted to use revoked invitation token for email ${invitation.email}`,
      status: "FAILURE",
    });
    throw AppError.badRequest(
      "This invitation has been revoked by an administrator. Please contact your administrator for a new invitation."
    );
  }

  if (invitation.status === AdminInvitationStatus.ACCEPTED) {
    await auditService.record({
      action: "ACCEPTED_TOKEN_REUSE_ATTEMPT",
      resourceType: "AdminInvitation",
      resourceId: invitation.id,
      description: `Attempted to reuse already accepted invitation token for email ${invitation.email}`,
      status: "FAILURE",
    });
    throw AppError.badRequest(
      "This invitation link has already been used. Please log in with your account credentials."
    );
  }

  if (invitation.status === AdminInvitationStatus.EXPIRED || invitation.expiresAt < new Date()) {
    if (invitation.status === AdminInvitationStatus.PENDING) {
      await prisma.adminInvitation.update({
        where: { id: invitation.id },
        data: { status: AdminInvitationStatus.EXPIRED },
      });
    }

    await auditService.record({
      action: "EXPIRED_TOKEN_USAGE_ATTEMPT",
      resourceType: "AdminInvitation",
      resourceId: invitation.id,
      description: `Attempted to use expired invitation token for email ${invitation.email} (Expired at: ${formatUTCDateTime(invitation.expiresAt)})`,
      status: "FAILURE",
    });
    throw AppError.badRequest(
      "This invitation link has expired. Please ask an administrator to send a new invitation."
    );
  }

  return toPublicInvitation(invitation);
}

async function acceptInvitation(input: AcceptInvitationInput) {
  const { token, password } = input;
  const inv = await validateToken(token);

  const emailAddr = inv.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: emailAddr } });
  if (!user || user.status !== UserStatus.INVITATION_PENDING) {
    throw AppError.badRequest("No pending account found matching this invitation.");
  }

  // Hash new password using existing password hasher
  const passwordHash = await hashPassword(password);

  // Activate Admin user account
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // Apply custom permissions if configured in invitation
  if (inv.customPermissions && Array.isArray(inv.customPermissions) && inv.customPermissions.length > 0) {
    for (const permSlug of inv.customPermissions) {
      await prisma.adminPermissionOverride.upsert({
        where: {
          adminId_permission: {
            adminId: user.id,
            permission: permSlug,
          },
        },
        create: {
          adminId: user.id,
          permission: permSlug,
          effect: "ALLOW",
          reason: "Assigned during admin invitation setup",
          createdById: inv.invitedById,
        },
        update: {
          effect: "ALLOW",
          reason: "Assigned during admin invitation setup",
        },
      });
    }
  }

  // Mark invitation as ACCEPTED & set acceptedAt timestamp
  await prisma.adminInvitation.update({
    where: { id: inv.id },
    data: {
      status: AdminInvitationStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  await auditService.record({
    actorId: updatedUser.id,
    actorEmail: updatedUser.email,
    action: "ADMIN_INVITATION_ACCEPTED",
    resourceType: "AdminInvitation",
    resourceId: inv.id,
    description: `Admin ${updatedUser.email} successfully activated account and set secure password.`,
  });

  await auditService.record({
    actorId: updatedUser.id,
    actorEmail: updatedUser.email,
    action: "ADMIN_ACTIVATED",
    resourceType: "User",
    resourceId: updatedUser.id,
    description: `Administrator account ${updatedUser.email} activated from pending invitation.`,
  });

  return { success: true, email: updatedUser.email };
}

export const invitationService = {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  validateToken,
  acceptInvitation,
};
