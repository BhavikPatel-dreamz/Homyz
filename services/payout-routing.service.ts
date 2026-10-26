import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { Role, BookingStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import {
  decryptAccountIdentifier,
} from "@/lib/security/payout-encryption";
import {
  calculateBookingPayout,
  getHostPayoutMethods,
  type HostPayoutMethod,
} from "@/services/payout.service";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PayoutRoutingRuleDTO {
  id: string;
  hostId: string;
  listingId: string;
  listingTitle?: string;
  recipientUserId: string;
  recipientName?: string;
  recipientEmail?: string | null;
  isCoHost: boolean;
  payoutMethodId: string;
  payoutMethodMasked?: string;
  bankName?: string;
  ruleType: "LISTING_DEFAULT" | "PERCENTAGE_SPLIT";
  allocationPercentage: number;
  status: "ACTIVE" | "DISABLED";
  effectiveFrom: string;
  effectiveUntil?: string | null;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSplitInputItem {
  recipientUserId: string;
  payoutMethodId: string;
  allocationPercentage: number;
  ruleType?: "LISTING_DEFAULT" | "PERCENTAGE_SPLIT";
}

export interface ListingEligibleRecipientDTO {
  userId: string;
  name: string;
  email: string | null;
  role: "PRIMARY_HOST" | "CO_HOST";
  verifiedPayoutMethods: Array<{
    id: string;
    bankName: string;
    ibanMasked: string;
    currency: string;
    isDefault: boolean;
  }>;
}

export interface CalculatedSplitItem {
  recipientUserId: string;
  recipientName: string;
  isCoHost: boolean;
  payoutMethodId: string;
  payoutMethodMasked: string;
  bankName: string;
  allocationPercentage: number;
  amountCents: number; // In minor units (halalas / cents)
  currency: string;
  routingRuleId?: string;
}

export interface BookingDistributionDTO {
  id: string;
  bookingId: string;
  listingId: string;
  recipientUserId: string;
  recipientName?: string;
  isCoHost: boolean;
  payoutMethodId: string;
  payoutMethodMasked: string;
  bankName: string;
  amountCents: number;
  currency: string;
  percentage: number;
  status: string;
  isHeld: boolean;
  holdType?: string | null;
  holdReason?: string | null;
  batchReference?: string | null;
  settlementReference?: string | null;
  exportedAt?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Retrieves all eligible recipients (primary host + accepted co-hosts)
 * for a listing along with their active verified payout methods.
 */
export async function getListingEligibleRecipients(
  hostId: string,
  listingId: string,
): Promise<ListingEligibleRecipientDTO[]> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      hostId: true,
      host: { select: { id: true, name: true, email: true } },
    },
  });

  if (!listing || listing.hostId !== hostId) {
    throw AppError.forbidden("Listing not found or access denied.");
  }

  const results: ListingEligibleRecipientDTO[] = [];

  // 1. Primary Host
  const hostMethods = await prisma.hostPayoutMethod.findMany({
    where: { hostId, status: "VERIFIED", disabledAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  results.push({
    userId: hostId,
    name: listing.host.name || "Primary Host",
    email: listing.host.email,
    role: "PRIMARY_HOST",
    verifiedPayoutMethods: hostMethods.map((m) => ({
      id: m.id,
      bankName: m.bankName,
      ibanMasked: m.ibanMasked,
      currency: m.currency,
      isDefault: m.isDefault,
    })),
  });

  // 2. Accepted Co-Hosts
  const coHosts = await prisma.listingCoHost.findMany({
    where: {
      listingId,
      status: "ACCEPTED",
      userId: { not: null },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  for (const ch of coHosts) {
    if (!ch.user) continue;
    const chMethods = await prisma.hostPayoutMethod.findMany({
      where: { hostId: ch.user.id, status: "VERIFIED", disabledAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    results.push({
      userId: ch.user.id,
      name: ch.user.name || "Co-Host",
      email: ch.user.email,
      role: "CO_HOST",
      verifiedPayoutMethods: chMethods.map((m) => ({
        id: m.id,
        bankName: m.bankName,
        ibanMasked: m.ibanMasked,
        currency: m.currency,
        isDefault: m.isDefault,
      })),
    });
  }

  return results;
}

/**
 * Retrieves all payout routing rules belonging to a host, optionally filtered by listing.
 */
export async function getListingRoutingRules(
  hostId: string,
  listingId?: string,
): Promise<PayoutRoutingRuleDTO[]> {
  const where: any = { hostId };
  if (listingId) {
    where.listingId = listingId;
  }

  const rules = await prisma.payoutRoutingRule.findMany({
    where,
    include: {
      listing: { select: { id: true, title: true } },
      recipientUser: { select: { id: true, name: true, email: true } },
      payoutMethod: { select: { id: true, bankName: true, ibanMasked: true } },
    },
    orderBy: [{ listingId: "asc" }, { status: "asc" }, { createdAt: "desc" }],
  });

  return rules.map((r) => ({
    id: r.id,
    hostId: r.hostId,
    listingId: r.listingId,
    listingTitle: r.listing?.title || "Property",
    recipientUserId: r.recipientUserId,
    recipientName: r.recipientUser?.name || "Recipient",
    recipientEmail: r.recipientUser?.email,
    isCoHost: r.recipientUserId !== r.hostId,
    payoutMethodId: r.payoutMethodId,
    payoutMethodMasked: r.payoutMethod?.ibanMasked,
    bankName: r.payoutMethod?.bankName,
    ruleType: r.ruleType,
    allocationPercentage: r.allocationPercentage,
    status: r.status,
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveUntil: r.effectiveUntil?.toISOString() || null,
    disabledAt: r.disabledAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Atomically configures and saves the payout distribution rules for a listing.
 * Strict FinTech validation:
 * - Listing ownership verification.
 * - Authorized recipient verification (Primary host or accepted co-host).
 * - Verified payout destination check.
 * - Mathematical precision check: Sum of allocations must equal exactly 100.0%.
 */
export async function saveListingRoutingRules(
  hostId: string,
  listingId: string,
  rules: ListingSplitInputItem[],
  actor?: AuthUser,
): Promise<PayoutRoutingRuleDTO[]> {
  // 1. Verify listing ownership
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, hostId: true, title: true },
  });

  if (!listing || listing.hostId !== hostId) {
    throw AppError.forbidden("Listing not found or access denied.");
  }

  if (!Array.isArray(rules) || rules.length === 0) {
    throw AppError.badRequest("At least one routing rule is required.");
  }

  // 2. Mathematical allocation check
  let totalPct = 0;
  for (const r of rules) {
    if (typeof r.allocationPercentage !== "number" || isNaN(r.allocationPercentage)) {
      throw AppError.badRequest("Allocation percentage must be a valid number.");
    }
    if (r.allocationPercentage <= 0 || r.allocationPercentage > 100) {
      throw AppError.badRequest(
        `Allocation percentage must be greater than 0% and at most 100%. Received: ${r.allocationPercentage}%`,
      );
    }
    totalPct += r.allocationPercentage;
  }

  if (Math.abs(totalPct - 100.0) > 0.001) {
    throw AppError.badRequest(
      `Total allocation percentage across all recipients must equal exactly 100%. Current sum: ${totalPct.toFixed(1)}%`,
    );
  }

  // 3. Verify recipient eligibility and payout methods
  for (const r of rules) {
    // Check if co-host
    if (r.recipientUserId !== hostId) {
      const coHost = await prisma.listingCoHost.findFirst({
        where: {
          listingId,
          userId: r.recipientUserId,
          status: "ACCEPTED",
        },
      });
      if (!coHost) {
        throw AppError.badRequest(
          `Recipient ${r.recipientUserId} is not an authorized accepted co-host for this listing.`,
        );
      }
    }

    // Check payout method verification
    const method = await prisma.hostPayoutMethod.findFirst({
      where: {
        id: r.payoutMethodId,
        hostId: r.recipientUserId,
        status: "VERIFIED",
        disabledAt: null,
      },
    });

    if (!method) {
      throw AppError.badRequest(
        `Payout destination ${r.payoutMethodId} is not a verified active account for recipient ${r.recipientUserId}.`,
      );
    }
  }

  const now = new Date();
  const ruleType = rules.length > 1 ? "PERCENTAGE_SPLIT" : "LISTING_DEFAULT";

  // 4. Atomic transaction: disable prior active rules and insert new rules
  await prisma.$transaction(async (tx) => {
    // Soft-disable existing active rules for this listing
    await tx.payoutRoutingRule.updateMany({
      where: { listingId, status: "ACTIVE" },
      data: {
        status: "DISABLED",
        disabledAt: now,
        effectiveUntil: now,
      },
    });

    // Create new active rules
    for (const r of rules) {
      await tx.payoutRoutingRule.create({
        data: {
          hostId,
          listingId,
          recipientUserId: r.recipientUserId,
          payoutMethodId: r.payoutMethodId,
          ruleType: r.ruleType || ruleType,
          allocationPercentage: r.allocationPercentage,
          status: "ACTIVE",
          effectiveFrom: now,
          createdBy: actor?.id || hostId,
        },
      });
    }
  });

  // Record audit trail
  await auditService.record({
    actorId: actor?.id || hostId,
    actorEmail: actor?.email,
    action: "PAYOUT_ROUTING_RULES_UPDATED",
    resourceType: "LISTING",
    resourceId: listingId,
    description: `Payout routing rules updated for listing "${listing.title || listingId}" (${rules.length} rule(s), 100% total).`,
    status: "SUCCESS",
    metadata: {
      listingId,
      rulesCount: rules.length,
      recipients: rules.map((r) => ({
        recipientUserId: r.recipientUserId,
        percentage: r.allocationPercentage,
      })),
    },
  });

  return getListingRoutingRules(hostId, listingId);
}

/**
 * Disables all active routing rules for a listing, reverting it to the host default payout method.
 */
export async function disableListingRoutingRules(
  hostId: string,
  listingId: string,
  actor?: AuthUser,
): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, hostId: true, title: true },
  });

  if (!listing || listing.hostId !== hostId) {
    throw AppError.forbidden("Listing not found or access denied.");
  }

  const now = new Date();
  await prisma.payoutRoutingRule.updateMany({
    where: { listingId, status: "ACTIVE" },
    data: {
      status: "DISABLED",
      disabledAt: now,
      effectiveUntil: now,
    },
  });

  await auditService.record({
    actorId: actor?.id || hostId,
    actorEmail: actor?.email,
    action: "PAYOUT_ROUTING_RULES_REVERTED_DEFAULT",
    resourceType: "LISTING",
    resourceId: listingId,
    description: `Payout routing rules removed for listing "${listing.title || listingId}". Reverted to default host payout account.`,
    status: "SUCCESS",
    metadata: { listingId },
  });
}

/**
 * Calculates deterministic percentage-based payout splits for a booking.
 * Guarantees:
 * - Deterministic integer minor unit (halala) distribution.
 * - Sum of individual allocations === exact net payout amount (zero money created or lost).
 * - Remainder halalas from floor division are allocated to the primary host.
 */
export async function calculateDistributionForBooking(
  booking: any,
  netPayoutMinorUnits: number,
  options: {
    hostPayoutMethods?: HostPayoutMethod[];
  } = {},
): Promise<CalculatedSplitItem[]> {
  const listingId = booking.listingId;
  const primaryHostId = booking.listing?.hostId || booking.listing?.host?.id;

  if (netPayoutMinorUnits <= 0) {
    return [];
  }

  // 1. Check for active routing rules for this listing
  const activeRules = await prisma.payoutRoutingRule.findMany({
    where: { listingId, status: "ACTIVE" },
    include: {
      recipientUser: { select: { id: true, name: true } },
      payoutMethod: { select: { id: true, bankName: true, ibanMasked: true } },
    },
    orderBy: { allocationPercentage: "desc" },
  });

  const sumPct = activeRules.reduce((acc, r) => acc + r.allocationPercentage, 0);
  const isValidSplit = activeRules.length > 0 && Math.abs(sumPct - 100.0) < 0.001;

  if (isValidSplit) {
    let allocatedTotal = 0;
    const splits: CalculatedSplitItem[] = [];

    for (const rule of activeRules) {
      // Minor unit allocation via integer floor
      const share = Math.floor(
        (netPayoutMinorUnits * rule.allocationPercentage) / 100,
      );
      allocatedTotal += share;

      splits.push({
        recipientUserId: rule.recipientUserId,
        recipientName: rule.recipientUser?.name || "Recipient",
        isCoHost: rule.recipientUserId !== primaryHostId,
        payoutMethodId: rule.payoutMethodId,
        payoutMethodMasked: rule.payoutMethod.ibanMasked,
        bankName: rule.payoutMethod.bankName,
        allocationPercentage: rule.allocationPercentage,
        amountCents: share,
        currency: booking.currency || "SAR",
        routingRuleId: rule.id,
      });
    }

    // Remainder handling: allocate any remaining halalas to the primary host
    const remainder = netPayoutMinorUnits - allocatedTotal;
    if (remainder > 0) {
      const primarySplit =
        splits.find((s) => s.recipientUserId === primaryHostId) || splits[0];
      if (primarySplit) {
        primarySplit.amountCents += remainder;
      }
    }

    return splits;
  }

  // 2. Default Fallback: 100% to Primary Host's default verified method
  let defaultMethod: HostPayoutMethod | undefined;
  if (options.hostPayoutMethods && options.hostPayoutMethods.length > 0) {
    defaultMethod =
      options.hostPayoutMethods.find((m) => m.isDefault && m.status === "VERIFIED") ||
      options.hostPayoutMethods.find((m) => m.status === "VERIFIED") ||
      options.hostPayoutMethods[0];
  } else if (primaryHostId) {
    const methods = await getHostPayoutMethods(primaryHostId);
    defaultMethod =
      methods.find((m) => m.isDefault && m.status === "VERIFIED") ||
      methods.find((m) => m.status === "VERIFIED") ||
      methods[0];
  }

  const primaryName =
    booking.listing?.host?.name ||
    defaultMethod?.accountHolderName ||
    "Primary Host";

  return [
    {
      recipientUserId: primaryHostId,
      recipientName: primaryName,
      isCoHost: false,
      payoutMethodId: defaultMethod?.id || "default_unassigned",
      payoutMethodMasked: defaultMethod?.ibanMasked || "SA** **** **** **** 0000",
      bankName: defaultMethod?.bankName || "Commercial Bank",
      allocationPercentage: 100.0,
      amountCents: netPayoutMinorUnits,
      currency: booking.currency || "SAR",
    },
  ];
}

/**
 * Creates or retrieves committed BookingPayoutDistribution rows.
 * Guarantees historical immutability: once distributions are created,
 * subsequent routing rule changes do not retroactively alter the allocation.
 */
export async function createOrGetBookingDistributions(
  bookingId: string,
): Promise<BookingDistributionDTO[]> {
  // 1. Check if distributions already committed
  const existing = await prisma.bookingPayoutDistribution.findMany({
    where: { bookingId },
    include: {
      recipientUser: { select: { id: true, name: true, email: true } },
      payoutMethod: { select: { id: true, bankName: true, ibanMasked: true } },
    },
    orderBy: [{ percentage: "desc" }, { createdAt: "asc" }],
  });

  if (existing.length > 0) {
    return existing.map((d) => ({
      id: d.id,
      bookingId: d.bookingId,
      listingId: d.listingId,
      recipientUserId: d.recipientUserId,
      recipientName: d.recipientUser?.name || "Recipient",
      isCoHost: d.recipientUserId !== d.bookingId, // resolved via listing in query
      payoutMethodId: d.payoutMethodId,
      payoutMethodMasked: d.payoutMethod?.ibanMasked || "SA** ****",
      bankName: d.payoutMethod?.bankName || "Commercial Bank",
      amountCents: d.amountCents,
      currency: d.currency,
      percentage: d.percentage,
      status: d.status,
      isHeld: d.isHeld,
      holdType: d.holdType,
      holdReason: d.holdReason,
      batchReference: d.batchReference,
      settlementReference: d.settlementReference,
      exportedAt: d.exportedAt?.toISOString() || null,
      paidAt: d.paidAt?.toISOString() || null,
      failureReason: d.failureReason,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  // 2. Not yet committed: fetch booking, evaluate calculation and create snapshot
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: true,
      refunds: true,
      qualityIncidents: true,
      listing: {
        include: {
          host: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!booking) {
    throw AppError.notFound(`Booking ${bookingId} not found.`);
  }

  const calc = calculateBookingPayout(booking);
  if (calc.netPayout <= 0) {
    return [];
  }

  const splits = await calculateDistributionForBooking(booking, calc.netPayout);
  const isHeld = Boolean(calc.holdDetails?.isHeld);
  const initialStatus = isHeld
    ? "ON_HOLD"
    : calc.status === "ELIGIBLE_SETTLEMENT"
    ? "ELIGIBLE_SETTLEMENT"
    : "SCHEDULED";

  const created = await prisma.$transaction(async (tx) => {
    // Validate that all payoutMethodIds exist in HostPayoutMethod to satisfy FK constraint
    for (const split of splits) {
      const exists = await tx.hostPayoutMethod.findUnique({
        where: { id: split.payoutMethodId },
        select: { id: true },
      });
      if (!exists) {
        // Relational payout method does not exist; avoid foreign key violation
        return null;
      }
    }

    const list: any[] = [];
    for (const split of splits) {
      const dist = await tx.bookingPayoutDistribution.create({
        data: {
          bookingId,
          listingId: booking.listingId,
          recipientUserId: split.recipientUserId,
          payoutMethodId: split.payoutMethodId,
          routingRuleId: split.routingRuleId,
          amountCents: split.amountCents,
          currency: split.currency,
          percentage: split.allocationPercentage,
          status: initialStatus,
          isHeld,
          holdType: calc.holdDetails?.holdType,
          holdReason: calc.holdDetails?.reason,
          heldAt: isHeld ? new Date() : null,
          heldBy: calc.holdDetails?.heldBy,
        },
        include: {
          recipientUser: { select: { id: true, name: true, email: true } },
          payoutMethod: { select: { id: true, bankName: true, ibanMasked: true } },
        },
      });
      list.push(dist);
    }
    return list;
  });

  if (!created) {
    return [];
  }

  return created.map((d) => ({
    id: d.id,
    bookingId: d.bookingId,
    listingId: d.listingId,
    recipientUserId: d.recipientUserId,
    recipientName: d.recipientUser?.name || "Recipient",
    isCoHost: d.recipientUserId !== booking.listing.hostId,
    payoutMethodId: d.payoutMethodId,
    payoutMethodMasked: d.payoutMethod?.ibanMasked || "SA** ****",
    bankName: d.payoutMethod?.bankName || "Commercial Bank",
    amountCents: d.amountCents,
    currency: d.currency,
    percentage: d.percentage,
    status: d.status,
    isHeld: d.isHeld,
    holdType: d.holdType,
    holdReason: d.holdReason,
    batchReference: d.batchReference,
    settlementReference: d.settlementReference,
    exportedAt: d.exportedAt?.toISOString() || null,
    paidAt: d.paidAt?.toISOString() || null,
    failureReason: d.failureReason,
    createdAt: d.createdAt.toISOString(),
  }));
}

/**
 * Administrative action to confirm batch settlement results (e.g. following bank processing).
 */
export async function confirmBatchSettlement(
  adminActor: AuthUser,
  batchReference: string,
  status: "PAID" | "FAILED",
  reason?: string,
): Promise<{ updatedCount: number; batchReference: string; status: string }> {
  assertRole(adminActor, [Role.ADMIN]);

  if (!batchReference?.trim()) {
    throw AppError.badRequest("Batch reference is required.");
  }

  const now = new Date();
  const updateData: any = {
    status,
    updatedAt: now,
  };

  if (status === "PAID") {
    updateData.paidAt = now;
    updateData.failureReason = null;
  } else {
    updateData.failureReason = reason || "Bank transfer rejected during settlement execution.";
  }

  const result = await prisma.bookingPayoutDistribution.updateMany({
    where: {
      batchReference: batchReference.trim(),
    },
    data: updateData,
  });

  if (result.count === 0) {
    throw AppError.notFound(`No settlement instructions found for batch ${batchReference}.`);
  }

  await auditService.record({
    actorId: adminActor.id,
    actorEmail: adminActor.email,
    action: "BATCH_SETTLEMENT_CONFIRMED",
    resourceType: "PAYOUT_BATCH",
    resourceId: batchReference,
    description: `Batch settlement ${batchReference} updated to ${status} (${result.count} distribution records).`,
    status: "SUCCESS",
    metadata: {
      batchReference,
      status,
      updatedCount: result.count,
      reason,
    },
  });

  return {
    updatedCount: result.count,
    batchReference,
    status,
  };
}

export const payoutRoutingService = {
  getListingEligibleRecipients,
  getListingRoutingRules,
  saveListingRoutingRules,
  disableListingRoutingRules,
  calculateDistributionForBooking,
  createOrGetBookingDistributions,
  confirmBatchSettlement,
};
