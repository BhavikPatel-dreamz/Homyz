import { Prisma } from "@/generated/prisma/client";
import {
  PointsLedgerEntryType,
  RewardDefinitionStatus,
  RewardRedemptionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

export const ZERO_CANCEL_PRO_BONUS_POINTS = 300;

export interface PointsBalance {
  available: number;
  pending: number;
  reserved: number;
}

export interface LedgerDelta {
  amount: number;
  availableDelta: number;
  pendingDelta: number;
  reservedDelta: number;
}

function positiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

/** A deterministic projection helper shared by tests and future read models. */
export function applyPointsLedgerDelta(balance: PointsBalance, delta: LedgerDelta): PointsBalance {
  positiveInteger(delta.amount, "Ledger amount");
  if (!delta.availableDelta && !delta.pendingDelta && !delta.reservedDelta) {
    throw new Error("A ledger entry must change at least one balance.");
  }
  const next = {
    available: balance.available + delta.availableDelta,
    pending: balance.pending + delta.pendingDelta,
    reserved: balance.reserved + delta.reservedDelta,
  };
  if (!Number.isSafeInteger(next.available) || !Number.isSafeInteger(next.pending) || !Number.isSafeInteger(next.reserved)) {
    throw new Error("Points balance overflow.");
  }
  if (next.available < 0 || next.pending < 0 || next.reserved < 0) {
    throw new Error("A points operation cannot create a negative balance.");
  }
  return next;
}

export function isPointsRedemptionEnabled(): boolean {
  // Both explicit feature activation and a reviewed policy version are required.
  // Neither is set by this change, so no checkout or public flow can redeem.
  return process.env.STAYELITE_POINTS_REDEMPTION_ENABLED === "true"
    && Boolean(process.env.STAYELITE_COMMERCIAL_POLICY_VERSION?.trim());
}

interface ReserveRewardInput {
  userId: string;
  rewardDefinitionId: string;
  idempotencyKey: string;
}

/**
 * Atomically reserves a catalog reward's stored point cost. This service has no
 * route and rejects calls until the policy/version gate is explicitly enabled.
 */
export async function reserveRewardRedemption(input: ReserveRewardInput) {
  if (!isPointsRedemptionEnabled()) {
    throw new Error("Points redemption is disabled pending commercial policy approval.");
  }
  if (!input.idempotencyKey.trim()) throw new Error("A redemption idempotency key is required.");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.rewardRedemption.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;

      const reward = await tx.rewardDefinition.findUnique({ where: { id: input.rewardDefinitionId } });
      const now = new Date();
      if (!reward || reward.status !== RewardDefinitionStatus.ACTIVE || !reward.pointsCost || reward.pointsCost <= 0) {
        throw new Error("Reward is not redeemable.");
      }
      if ((reward.startsAt && reward.startsAt > now) || (reward.endsAt && reward.endsAt <= now)) {
        throw new Error("Reward is outside its availability window.");
      }

      const account = await tx.pointsAccount.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId },
        update: {},
      });
      const reserved = await tx.pointsAccount.updateMany({
        where: { id: account.id, availableBalance: { gte: reward.pointsCost } },
        data: {
          availableBalance: { decrement: reward.pointsCost },
          reservedBalance: { increment: reward.pointsCost },
          version: { increment: 1 },
        },
      });
      if (reserved.count !== 1) throw new Error("Insufficient available points.");

      const ledger = await tx.pointsLedgerEntry.create({
        data: {
          accountId: account.id,
          userId: input.userId,
          type: PointsLedgerEntryType.REDEEM_RESERVE,
          amount: reward.pointsCost,
          availableDelta: -reward.pointsCost,
          reservedDelta: reward.pointsCost,
          sourceType: "REWARD_REDEMPTION",
          sourceReference: input.idempotencyKey,
          idempotencyKey: `points:reserve:${input.idempotencyKey}`,
          policyVersion: reward.policyVersion,
        },
      });
      return tx.rewardRedemption.create({
        data: {
          userId: input.userId,
          rewardDefinitionId: reward.id,
          status: RewardRedemptionStatus.RESERVED,
          pointsCostSnapshot: reward.pointsCost,
          policyVersion: reward.policyVersion,
          reservationLedgerEntryId: ledger.id,
          idempotencyKey: input.idempotencyKey,
          reservedAt: now,
        },
      });
    });
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    const existing = await prisma.rewardRedemption.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    throw error;
  }
}

async function settleReservedRedemption(
  redemptionId: string,
  idempotencyKey: string,
  type: "REDEEM_COMMIT" | "REDEEM_RELEASE",
) {
  if (!isPointsRedemptionEnabled()) {
    throw new Error("Points redemption is disabled pending commercial policy approval.");
  }
  if (!idempotencyKey.trim()) throw new Error("A settlement idempotency key is required.");

  return prisma.$transaction(async (tx) => {
    const existingEntry = await tx.pointsLedgerEntry.findUnique({ where: { idempotencyKey } });
    if (existingEntry) return tx.rewardRedemption.findUniqueOrThrow({ where: { id: redemptionId } });

    const redemption = await tx.rewardRedemption.findUniqueOrThrow({ where: { id: redemptionId } });
    const transition = await tx.rewardRedemption.updateMany({
      where: { id: redemption.id, status: RewardRedemptionStatus.RESERVED },
      data: type === PointsLedgerEntryType.REDEEM_COMMIT
        ? { status: RewardRedemptionStatus.REDEEMED, redeemedAt: new Date() }
        : { status: RewardRedemptionStatus.CANCELLED, cancelledAt: new Date() },
    });
    if (transition.count !== 1) throw new Error("Reward redemption is not reserved.");

    const account = await tx.pointsAccount.findUniqueOrThrow({ where: { userId: redemption.userId } });
    const updated = await tx.pointsAccount.updateMany({
      where: { id: account.id, reservedBalance: { gte: redemption.pointsCostSnapshot } },
      data: type === PointsLedgerEntryType.REDEEM_COMMIT
        ? { reservedBalance: { decrement: redemption.pointsCostSnapshot }, version: { increment: 1 } }
        : {
            availableBalance: { increment: redemption.pointsCostSnapshot },
            reservedBalance: { decrement: redemption.pointsCostSnapshot },
            version: { increment: 1 },
          },
    });
    if (updated.count !== 1) throw new Error("Points account reservation is inconsistent.");

    await tx.pointsLedgerEntry.create({
      data: {
        accountId: account.id,
        userId: redemption.userId,
        type,
        amount: redemption.pointsCostSnapshot,
        availableDelta: type === PointsLedgerEntryType.REDEEM_RELEASE ? redemption.pointsCostSnapshot : 0,
        reservedDelta: -redemption.pointsCostSnapshot,
        sourceType: "REWARD_REDEMPTION",
        sourceReference: redemption.id,
        idempotencyKey,
        policyVersion: redemption.policyVersion,
      },
    });
    return tx.rewardRedemption.findUniqueOrThrow({ where: { id: redemption.id } });
  });
}

export function commitRewardRedemption(redemptionId: string, idempotencyKey: string) {
  return settleReservedRedemption(redemptionId, idempotencyKey, PointsLedgerEntryType.REDEEM_COMMIT);
}

export function releaseRewardRedemption(redemptionId: string, idempotencyKey: string) {
  return settleReservedRedemption(redemptionId, idempotencyKey, PointsLedgerEntryType.REDEEM_RELEASE);
}

/** The only documented numeric issuance is represented explicitly and is off by default. */
export async function issueZeroCancelProBonus(input: {
  userId: string;
  achievementAwardId: string;
  policyVersion: string;
  approvedForIssuance: boolean;
}) {
  if (!input.approvedForIssuance) {
    throw new Error("Zero-Cancel Pro point issuance is disabled pending award policy approval.");
  }
  const idempotencyKey = `points:zero-cancel-pro:${input.achievementAwardId}`;
  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.pointsAccount.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId },
        update: {},
      });
      const entry = await tx.pointsLedgerEntry.create({
        data: {
          accountId: account.id,
          userId: input.userId,
          type: PointsLedgerEntryType.EARN,
          amount: ZERO_CANCEL_PRO_BONUS_POINTS,
          availableDelta: ZERO_CANCEL_PRO_BONUS_POINTS,
          sourceType: "ACHIEVEMENT_AWARD",
          sourceReference: input.achievementAwardId,
          idempotencyKey,
          policyVersion: input.policyVersion,
        },
      });
      await tx.pointsAccount.update({
        where: { id: account.id },
        data: { availableBalance: { increment: ZERO_CANCEL_PRO_BONUS_POINTS }, version: { increment: 1 } },
      });
      return entry;
    });
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    return prisma.pointsLedgerEntry.findUniqueOrThrow({
      where: { idempotencyKey },
      });
  }
}

export type PointsLedgerMetadata = Prisma.InputJsonValue;
