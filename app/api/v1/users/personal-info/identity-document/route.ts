import path from "node:path";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { personalInfoService } from "@/services/personal-info.service";
import { savePrivateMedia } from "@/lib/storage/media";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MAX_DOC_SIZE = 15 * 1024 * 1024; // 15MB
const IDENTITY_DOCUMENT_TYPES = ["passport", "license", "national_id"] as const;
type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

function isIdentityDocumentType(value: string): value is IdentityDocumentType {
  return IDENTITY_DOCUMENT_TYPES.some((type) => type === value);
}

export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const rawDocType = formData.get("documentType") as string | null;

  if (!file || typeof file === "string") {
    throw AppError.badRequest("Please select a valid document file to upload.");
  }

  const docType = (rawDocType || "passport").toLowerCase();
  if (!isIdentityDocumentType(docType)) {
    throw AppError.badRequest("Invalid document type. Allowed types: passport, license, national_id.");
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw AppError.badRequest("Only JPEG, PNG, WebP, and PDF files are allowed for identity verification.");
  }

  if (file.size <= 0 || file.size > MAX_DOC_SIZE) {
    throw AppError.badRequest("Document file must be between 1 byte and 15 MB.");
  }

  const uploadedExtension = path.extname(file.name).toLowerCase();
  const extensionByMimeType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  };
  const cleanExt = extensionByMimeType[file.type] || uploadedExtension || ".jpg";
  const safeBaseName = `id_${actor.id}_${docType}_${Date.now()}${cleanExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const saved = await savePrivateMedia({
    kind: "host-documents",
    fileName: safeBaseName,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  const updated = await personalInfoService.uploadIdentityDocument(actor.id, {
    documentType: docType,
    fileName: file.name,
    fileUrl: `/api/v1/users/personal-info/identity-document/file/${saved.storagePath}`,
  });

  return ok(updated);
});
