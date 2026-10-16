import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";

const updateCaseSchema = z
  .object({
    status: z.enum(["NEW", "IN_REVIEW", "NEEDS_INFORMATION", "RESOLVED", "DISMISSED", "REOPENED"]).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    priority: z.number().int().min(-100).max(100).optional(),
    assignedModeratorId: z.string().trim().min(1).max(256).nullable().optional(),
    resolutionCategory: z.string().trim().min(2).max(80).nullable().optional(),
    resolutionNotes: z.string().trim().max(5_000).nullable().optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    reviewAction: z.enum(["NONE", "HIDE", "DELETE", "RESTORE"]).optional(),
    listingAction: z.enum(["NONE", "DISMISS", "WARN_HOST", "REQUEST_CORRECTION", "TEMPORARY_RESTRICTION", "SUSPEND", "RESTORE"]).optional(),
    mediaAction: z.enum(["NONE", "DISMISS", "HIDE_PHOTO", "REMOVE_PHOTO", "REQUEST_REPLACEMENT", "RESTORE_PHOTO"]).optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one moderation case field is required.",
  })
  .superRefine((input, context) => {
    if ((input.status === "RESOLVED" || input.status === "DISMISSED") && !input.resolutionCategory) {
      context.addIssue({ code: "custom", path: ["resolutionCategory"], message: "A resolution category is required when closing a case." });
    }
  });

// PATCH /api/v1/admin/moderation/cases/:id — the service records workflow and
// executes approved content actions only after its decision/enforcement checks.
export const PATCH = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_UPDATE);
    const { id } = await ctx.params;
    const input = updateCaseSchema.parse(await req.json());
    const updated = await moderationService.updateModerationCase(actor, id, input);
    return ok(updated);
  },
);

// GET /api/v1/admin/moderation/cases/:id — private operational case detail.
export const GET = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.MODERATION_CASE_READ);
    const { id } = await ctx.params;
    return ok(await moderationService.getModerationCaseDetails(actor, id));
  },
);
