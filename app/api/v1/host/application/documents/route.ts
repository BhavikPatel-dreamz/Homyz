import { apiHandler } from "@/lib/api/handler";
import { ok, created } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { AppError } from "@/lib/api/errors";
import { hostApplicationService } from "@/services/host-application.service";

// POST /api/v1/host/application/documents — Secure document upload/replace for host
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const documentType = formData.get("documentType") as string | null;

  if (!file) {
    throw AppError.badRequest("No file uploaded.");
  }
  if (!documentType || !documentType.trim()) {
    throw AppError.badRequest("Document type is required.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const doc = await hostApplicationService.uploadDocument(actor, documentType.trim(), {
    buffer,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  });

  return created(doc);
});

// DELETE /api/v1/host/application/documents — Remove document before submission
export const DELETE = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    throw AppError.badRequest("Document ID is required.");
  }

  const result = await hostApplicationService.removeDocument(actor, documentId);
  return ok(result);
});
