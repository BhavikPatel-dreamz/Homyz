import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService, AccountRestrictionType } from "@/services/moderation.service";
import { AppError } from "@/lib/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const enforcementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("WARN"),
    targetUserId: z.string().trim().min(1, "Target user ID is required"),
    reason: z.string().trim().min(5, "Warning reason must be at least 5 characters"),
    policyCode: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("REVOKE_WARNING"),
    targetUserId: z.string().trim().min(1, "Target user ID is required"),
    warningId: z.string().trim().min(1, "Warning ID is required"),
    reason: z.string().trim().min(5, "Revocation reason must be at least 5 characters"),
  }),
  z.object({
    action: z.literal("RESTRICT"),
    targetUserId: z.string().trim().min(1, "Target user ID is required"),
    type: z.enum(["RESTRICT_MESSAGING", "RESTRICT_BOOKING", "RESTRICT_LISTING_CREATION", "RESTRICT_REVIEWS"]),
    durationHours: z.number().int().positive().nullable().optional(),
    reason: z.string().trim().min(5, "Restriction reason must be at least 5 characters"),
    policyCode: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("LIFT_RESTRICTION"),
    targetUserId: z.string().trim().min(1, "Target user ID is required"),
    restrictionId: z.string().trim().min(1, "Restriction ID is required"),
    reason: z.string().trim().min(5, "Lift reason must be at least 5 characters"),
  }),
  z.object({
    action: z.literal("SUSPEND"),
    targetUserId: z.string().trim().min(1, "Target user ID is required"),
    reason: z.string().trim().min(5, "Suspension reason must be at least 5 characters"),
    policyCode: z.string().trim().optional(),
    bookingImpactAcknowledged: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("REINSTATE"),
    targetUserId: z.string().trim().min(1, "Target user ID is required"),
    reason: z.string().trim().min(5, "Reinstatement explanation must be at least 5 characters"),
  }),
  z.object({
    action: z.literal("MESSAGE_ENFORCEMENT"),
    messageId: z.string().trim().min(1, "Message ID is required"),
    messageAction: z.enum(["HIDE", "REMOVE", "RESTORE"]),
    reason: z.string().trim().min(5, "Enforcement reason must be at least 5 characters"),
    policyCode: z.string().trim().optional(),
  }),
]);

// POST /api/v1/moderation/cases/[id]/enforcement — execute an enforcement action
export const POST = apiHandler(async (req, context: RouteParams) => {
  const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  const { id: caseId } = await context.params;

  const body = await req.json();
  const input = enforcementSchema.parse(body);

  switch (input.action) {
    case "WARN": {
      const res = await moderationService.issueAccountWarning(actor, {
        caseId,
        targetUserId: input.targetUserId,
        reason: input.reason,
        policyCode: input.policyCode,
      });
      return created(res);
    }
    case "REVOKE_WARNING": {
      const res = await moderationService.revokeAccountWarning(actor, {
        caseId,
        targetUserId: input.targetUserId,
        warningId: input.warningId,
        reason: input.reason,
      });
      return ok(res);
    }
    case "RESTRICT": {
      const res = await moderationService.applyAccountRestriction(actor, {
        caseId,
        targetUserId: input.targetUserId,
        type: input.type as AccountRestrictionType,
        durationHours: input.durationHours ?? null,
        reason: input.reason,
        policyCode: input.policyCode,
      });
      return created(res);
    }
    case "LIFT_RESTRICTION": {
      const res = await moderationService.liftAccountRestriction(actor, {
        caseId,
        targetUserId: input.targetUserId,
        restrictionId: input.restrictionId,
        reason: input.reason,
      });
      return ok(res);
    }
    case "SUSPEND": {
      const res = await moderationService.suspendUserAccount(actor, {
        caseId,
        targetUserId: input.targetUserId,
        reason: input.reason,
        policyCode: input.policyCode,
        bookingImpactAcknowledged: input.bookingImpactAcknowledged,
      });
      return created(res);
    }
    case "REINSTATE": {
      const res = await moderationService.reinstateUserAccount(actor, {
        caseId,
        targetUserId: input.targetUserId,
        reason: input.reason,
      });
      return ok(res);
    }
    case "MESSAGE_ENFORCEMENT": {
      const res = await moderationService.executeMessageEnforcement(actor, {
        caseId,
        messageId: input.messageId,
        action: input.messageAction,
        reason: input.reason,
        policyCode: input.policyCode,
      });
      return ok(res);
    }
    default:
      throw AppError.badRequest("Unsupported enforcement action.");
  }
});

