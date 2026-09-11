import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeMissingRequirements,
  getListingDisplayState,
} from "../app/(protected)/host/listings/[id]/components/ListingStatusView";
import {
  submitListingForReviewAction,
  resubmitListingForReviewAction,
} from "../actions/host/listings";

test("Listing Status Page: computeMissingRequirements detects incomplete fields", () => {
  // Empty listing
  const incompleteListing = {
    title: "",
    description: "",
    price: 0,
    weekendPrice: null,
    photos: [],
    propertyType: "",
    listingType: "",
    address: "",
    city: "",
    country: "",
    latitude: null,
    longitude: null,
    safetyDisclosures: [],
  };

  const missing = computeMissingRequirements(incompleteListing as any);
  const keys = missing.map((m) => m.key);

  assert.ok(keys.includes("propertyType"), "Must flag propertyType");
  assert.ok(keys.includes("location"), "Must flag location");
  assert.ok(keys.includes("photos"), "Must flag photos");
  assert.ok(keys.includes("title"), "Must flag title");
  assert.ok(keys.includes("description"), "Must flag description");
  assert.ok(keys.includes("price"), "Must flag price");
  assert.ok(keys.includes("weekendPrice"), "Must flag weekendPrice");
  assert.ok(keys.includes("safetyDisclosures"), "Must flag safetyDisclosures");
  assert.equal(missing.length, 8);
});

test("Listing Status Page: computeMissingRequirements passes when all fields are complete", () => {
  const completeListing = {
    title: "Charming Luxury Villa in Downtown",
    description: "A wonderful stay with full amenities and spacious rooms for families.",
    price: 15000,
    weekendPrice: 18000,
    photos: [
      "/photos/1.jpg",
      "/photos/2.jpg",
      "/photos/3.jpg",
      "/photos/4.jpg",
      "/photos/5.jpg",
    ],
    propertyType: "VILLA",
    listingType: "ENTIRE_PLACE",
    address: "123 Palm Street",
    city: "Riyadh",
    country: "Saudi Arabia",
    latitude: 24.7136,
    longitude: 46.6753,
    safetyDisclosures: [
      "SECURITY_CAMERA:NO",
      "NOISE_MONITOR:NO",
      "WEAPONS:NO",
    ],
  };

  const missing = computeMissingRequirements(completeListing as any);
  assert.equal(missing.length, 0, "Complete listing must have 0 missing requirements");
});

test("Listing Status Page: getListingDisplayState maps database state to UI lifecycle states", () => {
  // 1. DRAFT with incomplete requirements
  assert.equal(
    getListingDisplayState("DRAFT", false, 3),
    "DRAFT",
    "Incomplete draft must show DRAFT (Complete your listing)",
  );

  // 2. READY_TO_SUBMIT when all requirements met
  assert.equal(
    getListingDisplayState("DRAFT", false, 0),
    "READY_TO_SUBMIT",
    "Complete draft must show READY_TO_SUBMIT (Ready for review)",
  );
  assert.equal(
    getListingDisplayState("IN_PROGRESS", false, 0),
    "READY_TO_SUBMIT",
    "Complete in_progress draft must show READY_TO_SUBMIT",
  );

  // 3. PENDING_APPROVAL when submitted to Admin
  assert.equal(
    getListingDisplayState("PENDING_REVIEW", false, 0),
    "PENDING_APPROVAL",
    "PENDING_REVIEW status must show PENDING_APPROVAL (Submitted for Admin Approval)",
  );
  assert.equal(
    getListingDisplayState("PENDING_REVIEW", false, 2),
    "PENDING_APPROVAL",
    "PENDING_REVIEW status takes precedence over missing count",
  );

  // 4. APPROVED
  assert.equal(
    getListingDisplayState("APPROVED", false, 0),
    "APPROVED",
    "APPROVED status must show APPROVED",
  );

  // 5. PUBLISHED (ACTIVE and published: true)
  assert.equal(
    getListingDisplayState("ACTIVE", true, 0),
    "PUBLISHED",
    "ACTIVE with published: true must show PUBLISHED (Listing is Live)",
  );

  // 6. REJECTED / CHANGES_REQUESTED
  assert.equal(
    getListingDisplayState("REJECTED", false, 0),
    "REJECTED",
    "REJECTED status must show REJECTED (Changes Required)",
  );
  assert.equal(
    getListingDisplayState("CHANGES_REQUESTED", false, 0),
    "REJECTED",
    "CHANGES_REQUESTED status must show REJECTED (Changes Required)",
  );
});

test("Listing Status Actions: submitListingForReviewAction & resubmitListingForReviewAction are defined functions", () => {
  assert.equal(typeof submitListingForReviewAction, "function");
  assert.equal(typeof resubmitListingForReviewAction, "function");
});

test("Listing Status Component: renders house illustration, listed & unlisted cards, and disabled state for PENDING_REVIEW", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ListingStatusView } = await import(
    "../app/(protected)/host/listings/[id]/components/ListingStatusView"
  );

  const pendingListing = {
    id: "cmtwgd9jz00085eastgi95o32",
    title: "Beautiful Luxury Penthouse",
    description: "An exceptional stay with all amenities included in the center of city.",
    price: 25000,
    weekendPrice: 30000,
    photos: ["/p1.jpg", "/p2.jpg", "/p3.jpg", "/p4.jpg", "/p5.jpg"],
    propertyType: "APARTMENT",
    listingType: "ENTIRE_PLACE",
    address: "100 King Road",
    city: "Riyadh",
    country: "Saudi Arabia",
    latitude: 24.7136,
    longitude: 46.6753,
    safetyDisclosures: ["SECURITY_CAMERA:NO", "NOISE_MONITOR:NO", "WEAPONS:NO"],
    status: "PENDING_REVIEW",
    published: false,
    submittedAt: "2026-09-10T12:00:00.000Z",
  };

  const html = renderToStaticMarkup(
    React.createElement(ListingStatusView, {
      listing: pendingListing as any,
      setActiveSection: () => {},
      status: "unlisted",
    })
  );

  // 1. Must render House Illustration SVG
  assert.ok(html.includes("viewBox=\"0 0 200 160\""), "Must contain Figma house illustration SVG");
  assert.ok(html.includes("#FDE047"), "Must contain house roof color");

  // 2. Must render "Listed" and "Unlisted" cards
  assert.ok(html.includes("Listed"), "Must render Listed card");
  assert.ok(html.includes("Unlisted"), "Must render Unlisted card");

  // 3. Must show Admin Approval Required message
  assert.ok(html.includes("Admin approval required"), "Must display Admin approval required heading");
  assert.ok(
    html.includes("Your listing has been submitted for review"),
    "Must explain property is submitted for review"
  );
  assert.ok(
    html.includes("Do not show the listing as fully published until the admin has actually approved it"),
    "Must include requirement to not show as published until approved"
  );

  // 4. Must show Disabled / Locked indicator for "Listed"
  assert.ok(html.includes("Locked"), "Must show Locked badge on Listed card");
  assert.ok(
    html.includes("Requires Admin Approval before publishing"),
    "Must explain why Listed is disabled"
  );
  assert.ok(html.includes("Save (Disabled: Admin approval required)"), "Save button must be disabled for unapproved listing");
});

test("Listing Status Component: enables Listed card and shows Approved banner when APPROVED", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ListingStatusView } = await import(
    "../app/(protected)/host/listings/[id]/components/ListingStatusView"
  );

  const approvedListing = {
    id: "cmtwgd9jz00085eastgi95o32",
    title: "Approved Luxury Penthouse",
    description: "An exceptional stay with all amenities included in the center of city.",
    price: 25000,
    weekendPrice: 30000,
    photos: ["/p1.jpg", "/p2.jpg", "/p3.jpg", "/p4.jpg", "/p5.jpg"],
    propertyType: "APARTMENT",
    listingType: "ENTIRE_PLACE",
    address: "100 King Road",
    city: "Riyadh",
    country: "Saudi Arabia",
    latitude: 24.7136,
    longitude: 46.6753,
    safetyDisclosures: ["SECURITY_CAMERA:NO", "NOISE_MONITOR:NO", "WEAPONS:NO"],
    status: "APPROVED",
    published: false,
  };

  const html = renderToStaticMarkup(
    React.createElement(ListingStatusView, {
      listing: approvedListing as any,
      setActiveSection: () => {},
      status: "unlisted",
    })
  );

  // Must render Approved banner
  assert.ok(html.includes("Listing Approved"), "Must display Listing Approved banner");
  // Must render House SVG
  assert.ok(html.includes("viewBox=\"0 0 200 160\""), "Must contain house illustration");
  // Listed card must be enabled (not Locked)
  assert.ok(!html.includes("Save (Disabled: Admin approval required)"), "Save button should be enabled");
});


