import { ModerationCaseStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";

const STATUS_TRANSITIONS: Record<ModerationCaseStatus, ModerationCaseStatus[]> = {
  NEW: ["IN_REVIEW", "NEEDS_INFORMATION", "RESOLVED", "DISMISSED"],
  IN_REVIEW: ["NEEDS_INFORMATION", "RESOLVED", "DISMISSED"],
  NEEDS_INFORMATION: ["IN_REVIEW", "RESOLVED", "DISMISSED"],
  RESOLVED: ["REOPENED"],
  DISMISSED: ["REOPENED"],
  REOPENED: ["IN_REVIEW", "NEEDS_INFORMATION", "RESOLVED", "DISMISSED"],
};

export function assertValidModerationTransition(
  from: ModerationCaseStatus,
  to: ModerationCaseStatus,
) {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw AppError.conflict(`Cannot transition a moderation case from ${from} to ${to}.`);
  }
}
