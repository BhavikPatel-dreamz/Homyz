import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { pricingAutoPilotService } from "@/services/pricing-intelligence/autopilot/pricing-autopilot.service";
import { AppError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, [PERMISSIONS.ANALYTICS_VIEW]);

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) {
    throw AppError.badRequest("Query parameter 'listingId' is required.");
  }

  const [config, history] = await Promise.all([
    pricingAutoPilotService.getConfig(listingId),
    pricingAutoPilotService.getExecutionHistory(listingId),
  ]);

  return ok({
    config,
    history,
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SYSTEM_MANAGE,
  ]);

  const body = await req.json().catch(() => ({}));
  const { action, listingId, configUpdates, batchId } = body;

  if (!listingId && action !== "APPROVE" && action !== "ROLLBACK") {
    throw AppError.badRequest("Field 'listingId' is required.");
  }

  if (action === "UPDATE_CONFIG") {
    const updated = await pricingAutoPilotService.updateConfig(
      actor,
      listingId,
      configUpdates || {}
    );
    return ok(updated);
  }

  if (action === "PAUSE") {
    const paused = await pricingAutoPilotService.pauseAutoPilot(actor, listingId);
    return ok(paused);
  }

  if (action === "RESUME") {
    const resumed = await pricingAutoPilotService.resumeAutoPilot(actor, listingId);
    return ok(resumed);
  }

  if (action === "EXECUTE") {
    const batch = await pricingAutoPilotService.executeAutoPilot(
      listingId,
      "MANUAL_HOST_TRIGGER"
    );
    return ok(batch);
  }

  if (action === "APPROVE") {
    if (!batchId) throw AppError.badRequest("Field 'batchId' is required.");
    const batch = await pricingAutoPilotService.approveProposedBatch(actor, batchId);
    return ok(batch);
  }

  if (action === "ROLLBACK") {
    if (!batchId) throw AppError.badRequest("Field 'batchId' is required.");
    const result = await pricingAutoPilotService.rollbackBatch(actor, batchId);
    return ok(result);
  }

  throw AppError.badRequest(`Unsupported Auto-Pilot action: ${action}`);
});

