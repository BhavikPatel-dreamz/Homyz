import { LoyaltyActivityType, NotificationType } from "@/generated/prisma/enums";

export type LoyaltyNotificationEvent =
  | "ACHIEVEMENT_EARNED" | "ACHIEVEMENT_REVOKED" | "TIER_CHANGED" | "TIER_CORRECTED"
  | "REFERRAL_REWARD_PENDING" | "REFERRAL_REWARD_APPROVED" | "REFERRAL_REWARD_REJECTED";

export type LoyaltyNotificationCandidate = {
  event: LoyaltyNotificationEvent; userId: string; sourceId: string; sourceType: string;
  label?: string | null; occurredAt?: Date; metadata?: Record<string, unknown>;
};

const PROFILE_LINK = "/travel-profile";
const REFERRAL_LINK = "/profile/tab/invite";

export function buildLoyaltyNotification(candidate: LoyaltyNotificationCandidate) {
  const label = candidate.label?.trim() || "your StayElite account";
  const common = { userId: candidate.userId, entityId: candidate.sourceId, entityType: `loyalty:${candidate.event.toLowerCase()}`, deduplicationKey: `stayelite-notification:${candidate.userId}:${candidate.event}:${candidate.sourceId}`, metadata: { ...candidate.metadata, loyaltyEvent: candidate.event, sourceType: candidate.sourceType } };
  switch (candidate.event) {
    case "ACHIEVEMENT_EARNED": return { ...common, type: NotificationType.PROMOTION, activityType: LoyaltyActivityType.ACHIEVEMENT_EARNED, title: "New StayElite achievement", message: `You unlocked ${label}.`, link: PROFILE_LINK, summary: `Unlocked ${label}.` };
    case "ACHIEVEMENT_REVOKED": return { ...common, type: NotificationType.SYSTEM, activityType: LoyaltyActivityType.ACHIEVEMENT_REVOKED, title: "StayElite achievement updated", message: `Your ${label} achievement was revoked following an authorized review.`, link: PROFILE_LINK, summary: `${label} was revoked following an authorized review.` };
    case "TIER_CHANGED": return { ...common, type: NotificationType.PROMOTION, activityType: LoyaltyActivityType.TIER_CHANGED, title: "StayElite membership upgraded", message: `Your StayElite membership has been upgraded to ${label}.`, link: PROFILE_LINK, summary: `StayElite membership upgraded to ${label}.` };
    case "TIER_CORRECTED": return { ...common, type: NotificationType.SYSTEM, activityType: LoyaltyActivityType.TIER_CORRECTED, title: "StayElite membership updated", message: "Your StayElite membership was updated after an authorized review.", link: PROFILE_LINK, summary: "StayElite membership was updated after an authorized review." };
    case "REFERRAL_REWARD_PENDING": return { ...common, type: NotificationType.SYSTEM, activityType: LoyaltyActivityType.REFERRAL_REWARD_PENDING, title: "Referral reward pending review", message: "Your referral reward is awaiting an authorized review.", link: REFERRAL_LINK, summary: "Referral reward is pending review." };
    case "REFERRAL_REWARD_APPROVED": return { ...common, type: NotificationType.SYSTEM, activityType: LoyaltyActivityType.REFERRAL_REWARD_APPROVED, title: "Referral reward approved", message: "Your referral reward has been approved. Any points posting remains subject to the configured ledger policy.", link: REFERRAL_LINK, summary: "Referral reward was approved." };
    case "REFERRAL_REWARD_REJECTED": return { ...common, type: NotificationType.SYSTEM, activityType: LoyaltyActivityType.REFERRAL_REWARD_REJECTED, title: "Referral reward update", message: "Your referral reward could not be approved.", link: REFERRAL_LINK, summary: "Referral reward was not approved." };
  }
}

export const LOYALTY_NOTIFICATION_CHANNELS = { inApp: true, email: false, sms: false, push: false } as const;
