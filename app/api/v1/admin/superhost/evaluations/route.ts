import { z } from "zod";

import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  evaluateHostAtQuarterlyCheckpoint,
  getLiveSuperhostStatus,
  getSuperhostAssessmentHistory,
  runQuarterlySuperhostEvaluation,
} from "@/services/superhost.service";

const requestSchema = z.object({
  hostId: z.string().cuid().optional(),
  evaluationDate: z.string().datetime().optional(),
});

/**
 * Read the current host-level assessment and immutable assessment history.
 * This is intentionally an API-only administrative operation; Phase 3 does
 * not introduce another admin dashboard surface.
 */
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOSTS_VIEW);
  const hostId = req.nextUrl.searchParams.get("hostId");
  if (!hostId) {
    return Response.json({ success: false, error: { message: "hostId is required" } }, { status: 400 });
  }

  const [current, history] = await Promise.all([
    getLiveSuperhostStatus(hostId),
    getSuperhostAssessmentHistory(hostId),
  ]);
  return ok({ current, history });
});

/**
 * Safely retry the approved assessment window. A host-specific rerun returns
 * the already-finalized record when one exists; a batch rerun isolates failed
 * hosts and relies on the same unique history key as the scheduler.
 */
export const POST = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOSTS_EDIT);
  const body = requestSchema.parse(await req.json());
  const evaluationDate = body.evaluationDate ? new Date(body.evaluationDate) : new Date();

  if (body.hostId) {
    const result = await evaluateHostAtQuarterlyCheckpoint(body.hostId, evaluationDate);
    return ok({ scope: "HOST", result });
  }

  const result = await runQuarterlySuperhostEvaluation(evaluationDate);
  return ok({ scope: "QUARTER", result });
});
