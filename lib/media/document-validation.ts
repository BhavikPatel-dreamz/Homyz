import path from "node:path";
import { hasExpectedImageSignature } from "./public-image-validation";

export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB

export const ACCEPTED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

export function validateDocumentUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}): { status: number; message: string } | null {
  const { fileName, mimeType, size, buffer } = input;

  if (!ACCEPTED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    return {
      status: 415,
      message: "Only PDF, JPEG, PNG, and WebP documents are allowed for compliance and verification.",
    };
  }

  const ext = path.extname(fileName).toLowerCase();
  const validExtensions: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
  };

  if (!validExtensions[mimeType]?.includes(ext)) {
    return {
      status: 415,
      message: "The document file extension does not match its declared format.",
    };
  }

  if (size <= 0 || size > MAX_DOCUMENT_SIZE) {
    return {
      status: 413,
      message: "Document file size must be between 1 byte and 15 MB.",
    };
  }

  if (mimeType === "application/pdf") {
    if (!isPdf(buffer)) {
      return {
        status: 415,
        message: "The file content is not a valid PDF document.",
      };
    }
  } else if (!hasExpectedImageSignature(mimeType, buffer)) {
    return {
      status: 415,
      message: "The file content does not match its declared image format.",
    };
  }

  return null;
}

