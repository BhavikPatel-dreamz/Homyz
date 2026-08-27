import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";

export interface UnifiedSessionDTO {
  id: string;
  type: "web" | "mobile";
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string;
  ip: string | null;
  userAgent: string | null;
  deviceInfo: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

function parseDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device";
  if (/mobile|android|iphone|ipad/i.test(userAgent)) {
    if (/iphone/i.test(userAgent)) return "Apple iPhone";
    if (/ipad/i.test(userAgent)) return "Apple iPad";
    if (/android/i.test(userAgent)) return "Android Device";
    return "Mobile Device";
  }
  if (/macintosh|mac os x/i.test(userAgent)) return "Mac (macOS)";
  if (/windows/i.test(userAgent)) return "Windows PC";
  if (/linux/i.test(userAgent)) return "Linux PC";
  return "Desktop Browser";
}

async function listForUser(userId: string): Promise<UnifiedSessionDTO[]> {
  const [webSessions, refreshTokens] = await Promise.all([
    prisma.session.findMany({
      where: { userId, isRevoked: false, expires: { gt: new Date() } },
      orderBy: { lastActiveAt: "desc" },
    }),
    prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const list: UnifiedSessionDTO[] = [
    ...webSessions.map((s) => ({
      id: s.id,
      type: "web" as const,
      userId: s.userId,
      ip: s.ip,
      userAgent: s.userAgent,
      deviceInfo: parseDevice(s.userAgent),
      createdAt: s.lastActiveAt, // Web sessions track lastActiveAt
      lastActiveAt: s.lastActiveAt,
      expiresAt: s.expires,
      isRevoked: s.isRevoked,
    })),
    ...refreshTokens.map((r) => ({
      id: r.id,
      type: "mobile" as const,
      userId: r.userId,
      ip: r.ip,
      userAgent: r.userAgent,
      deviceInfo: parseDevice(r.userAgent),
      createdAt: r.createdAt,
      lastActiveAt: r.createdAt,
      expiresAt: r.expiresAt,
      isRevoked: Boolean(r.revokedAt),
    })),
  ];

  return list;
}

async function listAllActive(limit = 50): Promise<UnifiedSessionDTO[]> {
  const [webSessions, refreshTokens] = await Promise.all([
    prisma.session.findMany({
      where: { isRevoked: false, expires: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
      take: limit,
      orderBy: { lastActiveAt: "desc" },
    }),
    prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const list: UnifiedSessionDTO[] = [
    ...webSessions.map((s) => ({
      id: s.id,
      type: "web" as const,
      userId: s.userId,
      userEmail: s.user.email,
      userName: s.user.name,
      userRole: s.user.role,
      ip: s.ip,
      userAgent: s.userAgent,
      deviceInfo: parseDevice(s.userAgent),
      createdAt: s.lastActiveAt,
      lastActiveAt: s.lastActiveAt,
      expiresAt: s.expires,
      isRevoked: s.isRevoked,
    })),
    ...refreshTokens.map((r) => ({
      id: r.id,
      type: "mobile" as const,
      userId: r.userId,
      userEmail: r.user.email,
      userName: r.user.name,
      userRole: r.user.role,
      ip: r.ip,
      userAgent: r.userAgent,
      deviceInfo: parseDevice(r.userAgent),
      createdAt: r.createdAt,
      lastActiveAt: r.createdAt,
      expiresAt: r.expiresAt,
      isRevoked: Boolean(r.revokedAt),
    })),
  ];

  return list.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

async function revokeSession(sessionId: string, actorId?: string, actorEmail?: string): Promise<void> {
  // Check web session first
  const web = await prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (web) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true, expires: new Date(0) },
    });
    await auditService.record({
      actorId,
      actorEmail,
      action: "SESSION_REVOKED",
      resourceType: "Session",
      resourceId: sessionId,
      description: `Revoked web session for user ${web.user.email}`,
    });
    return;
  }

  // Check refresh token
  const mobile = await prisma.refreshToken.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (mobile) {
    await prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await auditService.record({
      actorId,
      actorEmail,
      action: "SESSION_REVOKED",
      resourceType: "RefreshToken",
      resourceId: sessionId,
      description: `Revoked mobile session for user ${mobile.user.email}`,
    });
    return;
  }

  throw AppError.notFound("Session not found");
}

async function revokeAllForUser(userId: string, currentSessionId?: string, actorId?: string, actorEmail?: string): Promise<void> {
  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
    prisma.session.updateMany({
      where: {
        userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { isRevoked: true, expires: new Date(0) },
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  await auditService.record({
    actorId,
    actorEmail,
    action: "ALL_SESSIONS_REVOKED",
    resourceType: "User",
    resourceId: userId,
    description: `Revoked all active sessions for user ${userId}`,
  });
}

export const sessionService = {
  listForUser,
  listAllActive,
  revokeSession,
  revokeAllForUser,
};
