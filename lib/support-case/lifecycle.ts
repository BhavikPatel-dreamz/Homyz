import { SupportCaseStatus } from "@/generated/prisma/enums";

export const CASE_TRANSITIONS: Record<SupportCaseStatus, ReadonlySet<SupportCaseStatus>> = {
  [SupportCaseStatus.OPEN]: new Set([
    SupportCaseStatus.IN_REVIEW,
    SupportCaseStatus.WAITING_FOR_GUEST,
    SupportCaseStatus.WAITING_FOR_HOST,
    SupportCaseStatus.WAITING_FOR_ADMIN,
    SupportCaseStatus.ESCALATED,
  ]),
  [SupportCaseStatus.IN_REVIEW]: new Set([
    SupportCaseStatus.WAITING_FOR_GUEST,
    SupportCaseStatus.WAITING_FOR_HOST,
    SupportCaseStatus.WAITING_FOR_ADMIN,
    SupportCaseStatus.RESOLVED,
    SupportCaseStatus.ESCALATED,
  ]),
  [SupportCaseStatus.WAITING_FOR_GUEST]: new Set([
    SupportCaseStatus.IN_REVIEW,
    SupportCaseStatus.RESOLVED,
    SupportCaseStatus.ESCALATED,
  ]),
  [SupportCaseStatus.WAITING_FOR_HOST]: new Set([
    SupportCaseStatus.IN_REVIEW,
    SupportCaseStatus.RESOLVED,
    SupportCaseStatus.ESCALATED,
  ]),
  [SupportCaseStatus.WAITING_FOR_ADMIN]: new Set([
    SupportCaseStatus.IN_REVIEW,
    SupportCaseStatus.RESOLVED,
    SupportCaseStatus.ESCALATED,
  ]),
  [SupportCaseStatus.RESOLVED]: new Set([
    SupportCaseStatus.CLOSED,
    SupportCaseStatus.REOPENED,
  ]),
  [SupportCaseStatus.CLOSED]: new Set([SupportCaseStatus.REOPENED]),
  [SupportCaseStatus.REOPENED]: new Set([
    SupportCaseStatus.IN_REVIEW,
    SupportCaseStatus.WAITING_FOR_GUEST,
    SupportCaseStatus.WAITING_FOR_HOST,
    SupportCaseStatus.WAITING_FOR_ADMIN,
    SupportCaseStatus.ESCALATED,
  ]),
  [SupportCaseStatus.ESCALATED]: new Set([
    SupportCaseStatus.IN_REVIEW,
    SupportCaseStatus.WAITING_FOR_GUEST,
    SupportCaseStatus.WAITING_FOR_HOST,
    SupportCaseStatus.WAITING_FOR_ADMIN,
    SupportCaseStatus.RESOLVED,
  ]),
};

export function canTransitionSupportCase(
  from: SupportCaseStatus,
  to: SupportCaseStatus,
): boolean {
  return CASE_TRANSITIONS[from].has(to);
}
