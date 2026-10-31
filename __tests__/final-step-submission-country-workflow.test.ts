import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isSaudiArabia } from "@/lib/location/address-countries";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Country Detection: Correctly distinguishes Saudi Arabia vs International countries", () => {
  // Saudi variants
  assert.equal(isSaudiArabia("Saudi Arabia"), true);
  assert.equal(isSaudiArabia("Saudi Arabia - SA"), true);
  assert.equal(isSaudiArabia("SA"), true);
  assert.equal(isSaudiArabia("KSA"), true);
  assert.equal(isSaudiArabia("  sa  "), true);

  // International variants (must be false)
  assert.equal(isSaudiArabia("India"), false);
  assert.equal(isSaudiArabia("India - IN"), false);
  assert.equal(isSaudiArabia("United Arab Emirates"), false);
  assert.equal(isSaudiArabia("United Arab Emirates - AE"), false);
  assert.equal(isSaudiArabia("United States - US"), false);
  assert.equal(isSaudiArabia("France - FR"), false);
  assert.equal(isSaudiArabia(""), false);
  assert.equal(isSaudiArabia(null), false);
  assert.equal(isSaudiArabia(undefined), false);
});

test("Scenario A: International Property Workflow in StepLicenseApproval", () => {
  const component = read("components/host/onboarding/step-license-approval.tsx");

  // Heading for international listings
  assert.match(component, /You're ready to submit your listing/);
  assert.match(component, /Review your listing details before sending them for approval/);

  // Section: What happens next?
  assert.match(component, /What happens next\?/);
  assert.match(component, /Submit for review/);
  assert.match(component, /We review your listing/);
  assert.match(component, /Your listing goes live/);

  // Informational notice
  assert.match(component, /Your listing will remain unpublished until it has been reviewed and approved\./);

  // Submission action
  assert.match(component, /Submit for review/);
  assert.match(component, /Submitting for review\.\.\./);
});

test("Scenario B: Saudi Arabia Property Workflow in StepLicenseApproval", () => {
  const component = read("components/host/onboarding/step-license-approval.tsx");

  // Saudi publishing headings
  assert.match(component, /You're ready to publish!/);
  assert.match(component, /Take one last look at your listing before making it available to guests\./);

  // Saudi next steps
  assert.match(component, /Set up your calendar/);
  assert.match(component, /Review your booking preferences/);
  assert.match(component, /Get ready for your first guest/);

  // Saudi publishing actions
  assert.match(component, /Publish listing/);
  assert.match(component, /Publishing listing\.\.\./);

  // License verification states
  assert.match(component, /Verifying your property license/);
  assert.match(component, /Your property license is not valid/);
  assert.match(component, /Your property license has expired/);
  assert.match(component, /We couldn't verify your property license/);
});

test("Listing Preview: Uses actual saved data dynamically", () => {
  const component = read("components/host/onboarding/step-license-approval.tsx");

  // Cover image with placeholder fallback
  assert.match(component, /displayPhoto/);
  assert.match(component, /host_license_preview_placeholder/);
  assert.match(component, /Listing preview/);

  // Dynamic fields
  assert.match(component, /formatLocationDisplay/);
  assert.match(component, /formatPreviewPrice/);
  assert.match(component, /guests/);
  assert.match(component, /bedrooms/);
  assert.match(component, /beds/);
  assert.match(component, /resolvedCurrency/);

  // Preview action
  assert.match(component, /Preview/);
});

test("Post-Submission Screens: Handles Pending Review and Published states cleanly", () => {
  const component = read("components/host/onboarding/step-license-approval.tsx");

  // International successful submission
  assert.match(component, /Your listing has been submitted!/);
  assert.match(component, /Your listing is now under review\. We'll notify you once a decision has been made\./);
  assert.match(component, /Pending review/);
  assert.match(component, /Listing Review Progress/);
  assert.match(component, /Go to your listings/);
  assert.match(component, /View listing details/);

  // Saudi successful publication
  assert.match(component, /Yay! Your listing is published\./);
  assert.match(component, /Published/);
});

test("Wizard Integration: Step 21 passes rich draft data and manages listing status", () => {
  const wizard = read("components/host/new-listing-get-started.tsx");

  assert.match(wizard, /listingStatus=\{listingStatus\}/);
  assert.match(wizard, /category=\{selectedCategory\}/);
  assert.match(wizard, /placeType=\{selectedPlaceType\}/);
  assert.match(wizard, /guests=\{guests\}/);
  assert.match(wizard, /bedrooms=\{bedrooms\}/);
  assert.match(wizard, /beds=\{beds\}/);
  assert.match(wizard, /bathrooms=\{bathrooms\}/);
  assert.match(wizard, /currency=\{currencySymbol\}/);

  // Non-Saudi steps routing: Step 19 -> Step 21 directly (bypassing step 20)
  assert.match(wizard, /onNext=\{\(\) => saveDraftAndGoToStep\(isSaudiArabia\(country\) \? 20 : 21\)\}/);
  assert.match(wizard, /onBack=\{\(\) => goToStep\(isSaudiArabia\(country\) \? 20 : 19\)\}/);
});

test("Backend Guard: Non-Saudi listing cannot bypass admin review", () => {
  const saudiService = read("services/saudi-license.service.ts");
  assert.match(saudiService, /const isSaudi = isSaudiArabia\(listing\.country\);/);
  assert.match(saudiService, /if \(!isSaudi \|\| requestedMethod === "manual"\)/);
  assert.match(saudiService, /ListingApprovalMethod\.MANUAL_REVIEW/);
  assert.match(saudiService, /listingService\.submitForReview\(actor, listingId\)/);

  const listingService = read("services/listing.service.ts");
  assert.match(listingService, /status: ListingStatus\.PENDING_REVIEW/);
  assert.match(listingService, /published: false/);
});

test("Typography Font Weight (GEMINI.md Rule)", () => {
  const component = read("components/host/onboarding/step-license-approval.tsx");
  const wizard = read("components/host/new-listing-get-started.tsx");

  assert.doesNotMatch(component, /font-semibold/);
  assert.doesNotMatch(component, /font-bold/);
  assert.doesNotMatch(component, /<b>/);
  assert.doesNotMatch(component, /<strong>/);

  assert.doesNotMatch(wizard, /font-semibold/);
  assert.doesNotMatch(wizard, /font-bold/);
  assert.doesNotMatch(wizard, /<b>/);
  assert.doesNotMatch(wizard, /<strong>/);
});

