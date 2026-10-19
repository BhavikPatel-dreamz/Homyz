import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import {
  createTravelImageVariants,
  validateTravelImageMetadata,
  validateTravelImageUpload,
} from "../lib/media/travel-image-validation";
import { PRIVATE_KINDS, PUBLIC_KINDS } from "../lib/storage/media";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

async function testImageValidationAndVariants() {
  const formats = [
    { mimeType: "image/jpeg", fileName: "travel.jpg", render: (pipeline: Sharp) => pipeline.jpeg() },
    { mimeType: "image/png", fileName: "travel.png", render: (pipeline: Sharp) => pipeline.png() },
    { mimeType: "image/webp", fileName: "travel.webp", render: (pipeline: Sharp) => pipeline.webp() },
    { mimeType: "image/avif", fileName: "travel.avif", render: (pipeline: Sharp) => pipeline.avif() },
  ] as const;

  for (const format of formats) {
    const buffer = await format.render(sharp({ create: { width: 24, height: 16, channels: 3, background: "#d9a441" } })).toBuffer();
    const validated = await validateTravelImageUpload({
      fileName: format.fileName,
      mimeType: format.mimeType,
      size: buffer.length,
      buffer,
    });
    assert.equal(validated.width, 24);
    assert.equal(validated.height, 16);
    assert.match(validated.checksum, /^[a-f0-9]{64}$/);
  }

  assert.match(
    validateTravelImageMetadata({ fileName: "fake.png", mimeType: "image/jpeg", size: 10 }) || "",
    /extension/i,
  );
  assert.match(
    validateTravelImageMetadata({ fileName: "active.svg", mimeType: "image/svg+xml", size: 10 }) || "",
    /JPEG, PNG, WebP, and AVIF/i,
  );
  await assert.rejects(
    validateTravelImageUpload({ fileName: "fake.png", mimeType: "image/png", size: 12, buffer: Buffer.from("not an image") }),
    /content does not match|valid, decodable image/i,
  );

  const sourceImage = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#557799" } }).jpeg().toBuffer();
  const variants = await createTravelImageVariants(sourceImage, "TRAVEL_PHOTO");
  assert.deepEqual(variants.map((variant) => variant.name), ["thumbnail", "medium", "large"]);
  assert.ok(variants.every((variant) => variant.buffer.length > 0 && variant.width <= 1920));
}

function testPrivateStorageAndRoutes() {
  for (const kind of ["travel-photos", "travel-covers", "travel-variants"]) {
    assert.equal(PRIVATE_KINDS.has(kind), true, `${kind} must be private`);
    assert.equal(PUBLIC_KINDS.has(kind), false, `${kind} must not be public`);
  }

  const mediaStorage = source("media-server/storage.mjs");
  const publicKindsBlock = mediaStorage.match(/PUBLIC_MEDIA_KINDS = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || "";
  assert.doesNotMatch(publicKindsBlock, /travel-/, "travel media must not be anonymously served by the media server");

  const privateFileRoute = source("app/api/v1/travel-media/[id]/file/route.ts");
  assert.match(privateFileRoute, /requireApiAuth\(req\)/, "private delivery must authenticate every request");
  assert.match(privateFileRoute, /private, no-store/, "private delivery must prevent shared caching");

  const travelService = source("services/travel-media.service.ts");
  assert.match(travelService, /ownerId: actor\.id/, "asset and upload access must be owner-scoped");
  assert.match(travelService, /status === "READY" \|\| session\.status === "PROCESSING"/, "finalization must be idempotent");
  assert.match(travelService, /status: "CANCELLED"/, "cancel must be a durable server transition");
  assert.match(travelService, /visibility: "PRIVATE"/, "server-created travel media must default to private");

  const publicProxy = source("app/uploads/[...path]/route.ts");
  assert.doesNotMatch(publicProxy, /travel-photos|travel-covers|travel-variants/);
}

function testSchemaAndClientFlow() {
  const schema = source("prisma/schema.prisma");
  assert.match(schema, /model TravelMediaAsset/);
  assert.match(schema, /model TravelMediaUploadSession/);
  assert.match(schema, /model TravelMediaVariant/);
  assert.match(schema, /visibility\s+TravelMediaVisibility\s+@default\(PRIVATE\)/);
  assert.match(schema, /storageKey\s+String\?\s+@unique/);

  const modal = source("components/travel/travel-media-upload-modal.tsx");
  assert.match(modal, /xhr\.upload\.onprogress/, "progress must use actual transport byte events");
  assert.match(modal, /requests\.current\.get\(item\.id\)\?\.abort\(\)/, "per-file cancellation must abort transport");
  assert.match(modal, /onDrop=/, "drag and drop must be wired");
  assert.doesNotMatch(modal, /setInterval|Math\.random\(\).*progress/, "upload progress must not be simulated");

  const profile = source("app/(protected)/profile-management/profile-management-client.tsx");
  assert.match(profile, /TravelMediaUploadModal/);
  assert.match(profile, /TravelMediaDraftsPanel/);
}

async function main() {
  await testImageValidationAndVariants();
  testPrivateStorageAndRoutes();
  testSchemaAndClientFlow();
  console.log("Phase 2 travel-media foundation checks passed.");
}

void main();
