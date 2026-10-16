import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("Create listing photo upload navigation", () => {
  const readSource = (relativePath: string) =>
    fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

  it("sends the complete uploaded photo list to the wizard after a successful upload", () => {
    const photosStep = readSource("components/host/onboarding/step-photos.tsx");

    assert.match(photosStep, /const nextPhotos = \[\.\.\.photos, \.\.\.uploadedUrls\]/);
    assert.match(photosStep, /onUpdatePhotos\(nextPhotos\)/);
    assert.match(photosStep, /await onUploadComplete\(nextPhotos\)/);
    assert(
      photosStep.indexOf("await onUploadComplete(nextPhotos)") < photosStep.indexOf("setIsModalOpen(false)"),
      "the upload modal remains visible until the wizard save and transition complete",
    );
  });

  it("persists the fresh photo list and routes to Photo Review when five photos are available", () => {
    const wizard = readSource("components/host/new-listing-get-started.tsx");

    assert.match(wizard, /photos: overrides\?\.photos \?\? photos/);
    assert.match(wizard, /validateCurrentStep\(overrides\?\.photos\)/);
    assert.match(wizard, /uploadedPhotos\.length >= 5/);
    assert.match(wizard, /saveDraftAndGoToStep\(10, \{ photos: uploadedPhotos \}\)/);
  });
});
