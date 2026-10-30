import { NextRequest } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export const dynamic = "force-dynamic";
export const POST = apiHandler(async (req: NextRequest) => {
  // Preserve the admin authorization boundary for compatibility, but reject a
  // client-provided storage key. Only the multipart endpoint may write a
  // private object and then register server-verified metadata.
  await requireApiPermission(req, PERMISSIONS.DISPUTES_MANAGE);
  throw AppError.badRequest("Direct evidence metadata registration is disabled. Upload the binary through the secure multipart endpoint.");
});
