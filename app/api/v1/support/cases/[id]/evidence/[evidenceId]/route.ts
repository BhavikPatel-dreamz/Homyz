import { NextResponse } from "next/server";

import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth, requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { Role } from "@/generated/prisma/enums";
import { supportCaseService } from "@/services/support-case.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; evidenceId: string }> };

export const GET = apiHandler(async (req, context: Context) => {
  const actor = await requireApiAuth(req);
  if (actor.role === Role.ADMIN) await requireApiPermission(req, PERMISSIONS.DISPUTES_VIEW);
  const { id, evidenceId } = await context.params;
  const { evidence, buffer } = await supportCaseService.getSupportCaseEvidenceForParticipant(actor, id, evidenceId);
  const download = req.nextUrl.searchParams.get("download") === "true";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": evidence.mimeType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(evidence.originalName || "evidence")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
