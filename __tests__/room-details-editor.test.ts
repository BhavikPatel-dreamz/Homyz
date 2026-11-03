import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Room Details Editor — Top Save & Cancel Buttons and Typography", () => {
  const panelsFilePath = path.join(
    process.cwd(),
    "app/(protected)/host/listings/[id]/components/RoomDetailsPanels.tsx"
  );
  const managerFilePath = path.join(
    process.cwd(),
    "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"
  );

  test("File exists and can be read", () => {
    assert.ok(fs.existsSync(panelsFilePath), "RoomDetailsPanels.tsx should exist");
    assert.ok(fs.existsSync(managerFilePath), "PhotoTourManager.tsx should exist");
  });

  test("Strict adherence to GEMINI.md typography: 0 instances of font-bold and font-semibold", () => {
    const content = fs.readFileSync(panelsFilePath, "utf8");
    const boldMatches = content.match(/font-bold|font-semibold/g) || [];
    assert.strictEqual(
      boldMatches.length,
      0,
      `Found forbidden font weights in RoomDetailsPanels.tsx: ${boldMatches.join(", ")}`
    );

    const tagMatches = content.match(/<b\b|<strong\b/g) || [];
    assert.strictEqual(
      tagMatches.length,
      0,
      `Found forbidden <b> or <strong> tags in RoomDetailsPanels.tsx`
    );
  });

  test("RoomAmenitiesPanel has Cancel and Done buttons in the top header", () => {
    const content = fs.readFileSync(panelsFilePath, "utf8");
    const amenitiesSection = content.slice(
      content.indexOf("export function RoomAmenitiesPanel"),
      content.indexOf("export function RoomPrivacyPanel")
    );

    // Top action buttons present in header
    assert.ok(
      amenitiesSection.includes("Header with Top Action Buttons"),
      "Amenities panel should contain top header with actions"
    );
    assert.ok(
      amenitiesSection.includes("onClick={onCancel}"),
      "Amenities panel should have onCancel action on top"
    );
    assert.ok(
      amenitiesSection.includes("onClick={onDone}"),
      "Amenities panel should have onDone action on top"
    );
    // No bottom action footer
    assert.ok(
      !amenitiesSection.includes("Sticky Bottom Action Footer"),
      "Amenities panel should not have a bottom action footer"
    );
  });

  test("RoomPrivacyPanel has Cancel and Save buttons in the top header", () => {
    const content = fs.readFileSync(panelsFilePath, "utf8");
    const privacySection = content.slice(
      content.indexOf("export function RoomPrivacyPanel"),
      content.indexOf("export function RoomAccessibilityPanel")
    );

    // Top action buttons present in header
    assert.ok(
      privacySection.includes("Header with Top Action Buttons"),
      "Privacy panel should contain top header with actions"
    );
    assert.ok(
      privacySection.includes("onClick={onCancel}"),
      "Privacy panel should have onCancel action on top"
    );
    assert.ok(
      privacySection.includes("onClick={onSave}"),
      "Privacy panel should have onSave action on top"
    );
    // No bottom action footer
    assert.ok(
      !privacySection.includes("Sticky Bottom Action Footer"),
      "Privacy panel should not have a bottom action footer"
    );
  });

  test("RoomAccessibilityPanel has Cancel and Done buttons in the top header", () => {
    const content = fs.readFileSync(panelsFilePath, "utf8");
    const accessibilitySection = content.slice(
      content.indexOf("export function RoomAccessibilityPanel"),
      content.indexOf("export function RoomSleepingPanel")
    );

    // Top action buttons present in header
    assert.ok(
      accessibilitySection.includes("Header with Top Action Buttons"),
      "Accessibility panel should contain top header with actions"
    );
    assert.ok(
      accessibilitySection.includes("onClick={onCancel}"),
      "Accessibility panel should have onCancel action on top"
    );
    assert.ok(
      accessibilitySection.includes("onClick={onDone}"),
      "Accessibility panel should have onDone action on top"
    );
    // No bottom action footer
    assert.ok(
      !accessibilitySection.includes("Sticky Bottom Action Footer"),
      "Accessibility panel should not have a bottom action footer"
    );
  });

  test("RoomSleepingPanel has Cancel and Save buttons in the top header", () => {
    const content = fs.readFileSync(panelsFilePath, "utf8");
    const sleepingSection = content.slice(
      content.indexOf("export function RoomSleepingPanel")
    );

    // Top action buttons present in header
    assert.ok(
      sleepingSection.includes("Header with Top Action Buttons"),
      "Sleeping arrangements panel should contain top header with actions"
    );
    assert.ok(
      sleepingSection.includes("onClick={onCancel}"),
      "Sleeping arrangements panel should have onCancel action on top"
    );
    assert.ok(
      sleepingSection.includes("onClick={onSave}"),
      "Sleeping arrangements panel should have onSave action on top"
    );
    // No bottom action footer
    assert.ok(
      !sleepingSection.includes("Sticky Bottom Action Footer"),
      "Sleeping arrangements panel should not have a bottom action footer"
    );
  });

  test("PhotoTourManager properly mounts the 4th section side panels in split mode", () => {
    const content = fs.readFileSync(managerFilePath, "utf8");
    assert.ok(
      content.includes("<RoomAmenitiesPanel"),
      "PhotoTourManager should mount RoomAmenitiesPanel"
    );
    assert.ok(
      content.includes("<RoomPrivacyPanel"),
      "PhotoTourManager should mount RoomPrivacyPanel"
    );
    assert.ok(
      content.includes("<RoomAccessibilityPanel"),
      "PhotoTourManager should mount RoomAccessibilityPanel"
    );
    assert.ok(
      content.includes("<RoomSleepingPanel"),
      "PhotoTourManager should mount RoomSleepingPanel"
    );
  });
});

