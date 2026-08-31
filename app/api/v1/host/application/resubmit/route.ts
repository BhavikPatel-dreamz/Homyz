import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { hostApplicationService } from "@/services/host-application.service";

// POST /api/v1/host/application/resubmit — Resubmit host application after action items / rejected document updates
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const updated = await hostApplicationService.resubmitApplication(actor);
  return ok(updated);
});
