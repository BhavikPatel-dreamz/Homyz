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
  assert.ok(!keys.includes("safetyDisclosures"), "Must NOT flag safetyDisclosures (now optional)");
  assert.equal(missing.length, 7);
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

  // 7. Saudi Arabia listings: No admin approval required, Ready to publish (APPROVED) when complete
  assert.equal(
    getListingDisplayState("DRAFT", false, 0, "Saudi Arabia"),
    "APPROVED",
    "Complete Saudi listing must show APPROVED (Ready to publish directly)",
  );
  assert.equal(
    getListingDisplayState("PENDING_REVIEW", false, 0, "SA"),
    "APPROVED",
    "Saudi listing with 0 missing fields must show APPROVED (Ready to publish directly)",
  );
  assert.equal(
    getListingDisplayState("DRAFT", false, 2, "Saudi Arabia"),
    "DRAFT",
    "Incomplete Saudi listing must show DRAFT",
  );
});

test("Listing Status Actions: submitListingForReviewAction & resubmitListingForReviewAction are defined functions", () => {
  assert.equal(typeof submitListingForReviewAction, "function");
  assert.equal(typeof resubmitListingForReviewAction, "function");
});

test("Listing Status Component: Pending review shows clean single status without house illustration", async () => {
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
    city: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
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

  // 1. House Illustration SVG must be removed
  assert.ok(!html.includes("viewBox=\"0 0 200 160\""), "Must NOT contain old cartoon house illustration SVG");

  // 2. Must show clean Pending Review status
  assert.ok(html.includes("Pending review"), "Must display Pending review status");
  assert.ok(
    html.includes("Your listing is being reviewed"),
    "Must explain listing is being reviewed"
  );

  // 3. Must not show premature Listed active controls for unpublished review
  assert.ok(!html.includes("Listing visibility"), "Unpublished listing must not show visibility switcher");
});

test("Listing Status Component: Approved unpublished listing shows Ready to publish and Publish listing action", async () => {
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
    city: "London",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
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

  // Must render Ready to publish status
  assert.ok(/Ready to [pP]ublish/.test(html), "Must display Ready to publish status");
  assert.ok(html.includes("Publish listing"), "Must display Publish listing primary action");
  // House SVG must be removed
  assert.ok(!html.includes("viewBox=\"0 0 200 160\""), "Must NOT contain old cartoon house illustration");
});

test("Listing Status Component: Published listing renders Airbnb-inspired Listed and Unlisted visibility controls", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ListingStatusView } = await import(
    "../app/(protected)/host/listings/[id]/components/ListingStatusView"
  );

  const publishedListing = {
    id: "cmtwgd9jz00085eastgi95o32",
    title: "Saudi Luxury Penthouse",
    description: "An exceptional stay with all amenities included in the center of Riyadh.",
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
    status: "ACTIVE",
    published: true,
  };

  const html = renderToStaticMarkup(
    React.createElement(ListingStatusView, {
      listing: publishedListing as any,
      setActiveSection: () => {},
      status: "listed",
    })
  );

  // 1. Must display single status "Listed" and active indicator
  assert.ok(html.includes("Listed"), "Must display Listed status");
  assert.ok(html.includes("Active"), "Must display Active badge/indicator");
  // 2. Must display Listing visibility section
  assert.ok(html.includes("Listing visibility"), "Must display Listing visibility section");
  // 3. Must display Listed and Unlisted options
  assert.ok(/Guests can find/.test(html), "Must describe Listed option");
  assert.ok(/hidden from search/.test(html), "Must describe Unlisted option");
  // 4. Must display Save changes and Cancel buttons
  assert.ok(html.includes("Save changes"), "Must display Save changes button");
  assert.ok(html.includes("Cancel"), "Must display Cancel button");
  // 5. Must NOT display cartoon house illustration
  assert.ok(!html.includes("viewBox=\"0 0 200 160\""), "Must NOT contain old cartoon house illustration");
});


