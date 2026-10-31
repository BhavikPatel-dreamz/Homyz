import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getVerificationState, type LicenseResult } from "@/components/host/onboarding/step-license-approval";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 6: getVerificationState correctly computes verification status machine", () => {
  // Idle state
  assert.deepEqual(getVerificationState(null), {
    status: "idle",
    errorMessage: null,
    canPublish: false,
  });

  // Valid state (active, eligible, automaticApprovalAvailable)
  const validResult: LicenseResult = {
    licenseNumber: "50036463",
    status: "ACTIVE",
    expiryDate: "2030-01-01T00:00:00.000Z",
    eligibilityStatus: "ELIGIBLE",
    automaticApprovalAvailable: true,
    simulated: false,
    error: null,
    lastVerifiedAt: "2026-10-31T00:00:00.000Z",
  };
  assert.deepEqual(getVerificationState(validResult), {
    status: "valid",
    errorMessage: null,
    canPublish: true,
  });

  // Invalid state (revoked, suspended, or fixture missing)
  const invalidResult: LicenseResult = {
    licenseNumber: "INVALID123",
    status: "INVALID",
    expiryDate: null,
    eligibilityStatus: "INELIGIBLE",
    automaticApprovalAvailable: false,
    simulated: false,
    error: "License was not found by the portal.",
    lastVerifiedAt: null,
  };
  assert.equal(getVerificationState(invalidResult).status, "invalid");
  assert.equal(getVerificationState(invalidResult).canPublish, false);
  assert.equal(getVerificationState(invalidResult).errorMessage, "License was not found by the portal.");

  // Expired state
  const expiredResult: LicenseResult = {
    licenseNumber: "50036463",
    status: "EXPIRED",
    expiryDate: "2020-01-01T00:00:00.000Z",
    eligibilityStatus: "EXPIRED",
    automaticApprovalAvailable: false,
    simulated: false,
    error: null,
    lastVerifiedAt: null,
  };
  assert.equal(getVerificationState(expiredResult).status, "expired");
  assert.equal(getVerificationState(expiredResult).canPublish, false);
  assert.match(getVerificationState(expiredResult).errorMessage!, /expired/i);

  // Error / unavailable state
  const unavailableResult: LicenseResult = {
    licenseNumber: "50036463",
    status: "UNAVAILABLE",
    expiryDate: null,
    eligibilityStatus: "PROVIDER_UNAVAILABLE",
    automaticApprovalAvailable: false,
    simulated: false,
    error: "Verification service is down.",
    lastVerifiedAt: null,
  };
  assert.equal(getVerificationState(unavailableResult).status, "error");
  assert.equal(getVerificationState(unavailableResult).canPublish, false);
});

test("Phase 1-6: StepLicenseApproval component enforces explicit state headings and actions", () => {
  const component = read("components/host/onboarding/step-license-approval.tsx");

  // State headings
  assert.match(component, /Yay! It’s time to publish\./);
  assert.match(component, /Verifying your property license/);
  assert.match(component, /Your property license is not valid/);
  assert.match(component, /Your property license has expired/);
  assert.match(component, /We couldn't verify your property license/);

  // Footer actions: Save draft vs Save and publish
  assert.match(component, /Save draft/);
  assert.match(component, /Save and publish/);
  assert.match(component, /Edit registration details/);
  assert.match(component, /Try again/);

  // Obey GEMINI.md font-weight rule (no font-bold, no font-semibold)
  assert.doesNotMatch(component, /font-semibold/);
  assert.doesNotMatch(component, /font-bold/);

  // Proper listing photo & placeholder fallback
  assert.match(component, /displayPhoto/);
  assert.match(component, /host_license_preview_placeholder/);
});

test("Phase 7: Backend publish guard requires valid and eligible Saudi license", () => {
  const service = read("services/listing.service.ts");
  assert.match(
    service,
    /isSaudiArabia\(existing\.country\) && existing\.licenseEligibilityStatus !== ListingLicenseEligibilityStatus\.ELIGIBLE/
  );
});

test("Registration API endpoints and client hooks are properly wired", () => {
  const regRoute = read("app/api/v1/host/licenses/[listingId]/registration/route.ts");
  const pubRoute = read("app/api/v1/host/licenses/[listingId]/publish/route.ts");
  const wizard = read("components/host/new-listing-get-started.tsx");

  assert.match(regRoute, /getRegistrationDetails/);
  assert.match(regRoute, /saveRegistrationDetails/);
  assert.match(pubRoute, /submitFinal/);

  // REST API calls in wizard
  assert.match(wizard, /\/api\/v1\/host\/licenses\/verify/);
  assert.match(wizard, /\/api\/v1\/host\/licenses\/\$\{activeDraftId\}\/registration/);
  assert.match(wizard, /\/api\/v1\/host\/licenses\/\$\{activeDraftId\}\/publish/);
  assert.match(wizard, /onSaveDraft=\{handleSaveAndExit\}/);

  // Obey GEMINI.md font-weight rule
  assert.doesNotMatch(wizard, /font-semibold/);
  assert.doesNotMatch(wizard, /font-bold/);
});
