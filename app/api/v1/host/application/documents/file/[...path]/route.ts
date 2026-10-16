import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { hostApplicationService } from "@/services/host-application.service";

// GET /api/v1/host/application/documents/file/... — Secure streaming of host documents
export const GET = apiHandler(async (req, ctx) => {
  const actor = await requireApiAuth(req);
  const { path } = await (ctx as { params: Promise<{ path: string[] }> }).params;
  const fileName = Array.isArray(path) ? path.join("/") : "";

  const { fileBuffer, mimeType, fileName: safeName } = await hostApplicationService.getSecureDocumentFile(
    actor,
    fileName
  );

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
