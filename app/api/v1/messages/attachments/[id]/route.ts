import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { messagingService } from "@/services/messaging.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req, { params }) => {
  const actor = await requireApiAuth(req);
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  const { attachment, buffer } = await messagingService.getAttachmentFile(actor, id);

  const isDownload = req.nextUrl.searchParams.get("download") === "true";
  const dispositionType = isDownload ? "attachment" : "inline";
  const downloadName = encodeURIComponent(attachment.fileName);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Disposition": `${dispositionType}; filename*=UTF-8''${downloadName}`,
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

