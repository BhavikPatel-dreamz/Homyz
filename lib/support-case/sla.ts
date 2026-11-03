import { SupportCasePriority } from "@/generated/prisma/enums";

/**
 * Provisional operational targets, centralized until Product approves formal
 * support-policy values. These are server-only defaults; callers cannot set
 * deadlines from a browser payload.
 */
export const SUPPORT_SLA_POLICY_VERSION = "provisional-v1";

const HOURS_BY_PRIORITY: Record<SupportCasePriority, { firstResponse: number; nextResponse: number; resolution: number; escalation: number }> = {
  LOW: { firstResponse: 48, nextResponse: 72, resolution: 120, escalation: 96 },
  MEDIUM: { firstResponse: 24, nextResponse: 48, resolution: 72, escalation: 60 },
  HIGH: { firstResponse: 8, nextResponse: 24, resolution: 36, escalation: 30 },
  URGENT: { firstResponse: 2, nextResponse: 8, resolution: 16, escalation: 12 },
};

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

export function getSupportSlaDeadlines(priority: SupportCasePriority, createdAt = new Date()) {
  const policy = HOURS_BY_PRIORITY[priority];
  return {
    firstResponseDueAt: addHours(createdAt, policy.firstResponse),
    nextResponseDueAt: addHours(createdAt, policy.nextResponse),
    slaDueAt: addHours(createdAt, policy.resolution),
    escalationDueAt: addHours(createdAt, policy.escalation),
    policyVersion: SUPPORT_SLA_POLICY_VERSION,
  };
}

export function isSupportCaseOverdue(status: string, slaDueAt: Date | null, now = new Date()) {
  return !["RESOLVED", "CLOSED"].includes(status) && Boolean(slaDueAt && slaDueAt.getTime() < now.getTime());
}
