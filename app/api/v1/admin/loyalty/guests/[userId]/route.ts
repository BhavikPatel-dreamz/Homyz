import { prisma } from "@/lib/db/prisma";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

// Read-only administrative foundation. Corrections are deliberately not
// exposed here until a dedicated authorized override workflow is approved.
export const GET = apiHandler(async (_req, context: { params: Promise<{ userId: string }> }) => {
  await requireApiPermission(_req, PERMISSIONS.GUESTS_VIEW);
  const { userId } = await context.params;
  const membership = await prisma.stayEliteMembership.findUnique({
    where: { userId },
    select: {
      userId: true, currentTier: true, status: true, qualificationStatus: true,
      policyVersion: true, lastEvaluatedAt: true, lastQualifiedAt: true,
      lastEvaluationReason: true, progressSnapshot: true,
      history: {
        orderBy: { occurredAt: "desc" }, take: 100,
        select: { previousTier: true, newTier: true, changeType: true, disposition: true, policyVersion: true, reason: true, occurredAt: true, authorizedById: true },
      },
    },
  });
  if (!membership) throw AppError.notFound("No StayElite membership projection exists for this guest.");
  return ok(membership);
});
