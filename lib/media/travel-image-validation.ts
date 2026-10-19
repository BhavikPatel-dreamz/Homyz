import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { validatePublicImageUpload } from "@/lib/media/public-image-validation";

export const MAX_TRAVEL_IMAGE_SIZE = 10 * 1024 * 1024;
export const MAX_TRAVEL_IMAGE_DIMENSION = 8_000;
export const MAX_TRAVEL_IMAGE_PIXELS = 40_000_000;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
};

export type ValidatedTravelImage = {
  width: number;
  height: number;
  checksum: string;
};

export function validateTravelImageMetadata(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): string | null {
  if (!ACCEPTED_TYPES.has(input.mimeType)) {
    return "Only JPEG, PNG, WebP, and AVIF images are supported.";
  }
  if (!EXTENSIONS[input.mimeType]?.includes(path.extname(input.fileName).toLowerCase())) {
    return "The file extension does not match its image type.";
  }
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_TRAVEL_IMAGE_SIZE) {
    return "Each image must be between 1 byte and 10 MB.";
  }
  return null;
}

/**
 * Verifies the declared type and magic bytes, then decodes the file with a
 * bounded pixel budget. `sharp` also rejects malformed image payloads.
 */
export async function validateTravelImageUpload(input: {
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}): Promise<ValidatedTravelImage> {
  const metadataError = validateTravelImageMetadata(input);
  if (metadataError) throw new Error(metadataError);

  const signatureError = validatePublicImageUpload(input);
  if (signatureError) throw new Error(signatureError.message);

  try {
    const decoded = sharp(input.buffer, {
      limitInputPixels: MAX_TRAVEL_IMAGE_PIXELS,
      failOn: "warning",
    }).rotate();
    const metadata = await decoded.metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (!width || !height) throw new Error("The image dimensions could not be read.");
    if (width > MAX_TRAVEL_IMAGE_DIMENSION || height > MAX_TRAVEL_IMAGE_DIMENSION) {
      throw new Error(`Image dimensions must not exceed ${MAX_TRAVEL_IMAGE_DIMENSION}px.`);
    }
    if (width * height > MAX_TRAVEL_IMAGE_PIXELS) {
      throw new Error("Image dimensions exceed the allowed pixel limit.");
    }
    return {
      width,
      height,
      checksum: createHash("sha256").update(input.buffer).digest("hex"),
    };
  } catch (error) {
    if (error instanceof Error && /dimensions|pixel limit|Only JPEG|extension|between 1 byte/.test(error.message)) {
      throw error;
    }
    throw new Error("The uploaded file is not a valid, decodable image.");
  }
}

export type ProcessedTravelVariant = {
  name: "thumbnail" | "medium" | "large" | "cover";
  buffer: Buffer;
  width: number;
  height: number;
};

/** Creates metadata-stripped WebP variants; originals remain private. */
export async function createTravelImageVariants(
  source: Buffer,
  mediaType: "TRAVEL_PHOTO" | "TRAVEL_COVER",
): Promise<ProcessedTravelVariant[]> {
  const variants: Array<{ name: ProcessedTravelVariant["name"]; width: number; height?: number; fit?: "inside" | "cover" }> =
    mediaType === "TRAVEL_COVER"
      ? [
          { name: "thumbnail", width: 480, height: 180, fit: "cover" },
          { name: "medium", width: 960, height: 360, fit: "cover" },
          { name: "large", width: 1600, height: 600, fit: "cover" },
          { name: "cover", width: 1600, height: 600, fit: "cover" },
        ]
      : [
          { name: "thumbnail", width: 320, fit: "inside" },
          { name: "medium", width: 960, fit: "inside" },
          { name: "large", width: 1920, fit: "inside" },
        ];

  return Promise.all(variants.map(async (variant) => {
    const { data, info } = await sharp(source, {
      limitInputPixels: MAX_TRAVEL_IMAGE_PIXELS,
      failOn: "warning",
    })
      .rotate()
      .resize({ width: variant.width, height: variant.height, fit: variant.fit, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { name: variant.name, buffer: data, width: info.width, height: info.height };
  }));
}
