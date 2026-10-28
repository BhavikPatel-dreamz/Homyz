import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(
  path.join(root, "components/travel/travel-photo-upload-modal.tsx"),
  "utf8",
);

describe("Travel photo upload modal redesign", () => {
  it("keeps selected files local until the explicit publish action", () => {
    const selectionHandler = source.slice(
      source.indexOf("const validateAndAddFiles"),
      source.indexOf("const handleDrop"),
    );
    assert.match(selectionHandler, /setStep\("preview"\)/);
    assert.doesNotMatch(selectionHandler, /executeUploadSequence\(combined\)/);
    assert.match(source, /const handlePublish = \(\) =>/);
    assert.match(source, /void executeUploadSequence\(items\)/);
  });

  it("retains real capacity, editable metadata, and cover selection", () => {
    assert.match(source, /MAX_PHOTOS_PER_TRIP - currentTripPhotoCount/);
    assert.match(source, /const \[coverItemId, setCoverItemId\]/);
    assert.match(source, /body: JSON\.stringify\(\{ coverPhotoId: selectedCover\.id \}\)/);
    assert.match(source, /TagPeopleInput/);
    assert.match(source, /End date cannot be before start date/);
  });

  it("uses persisted trip identity while making duplicate names distinguishable and full trips unavailable", () => {
    assert.match(source, /key=\{trip\.id\}/);
    assert.match(source, /trip\.destination\?\.countryName/);
    assert.match(source, /new Date\(trip\.startDate\)/);
    assert.match(source, /disabled=\{full && selectedTripId !== trip\.id\}/);
    assert.match(source, /\{full \? "Full"/);
  });

  it("provides an image-first dropzone and active-image preview", () => {
    assert.match(source, /Share Your Travel Moments/);
    assert.match(source, /Drag photos here/);
    assert.match(source, /Select Photos/);
    assert.match(source, /const \[activeItemId, setActiveItemId\]/);
    assert.match(source, /Cover photo/);
    assert.match(source, /Discard selected photos\?/);
  });
});
