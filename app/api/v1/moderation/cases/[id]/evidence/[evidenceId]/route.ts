import type { NextRequest } from "next/server";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { moderationService } from "@/services/moderation.service";

interface RouteParams {
  params: Promise<{ id: string; evidenceId: string }>;
}

// GET /api/v1/moderation/cases/[id]/evidence/[evidenceId] — stream authorized private evidence
export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const actor = await requireApiAuth(req);
    const { id: caseId, evidenceId } = await context.params;
    const isDownload = req.nextUrl.searchParams.get("download") === "true";

    const streamInfo = await moderationService.getModerationEvidenceStream(actor, caseId, evidenceId);

    const dispositionType = isDownload ? "attachment" : "inline";
    const safeFilename = encodeURIComponent(streamInfo.displayName);

    return new Response(new Uint8Array(streamInfo.buffer), {
      status: 200,
      headers: {
        "Content-Type": streamInfo.mimeType,
        "Content-Disposition": `${dispositionType}; filename="${streamInfo.displayName}"; filename*=UTF-8''${safeFilename}`,
        "Content-Length": String(streamInfo.fileSize),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(JSON.stringify({ success: false, error: { code: error.code, message: error.message } }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to stream evidence" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

