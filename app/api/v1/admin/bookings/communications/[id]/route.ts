import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { communicationAdminService } from "@/services/communication-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.COMMUNICATIONS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { id } = await params;
  const { searchParams } = new URL(req.url);

  const conversation = await communicationAdminService.getConversationDetailsForAdmin(actor, id, {
    messageLimit: Number(searchParams.get("limit")) || 50,
    messageBefore: searchParams.get("before") || undefined,
  });

  return ok(conversation);
});

