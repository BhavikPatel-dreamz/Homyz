import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const { id, evidenceId } = await params;
  const { evidence, buffer } = await disputeService.getDisputeEvidenceForParticipant(actor, id, evidenceId);
  const download = req.nextUrl.searchParams.get("download") === "true";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": evidence.mimeType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(evidence.fileName || "evidence")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
