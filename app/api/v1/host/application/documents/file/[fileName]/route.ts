import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { hostApplicationService } from "@/services/host-application.service";

// GET /api/v1/host/application/documents/file/[fileName] — Secure streaming of host documents
export const GET = apiHandler(async (req, ctx) => {
  const actor = await requireApiAuth(req);
  const { fileName } = await (ctx as any).params;

  const { fileBuffer, mimeType, fileName: safeName } = await hostApplicationService.getSecureDocumentFile(
    actor,
    fileName
  );

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
