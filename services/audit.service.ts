import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export interface CreateAuditLogParams {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  status?: "SUCCESS" | "FAILURE";
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListAuditLogsOptions {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  resourceType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface SecurityStats {
  totalLogins24h: number;
  failedLogins24h: number;
  successfulLogins24h: number;
  privilegeChanges7d: number;
  activeSessionsCount: number;
  recentSuspiciousEvents: Array<{
    id: string;
    action: string;
    description: string;
    actorEmail: string | null;
    ip: string | null;
    createdAt: Date;
  }>;
}

/**
 * Audit Service — captures security, auth, and administrative operations.
 * Designed to never crash caller logic if database recording hits a transient glitch.
 */
async function record(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        description: params.description,
        status: params.status ?? "SUCCESS",
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[audit.service] Failed to record audit log:", err);
  }
}

async function list(options: ListAuditLogsOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (options.action) {
    where.action = options.action;
  }
  if (options.resourceType) {
    where.resourceType = options.resourceType;
  }
  if (options.status) {
    where.status = options.status;
  }
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }
  if (options.search) {
    const q = options.search.trim();
    where.OR = [
      { actorEmail: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { resourceType: { contains: q, mode: "insensitive" } },
      { ip: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getSecurityStats(): Promise<SecurityStats> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    successfulLogins24h,
    failedLogins24h,
    privilegeChanges7d,
    activeWebSessions,
    activeRefreshTokens,
    recentSuspiciousEvents,
  ] = await Promise.all([
    prisma.auditLog.count({
      where: {
        action: { in: ["ADMIN_LOGIN", "USER_LOGIN"] },
        status: "SUCCESS",
        createdAt: { gte: oneDayAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: { in: ["LOGIN_FAILED", "ADMIN_LOGIN_FAILED"] },
        createdAt: { gte: oneDayAgo },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: { in: ["ROLE_CHANGED", "PERMISSION_CHANGED", "ADMIN_CREATED", "USER_DEACTIVATED"] },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.session.count({
      where: {
        isRevoked: false,
        expires: { gt: new Date() },
      },
    }),
    prisma.refreshToken.count({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [
          { status: "FAILURE" },
          {
            action: {
              in: [
                "LOGIN_FAILED",
                "ADMIN_LOGIN_FAILED",
                "USER_DEACTIVATED",
                "ROLE_CHANGED",
                "SESSION_REVOKED",
                "ADMIN_INVITATION_FAILED",
                "INVITATION_TOKEN_INVALID",
                "REVOKED_TOKEN_USAGE_ATTEMPT",
                "ACCEPTED_TOKEN_REUSE_ATTEMPT",
                "EXPIRED_TOKEN_USAGE_ATTEMPT",
              ],
            },
          },
        ],
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        description: true,
        actorEmail: true,
        ip: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalLogins24h: successfulLogins24h + failedLogins24h,
    successfulLogins24h,
    failedLogins24h,
    privilegeChanges7d,
    activeSessionsCount: activeWebSessions + activeRefreshTokens,
    recentSuspiciousEvents,
  };
}

export const auditService = {
  record,
  list,
  getSecurityStats,
};
