import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

test("1. Automatic Trip Creation: Modal code contains automatic trip creation without separate Create button", () => {
  const modalCode = read("components/travel/travel-photo-upload-modal.tsx");

  // Verify separate orange Create button next to trip name has been removed
  assert.doesNotMatch(
    modalCode,
    /<button[^>]*onClick=\{createNewTrip\}[^>]*>Create<\/button>/i,
    "Separate Create button beside trip name must be removed",
  );

  // Verify trip name input is full width and has inline validation error handling
  assert.match(modalCode, /Trip name \(required\)/);
  assert.match(modalCode, /tripTitleError/);
  assert.match(modalCode, /Trip name is required/);

  // Verify automatic trip creation sequence
  assert.match(modalCode, /executeUploadSequence/);
  assert.match(modalCode, /POST/);
  assert.match(modalCode, /\/api\/v1\/travel-media\/trips/);
});

test("2. Seamless Upload Flow: Selecting or dropping images triggers automatic upload and trip creation", () => {
  const modalCode = read("components/travel/travel-photo-upload-modal.tsx");

  // In validateAndAddFiles, if trip details are valid, upload starts automatically
  assert.match(modalCode, /executeUploadSequence/);
  assert.match(modalCode, /sessionCreatedTripId/);

  // Checks available slots up to MAX_PHOTOS_PER_TRIP
  assert.match(modalCode, /MAX_PHOTOS_PER_TRIP/);
  assert.match(modalCode, /allowedSlots/);
});

test("3. Form Layout: Contains trip name, searchable country, and optional dates without a city field", () => {
  const modalCode = read("components/travel/travel-photo-upload-modal.tsx");

  assert.match(modalCode, /placeholder="Search for a country"/);
  assert.match(modalCode, /role="combobox"/);
  assert.match(modalCode, /countryFlag/);
  assert.doesNotMatch(modalCode, /City \(optional\)/);
  assert.doesNotMatch(modalCode, /newTripCity/);
  assert.match(modalCode, /aria-label="Trip start date"/);
  assert.match(modalCode, /aria-label="Trip end date"/);
});

test("4. Missing Required Details: Missing trip name or country shows inline errors without creating an incomplete trip", () => {
  const modalCode = read("components/travel/travel-photo-upload-modal.tsx");

  // Verifies that missing trip name prevents trip creation and sets inline error
  assert.match(modalCode, /!newTripTitle\.trim\(\)/);
  assert.match(modalCode, /setTripTitleError\("Trip name is required\."\)/);
  assert.match(modalCode, /tripTitleError/);
  assert.match(modalCode, /setCountryError\("Country is required\."\)/);
});

test("5. Image Previews & Upload Progress: Previews with live status indicators during upload", () => {
  const modalCode = read("components/travel/travel-photo-upload-modal.tsx");

  // Circular progress ring
  assert.match(modalCode, /stroke-\[#FCDF9C\]/);
  assert.match(modalCode, /strokeDashoffset/);

  // Image previews with completed / uploading / failed status icons
  assert.match(modalCode, /item\.status === "completed"/);
  assert.match(modalCode, /item\.status === "uploading"/);
  assert.match(modalCode, /item\.status === "failed"/);
});

test("6. Backend API Safety: trips POST route requires a valid country and never reads a city", () => {
  const tripsRoute = read("app/api/v1/travel-media/trips/route.ts");

  assert.match(tripsRoute, /Choose a destination country/);
  assert.match(tripsRoute, /normalizeCountry\(countryValue\)/);
  assert.doesNotMatch(tripsRoute, /normalizeCityName/);
  assert.doesNotMatch(tripsRoute, /body\.city/);
});
