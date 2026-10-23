import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";
import { invalidateUserCache } from "@/lib/redis/invalidation";
import {
  getHostDashboardEntitlementsForHost,
  type HostDashboardEntitlements,
  type HostDashboardGrantDetails,
} from "@/lib/entitlements/host-dashboard";

export interface GrantComplimentaryPlusInput {
  hostId: string;
  adminId: string;
  adminEmail?: string | null;
  startsAt?: Date;
  expiresAt?: Date | null;
  reason?: string | null;
  notes?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RevokeComplimentaryPlusInput {
  hostId: string;
  adminId: string;
  adminEmail?: string | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface UpdateGrantExpirationInput {
  hostId: string;
  adminId: string;
  adminEmail?: string | null;
  expiresAt: Date | null;
  reason?: string | null;
  notes?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface HostEntitlementSummary {
  host: {
    id: string;
    name: string | null;
    email: string | null;
    status: string;
    role: string;
  };
  entitlements: HostDashboardEntitlements;
  activeGrant: HostDashboardGrantDetails | null;
  latestGrant: HostDashboardGrantDetails | null;
  grantHistory: HostDashboardGrantDetails[];
}

export class HostEntitlementService {
  /**
   * Retrieves full entitlement overview for a host including grant history
   */
  async getHostEntitlementSummary(hostId: string): Promise<HostEntitlementSummary> {
    const host = await prisma.user.findUnique({
      where: { id: hostId },
      select: { id: true, name: true, email: true, status: true, role: true },
    });

    if (!host) {
      throw AppError.notFound(`Host with ID ${hostId} not found`);
    }

    const [entitlements, history] = await Promise.all([
      getHostDashboardEntitlementsForHost(hostId),
      prisma.hostEntitlementGrant.findMany({
        where: { hostId, featureKey: "DASHBOARD_PLUS" },
        include: {
          grantedBy: { select: { id: true, name: true, email: true } },
          revokedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }).catch(() => []),
    ]);

    const formattedHistory: HostDashboardGrantDetails[] = history.map((g) => ({
      id: g.id,
      hostId: g.hostId,
      featureKey: g.featureKey,
      source: g.source,
      status: g.status,
      startsAt: g.startsAt.toISOString(),
      expiresAt: g.expiresAt ? g.expiresAt.toISOString() : null,
      grantedById: g.grantedById,
      grantedByAdmin: g.grantedBy,
      revokedById: g.revokedById,
      revokedByAdmin: g.revokedBy,
      revokedAt: g.revokedAt ? g.revokedAt.toISOString() : null,
      reason: g.reason,
      notes: g.notes,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }));

    const activeGrant = formattedHistory.find((g) => g.status === "ACTIVE") ?? null;
    const latestGrant = formattedHistory[0] ?? null;

    return {
      host,
      entitlements,
      activeGrant,
      latestGrant,
      grantHistory: formattedHistory,
    };
  }

  /**
   * Grants complimentary Dashboard Plus (indefinite or temporary with expiration date)
   */
  async grantComplimentaryPlus(input: GrantComplimentaryPlusInput): Promise<HostEntitlementSummary> {
    const host = await prisma.user.findUnique({
      where: { id: input.hostId },
      select: { id: true, name: true, email: true, status: true, role: true },
    });

    if (!host) {
      throw AppError.notFound(`Host with ID ${input.hostId} not found`);
    }

    const previousEntitlements = await getHostDashboardEntitlementsForHost(input.hostId);

    // Atomically deactivate any active existing grants so no contradictory grants exist
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.hostEntitlementGrant.updateMany({
        where: {
          hostId: input.hostId,
          featureKey: "DASHBOARD_PLUS",
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          revokedById: input.adminId,
          revokedAt: now,
          reason: "Superseded by new admin grant",
        },
      });

      await tx.hostEntitlementGrant.create({
        data: {
          hostId: input.hostId,
          featureKey: "DASHBOARD_PLUS",
          source: "ADMIN",
          status: "ACTIVE",
          startsAt: input.startsAt ?? now,
          expiresAt: input.expiresAt ?? null,
          grantedById: input.adminId,
          reason: input.reason?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    });

    // Invalidate cached permissions and profile
    await invalidateUserCache(input.hostId);

    const updatedSummary = await this.getHostEntitlementSummary(input.hostId);

    // Record audit log
    await auditService.record({
      actorId: input.adminId,
      actorEmail: input.adminEmail ?? null,
      action: "HOST_DASHBOARD_PLUS_GRANTED",
      resourceType: "HOST",
      resourceId: input.hostId,
      description: `Granted ${input.expiresAt ? "temporary" : "complimentary"} Dashboard Plus access to host ${host.name || host.email || host.id} (${input.expiresAt ? `Expires: ${input.expiresAt.toISOString()}` : "Indefinite"})`,
      status: "SUCCESS",
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        hostId: input.hostId,
        hostEmail: host.email,
        previousAccessStatus: previousEntitlements.accessStatus,
        newAccessStatus: updatedSummary.entitlements.accessStatus,
        startsAt: (input.startsAt ?? now).toISOString(),
        expiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
        reason: input.reason?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    return updatedSummary;
  }

  /**
   * Revokes complimentary Dashboard Plus access.
   * If the host has an independent active paid subscription, that paid entitlement is preserved.
   */
  async revokeComplimentaryPlus(input: RevokeComplimentaryPlusInput): Promise<HostEntitlementSummary> {
    const host = await prisma.user.findUnique({
      where: { id: input.hostId },
      select: { id: true, name: true, email: true, status: true, role: true },
    });

    if (!host) {
      throw AppError.notFound(`Host with ID ${input.hostId} not found`);
    }

    const previousEntitlements = await getHostDashboardEntitlementsForHost(input.hostId);

    const now = new Date();
    await prisma.hostEntitlementGrant.updateMany({
      where: {
        hostId: input.hostId,
        featureKey: "DASHBOARD_PLUS",
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedById: input.adminId,
        revokedAt: now,
        reason: input.reason?.trim() || "Revoked by administrator",
      },
    });

    // Invalidate caches
    await invalidateUserCache(input.hostId);

    const updatedSummary = await this.getHostEntitlementSummary(input.hostId);

    // Record audit log
    await auditService.record({
      actorId: input.adminId,
      actorEmail: input.adminEmail ?? null,
      action: "HOST_DASHBOARD_PLUS_REVOKED",
      resourceType: "HOST",
      resourceId: input.hostId,
      description: `Revoked complimentary Dashboard Plus access for host ${host.name || host.email || host.id}`,
      status: "SUCCESS",
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        hostId: input.hostId,
        hostEmail: host.email,
        previousAccessStatus: previousEntitlements.accessStatus,
        newAccessStatus: updatedSummary.entitlements.accessStatus,
        reason: input.reason?.trim() || null,
      },
    });

    return updatedSummary;
  }

  /**
   * Sets host to Standard Only:
   * Revokes any admin-granted complimentary Plus access.
   * If the host also has an active paid Plus subscription, does not silently cancel or override that paid entitlement.
   */
  async setStandardOnly(input: RevokeComplimentaryPlusInput): Promise<HostEntitlementSummary> {
    return this.revokeComplimentaryPlus({
      ...input,
      reason: input.reason?.trim() || "Reset to Standard access by administrator",
    });
  }

  /**
   * Updates expiration date of an active grant
   */
  async updateGrantExpiration(input: UpdateGrantExpirationInput): Promise<HostEntitlementSummary> {
    const host = await prisma.user.findUnique({
      where: { id: input.hostId },
      select: { id: true, name: true, email: true, status: true, role: true },
    });

    if (!host) {
      throw AppError.notFound(`Host with ID ${input.hostId} not found`);
    }

    const activeGrant = await prisma.hostEntitlementGrant.findFirst({
      where: { hostId: input.hostId, featureKey: "DASHBOARD_PLUS", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!activeGrant) {
      throw AppError.badRequest("Host does not have an active complimentary grant to update");
    }

    const previousEntitlements = await getHostDashboardEntitlementsForHost(input.hostId);

    await prisma.hostEntitlementGrant.update({
      where: { id: activeGrant.id },
      data: {
        expiresAt: input.expiresAt,
        reason: input.reason?.trim() || activeGrant.reason,
        notes: input.notes?.trim() || activeGrant.notes,
      },
    });

    await invalidateUserCache(input.hostId);

    const updatedSummary = await this.getHostEntitlementSummary(input.hostId);

    await auditService.record({
      actorId: input.adminId,
      actorEmail: input.adminEmail ?? null,
      action: "HOST_DASHBOARD_PLUS_EXPIRATION_UPDATED",
      resourceType: "HOST",
      resourceId: input.hostId,
      description: `Updated Dashboard Plus expiration for host ${host.name || host.email || host.id} to ${input.expiresAt ? input.expiresAt.toISOString() : "Never"}`,
      status: "SUCCESS",
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        hostId: input.hostId,
        previousExpiresAt: activeGrant.expiresAt ? activeGrant.expiresAt.toISOString() : null,
        newExpiresAt: input.expiresAt ? input.expiresAt.toISOString() : null,
        previousAccessStatus: previousEntitlements.accessStatus,
        newAccessStatus: updatedSummary.entitlements.accessStatus,
        reason: input.reason?.trim() || null,
      },
    });

    return updatedSummary;
  }
}

export const hostEntitlementService = new HostEntitlementService();

