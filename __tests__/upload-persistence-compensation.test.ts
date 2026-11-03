import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Upload persistence compensation", () => {
  test("conversation attachments clean up storage when metadata persistence fails", () => {
    const service = source("services/messaging.service.ts");
    assert.match(service, /await prisma\.\$transaction/);
    assert.match(
      service,
      /deletePrivateMedia\(\{\s*kind: "message-attachments",\s*fileName: saved\.storagePath,?\s*\}\)/,
    );
  });

  test("CMS saves database metadata before deleting a replaced object", () => {
    const service = source("services/cms-media.service.ts");
    const updateIndex = service.indexOf(
      "updated = await prisma.cmsMediaAsset.update",
    );
    const deleteIndex = service.indexOf("Warning cleaning up replaced file");
    assert.ok(updateIndex >= 0 && deleteIndex > updateIndex);
    assert.match(
      service,
      /deletePublicMedia\(\{\s*kind: "cms-media",\s*fileName: newResolvedKey,?\s*\}\)/,
    );
  });

  test("moderation and identity uploads remove a stored private object after database failure", () => {
    const moderation = source("services/moderation.service.ts");
    const identity = source(
      "app/api/v1/users/personal-info/identity-document/route.ts",
    );
    assert.match(
      moderation,
      /deletePrivateMedia\(\{\s*kind: "moderation-evidence",\s*fileName: stored\.storagePath,?\s*\}\)/,
    );
    assert.match(
      identity,
      /deletePrivateMedia\(\{\s*kind: "host-documents",\s*fileName: saved\.storagePath,?\s*\}\)/,
    );
    const identityAction = source("actions/user/personal-info.ts");
    assert.match(identityAction, /validateDocumentUpload\(/);
    assert.match(
      identityAction,
      /deletePrivateMedia\(\{\s*kind: "host-documents",\s*fileName: saved\.storagePath,?\s*\}\)/,
    );
  });

  test("listing, travel, and host-document uploads do not leave a new object behind when persistence fails", () => {
    const listingMedia = source("services/listing-media.service.ts");
    const travelPhoto = source("services/travel-photo.service.ts");
    const hostApplication = source("services/host-application.service.ts");
    const travelCover = source("app/api/v1/travel-media/cover/route.ts");
    assert.match(
      listingMedia,
      /await deleteManagedMediaUrl\(saved\.url\)\.catch\(\(\) => \{\}\)/,
    );
    assert.match(
      travelPhoto,
      /await deleteManagedMediaUrl\(saved\.url\)\.catch\(\(\) => \{\}\)/,
    );
    assert.match(
      hostApplication,
      /await deleteManagedMediaUrl\(relativeUrl\)\.catch\(\(\) => \{\}\)/,
    );
    assert.match(
      travelCover,
      /await deleteManagedMediaUrl\(saved\.url\)\.catch\(\(\) => \{\}\)/,
    );
  });

  test("admin stamp artwork is byte-validated before public storage", () => {
    const route = source("app/api/v1/admin/travel-stamps/upload/route.ts");
    assert.match(route, /validatePublicImageUpload\(/);
    assert.doesNotMatch(route, /image\/svg\+xml/);
  });
});
