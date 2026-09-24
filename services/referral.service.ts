import { customAlphabet } from "nanoid";

import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BookingStatus, ReferralRewardStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { auditService } from "./audit.service";
import { getReferralProgramConfig, type ReferralProgramConfig } from "./app-settings.service";

const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const createReferralSuffix = customAlphabet(REFERRAL_CODE_ALPHABET, 10);
const REFERRAL_CODE_PATTERN = /^HMY-[A-Z0-9]{10}$/;

export type ReferralDashboardData = {
  referralCode: string;
  rewardRule: { points: number; qualifyingCondition: "FIRST_COMPLETED_STAY" } | null;
  totals: { invited: number; pendingPoints: number; creditedPoints: number };
  activity: Array<{
    id: string;
    guestName: string;
    joinedAt: Date;
    status: "JOINED" | "PENDING_APPROVAL" | "CREDITED" | "NOT_APPROVED";
    points: number | null;
    reviewedAt: Date | null;
  }>;
};

export type ReferralRewardListItem = {
  id: string;
  inviter: { id: string; name: string | null; email: string | null };
  referredGuest: { id: string; name: string | null; email: string | null };
  points: number;
  status: ReferralRewardStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  reviewer: { id: string; name: string | null; email: string | null } | null;
  qualifyingBooking: { id: string; endDate: Date; status: BookingStatus };
};

function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

async function ensureReferralCode(userId: string): Promise<string> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (!current) throw AppError.notFound("User not found");
  if (current.referralCode) return current.referralCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const referralCode = `HMY-${createReferralSuffix()}`;
    try {
      const claimed = await prisma.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode } });
      if (claimed.count === 1) return referralCode;
      const updated = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
      if (updated?.referralCode) return updated.referralCode;
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }
  throw AppError.internal("Unable to create a referral link. Please try again.");
}

/** Resolve a referral link at signup; callers never receive an inviter user ID. */
export async function resolveReferrerId(referralCode?: string): Promise<string | null> {
  if (!referralCode) return null;
  const normalized = normalizeReferralCode(referralCode);
  if (!REFERRAL_CODE_PATTERN.test(normalized)) throw AppError.badRequest("This referral link is invalid.");
  const referrer = await prisma.user.findUnique({ where: { referralCode: normalized }, select: { id: true, status: true } });
  if (!referrer || referrer.status !== "ACTIVE") throw AppError.badRequest("This referral link is invalid.");
  return referrer.id;
}

/** Create one pending credit after a referred guest's first completed stay. */
async function issueEligibleRewards(inviterId: string, program: ReferralProgramConfig | null): Promise<void> {
  if (!program?.enabled) return;
  const referredGuests = await prisma.user.findMany({ where: { referredById: inviterId }, select: { id: true } });

  for (const guest of referredGuests) {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const reward = await tx.referralReward.findUnique({ where: { referredUserId: guest.id }, select: { id: true } });
        if (reward) return;
        const firstCompletedStay = await tx.booking.findFirst({
          where: { userId: guest.id, status: BookingStatus.CONFIRMED, endDate: { lte: new Date() } },
          orderBy: [{ endDate: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (!firstCompletedStay) return;
        await tx.referralReward.create({
          data: {
            inviterId,
            referredUserId: guest.id,
            qualifyingBookingId: firstCompletedStay.id,
            points: program.inviterRewardPoints,
            status: ReferralRewardStatus.PENDING,
          },
        });
      });
    } catch (error: unknown) {
      // Unique constraints make concurrent eligibility checks harmless.
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }
}

function toDashboardStatus(status: ReferralRewardStatus | undefined) {
  if (status === ReferralRewardStatus.PENDING) return "PENDING_APPROVAL" as const;
  if (status === ReferralRewardStatus.APPROVED) return "CREDITED" as const;
  if (status === ReferralRewardStatus.REJECTED) return "NOT_APPROVED" as const;
  return "JOINED" as const;
}

async function getDashboard(userId: string): Promise<ReferralDashboardData> {
  const [referralCode, program] = await Promise.all([ensureReferralCode(userId), getReferralProgramConfig()]);
  await issueEligibleRewards(userId, program);
  const referredGuests: Array<{
    id: string;
    name: string | null;
    createdAt: Date;
    referralRewardEarnedFor: { status: ReferralRewardStatus; points: number; reviewedAt: Date | null } | null;
  }> = await prisma.user.findMany({
    where: { referredById: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      referralRewardEarnedFor: { select: { status: true, points: true, reviewedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const activity: ReferralDashboardData["activity"] = referredGuests.map((guest) => ({
    id: guest.id,
    // Never reveal an invitee's email address in another guest's dashboard.
    guestName: guest.name?.trim() || "Invited guest",
    joinedAt: guest.createdAt,
    status: toDashboardStatus(guest.referralRewardEarnedFor?.status),
    points: guest.referralRewardEarnedFor?.points ?? null,
    reviewedAt: guest.referralRewardEarnedFor?.reviewedAt ?? null,
  }));
  return {
    referralCode,
    rewardRule: program ? { points: program.inviterRewardPoints, qualifyingCondition: program.qualifyingCondition } : null,
    totals: {
      invited: activity.length,
      pendingPoints: activity.filter((item) => item.status === "PENDING_APPROVAL").reduce((total, item) => total + (item.points ?? 0), 0),
      creditedPoints: activity.filter((item) => item.status === "CREDITED").reduce((total, item) => total + (item.points ?? 0), 0),
    },
    activity,
  };
}

async function listRewards(options: { skip?: number; take?: number; status?: ReferralRewardStatus; search?: string } = {}) {
  const where: Prisma.ReferralRewardWhereInput = {};
  if (options.status) where.status = options.status;
  if (options.search?.trim()) {
    const search = options.search.trim();
    where.OR = [
      { inviter: { name: { contains: search, mode: "insensitive" } } },
      { inviter: { email: { contains: search, mode: "insensitive" } } },
      { referredGuest: { name: { contains: search, mode: "insensitive" } } },
      { referredGuest: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.referralReward.findMany({
      where,
      skip: options.skip ?? 0,
      take: options.take ?? 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, points: true, status: true, createdAt: true, reviewedAt: true, rejectionReason: true,
        inviter: { select: { id: true, name: true, email: true } },
        referredGuest: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
        qualifyingBooking: { select: { id: true, endDate: true, status: true } },
      },
    }),
    prisma.referralReward.count({ where }),
  ]);
  return { items, total };
}

async function reviewReward(actor: AuthUser, rewardId: string, action: "APPROVE" | "REJECT", rejectionReason?: string) {
  const reward = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.referralReward.findUnique({
      where: { id: rewardId },
      include: { qualifyingBooking: { select: { status: true, endDate: true } } },
    });
    if (!current) throw AppError.notFound("Referral reward not found");
    if (current.status !== ReferralRewardStatus.PENDING) throw AppError.conflict("This referral reward has already been reviewed.");
    if (current.qualifyingBooking.status !== BookingStatus.CONFIRMED || current.qualifyingBooking.endDate > new Date()) {
      throw AppError.conflict("The qualifying stay is no longer eligible for a referral credit.");
    }
    return tx.referralReward.update({
      where: { id: rewardId },
      data: {
        status: action === "APPROVE" ? ReferralRewardStatus.APPROVED : ReferralRewardStatus.REJECTED,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        rejectionReason: action === "REJECT" ? rejectionReason : null,
      },
      select: { id: true, inviterId: true, referredUserId: true, points: true, status: true, reviewedAt: true, rejectionReason: true },
    });
  });
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: action === "APPROVE" ? "REFERRAL_REWARD_APPROVED" : "REFERRAL_REWARD_REJECTED",
    resourceType: "REFERRAL_REWARD",
    resourceId: reward.id,
    description: `${action === "APPROVE" ? "Approved" : "Rejected"} ${reward.points} referral points.`,
    metadata: { inviterId: reward.inviterId, referredUserId: reward.referredUserId, points: reward.points, rejectionReason: reward.rejectionReason },
  });
  return reward;
}

async function approveReward(actor: AuthUser, rewardId: string) {
  return reviewReward(actor, rewardId, "APPROVE");
}

async function rejectReward(actor: AuthUser, rewardId: string, reason: string) {
  return reviewReward(actor, rewardId, "REJECT", reason);
}

export const referralService = { getDashboard, resolveReferrerId, listRewards, approveReward, rejectReward };
