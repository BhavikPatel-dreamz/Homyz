import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { userDestinationService } from "@/services/user-destination.service";

export const dynamic = "force-dynamic";

/** Removes a self-declared visited destination without deleting valid booking evidence. */
export const DELETE = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiAuth(req);
  const { id } = await params;

  const result = await userDestinationService.removeSelfDeclaredDestination(actor.id, id);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
});

