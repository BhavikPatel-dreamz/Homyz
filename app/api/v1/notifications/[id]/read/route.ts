import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { notificationService } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export const PATCH = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  let markAs = true;
  try {
    const body = await req.json();
    if (typeof body?.isRead === "boolean") {
      markAs = body.isRead;
    }
  } catch {
    // default to true
  }

  const updated = markAs
    ? await notificationService.markAsRead(actor.id, id)
    : await notificationService.markAsUnread(actor.id, id);

  return ok(updated);
});

