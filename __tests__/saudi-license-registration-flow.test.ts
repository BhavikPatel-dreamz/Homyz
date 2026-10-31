import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WIZARD_STEPS } from "@/components/host/onboarding/wizard-steps";
import {
  PRIVATE_ACCOMMODATION_TYPE,
  TRADITIONAL_ACCOMMODATION_TYPE,
  resolveAccommodationType,
} from "@/components/host/onboarding/step-registration-details";
import { validateSaudiRegistrationDetails } from "@/lib/validation/saudi-license-registration";

describe("Saudi listing registration flow", () => {
  it("keeps registration and publishing as distinct final wizard steps", () => {
    assert.equal(WIZARD_STEPS[20]?.slug, "registration-details");
    assert.equal(WIZARD_STEPS[21]?.slug, "publish");
  });

  it("defaults accommodation type to private short-term rental to prevent false validation errors", () => {
    assert.equal(resolveAccommodationType(undefined), PRIVATE_ACCOMMODATION_TYPE);
    assert.equal(resolveAccommodationType(null), PRIVATE_ACCOMMODATION_TYPE);
    assert.equal(resolveAccommodationType(""), PRIVATE_ACCOMMODATION_TYPE);
    assert.equal(
      resolveAccommodationType(TRADITIONAL_ACCOMMODATION_TYPE),
      TRADITIONAL_ACCOMMODATION_TYPE
    );
  });

  it("accepts a leading-zero permit and validates Saudi national ID format", () => {
    const result = validateSaudiRegistrationDetails({
      accommodationType: "PRIVATE_SHORT_TERM_RENTAL",
      licenseNumber: "000-SA-123",
      nationalId: "1234567890",
    });
    assert.equal(result.licenseNumber, "000-SA-123");
    assert.throws(() => validateSaudiRegistrationDetails({
      accommodationType: "PRIVATE_SHORT_TERM_RENTAL",
      licenseNumber: "000-SA-123",
      nationalId: "0123456789",
    }));
  });
});
