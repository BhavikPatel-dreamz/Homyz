import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getVerificationState } from "@/components/host/onboarding/step-license-approval";

describe("Saudi license verification state", () => {
  it("keeps a valid result publishable without an error state", () => {
    const state = getVerificationState({
      licenseNumber: "ABC-123",
      status: "ACTIVE",
      expiryDate: "2030-01-01T00:00:00.000Z",
      eligibilityStatus: "ELIGIBLE",
      automaticApprovalAvailable: true,
      simulated: false,
      error: null,
      lastVerifiedAt: "2026-10-31T00:00:00.000Z",
    });

    assert.equal(state.status, "valid");
    assert.equal(state.canPublish, true);
    assert.equal(state.errorMessage, null);
  });

  it("marks invalid results as an inline error without redirecting", () => {
    const state = getVerificationState({
      licenseNumber: "INVALID-123",
      status: "INVALID",
      expiryDate: "2030-01-01T00:00:00.000Z",
      eligibilityStatus: "INELIGIBLE",
      automaticApprovalAvailable: false,
      simulated: false,
      error: null,
      lastVerifiedAt: null,
    });

    assert.equal(state.status, "invalid");
    assert.equal(state.canPublish, false);
    assert.equal(state.errorMessage, "License is not valid. Please check your registration details.");
  });

  it("marks expired results as a distinct expired state", () => {
    const state = getVerificationState({
      licenseNumber: "EXPIRED-123",
      status: "EXPIRED",
      expiryDate: "2020-01-01T00:00:00.000Z",
      eligibilityStatus: "EXPIRED",
      automaticApprovalAvailable: false,
      simulated: false,
      error: null,
      lastVerifiedAt: "2020-01-01T00:00:00.000Z",
    });

    assert.equal(state.status, "expired");
    assert.equal(state.canPublish, false);
    assert.equal(state.errorMessage, "Your property license has expired. Please update your registration details.");
  });

  it("marks verification outages as retryable errors", () => {
    const state = getVerificationState({
      licenseNumber: "ABC-123",
      status: "UNAVAILABLE",
      expiryDate: null,
      eligibilityStatus: "PROVIDER_UNAVAILABLE",
      automaticApprovalAvailable: false,
      simulated: false,
      error: "Unable to verify your license right now. Please try again.",
      lastVerifiedAt: null,
    });

    assert.equal(state.status, "error");
    assert.equal(state.canPublish, false);
    assert.equal(state.errorMessage, "Unable to verify your license right now. Please try again.");
  });
});
