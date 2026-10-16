import path from "node:path";
import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { readPrivateMedia } from "@/lib/storage/media";
import { personalInfoService } from "@/services/personal-info.service";

const ROUTE_PREFIX = "/api/v1/users/personal-info/identity-document/file/";

function contentTypeFor(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export const GET = apiHandler(async (req, context) => {
  const actor = await requireApiAuth(req);
  const { path: segments } = await (
    context as { params: Promise<{ path: string[] }> }
  ).params;
  const storagePath = Array.isArray(segments) ? segments.join("/") : "";
  const personalInfo = await personalInfoService.getPersonalInfo(actor.id);
  const document = personalInfo.identityDocument;

  if (!document || document.fileUrl !== `${ROUTE_PREFIX}${storagePath}`) {
    throw AppError.notFound("Identity document not found");
  }

  let body: Buffer;
  try {
    body = await readPrivateMedia("host-documents", storagePath);
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "NOT_FOUND") {
      throw AppError.notFound("Identity document not found");
    }
    throw error;
  }

  const downloadName = encodeURIComponent(document.fileName);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(storagePath),
      "Content-Disposition": `inline; filename*=UTF-8''${downloadName}`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
