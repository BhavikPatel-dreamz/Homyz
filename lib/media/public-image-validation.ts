import path from "node:path";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const EXTENSIONS_BY_MIME_TYPE: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
};

export const MAX_PUBLIC_IMAGE_SIZE = 10 * 1024 * 1024;

function hasPrefix(buffer: Buffer, bytes: readonly number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

/**
 * Browsers report File.type from user-controlled metadata. Verify the actual
 * bytes before placing a public object behind an image content type.
 */
export function hasExpectedImageSignature(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === "image/jpeg") return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType === "image/avif") {
    if (buffer.length < 16 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
    const brands = buffer.subarray(8, Math.min(buffer.length, 64)).toString("ascii");
    return brands.includes("avif") || brands.includes("avis");
  }
  return false;
}

export function validatePublicImageUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}): { status: number; message: string } | null {
  const { fileName, mimeType, size, buffer } = input;
  if (!ACCEPTED_IMAGE_TYPES.has(mimeType)) {
    return { status: 415, message: "Only JPEG, PNG, WebP, and AVIF images are supported." };
  }
  if (!EXTENSIONS_BY_MIME_TYPE[mimeType]?.includes(path.extname(fileName).toLowerCase())) {
    return { status: 415, message: "The file extension does not match its image type." };
  }
  if (size <= 0 || size > MAX_PUBLIC_IMAGE_SIZE) {
    return { status: 413, message: "Each image must be between 1 byte and 10 MB." };
  }
  if (!hasExpectedImageSignature(mimeType, buffer)) {
    return { status: 415, message: "The file content does not match its declared image type." };
  }
  return null;
}
