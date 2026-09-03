import { apiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { hostApplicationService } from "@/services/host-application.service";

// GET /api/v1/host/application — Retrieve authenticated user's host application & onboarding status
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const data = await hostApplicationService.getApplicationForUser(actor);
  return ok(data);
});

// POST /api/v1/host/application — Save draft or submit application
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const body = await req.json();

  if (body.action === "draft") {
    const result = await hostApplicationService.saveDraft(actor, body);
    return ok(result);
  }

  if (body.action === "convert") {
    const result = await hostApplicationService.convertToHost(actor);
    return ok(result);
  }

  if (body.action === "submit") {
    const result = await hostApplicationService.submitApplication(actor, body);
    return created(result);
  }

  // Default to saving draft if action not specified
  const result = await hostApplicationService.saveDraft(actor, body);
  return ok(result);
});
