import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   DRAFT & READY LISTING PUBLISH / UNPUBLISH LIFECYCLE AUDIT      ");
console.log("==================================================================\n");

// --- [1] Admin Listing Review View Button State Audit ---
console.log("--- [1] Admin Listing Review View Button State Audit ---");
const reviewViewPath = path.resolve(
  __dirname,
  "../app/(protected)/admin/listings/[id]/admin-listing-review-view.tsx"
);
assert(fs.existsSync(reviewViewPath), "admin-listing-review-view.tsx must exist");
const reviewViewCode = fs.readFileSync(reviewViewPath, "utf-8");

// Publish button enabled when !published and requirements complete (even in Draft)
assert(
  reviewViewCode.includes('disabled={saving !== null || listing.published || missingRequirements.length > 0}'),
  "Publish button must be enabled when !listing.published and missingRequirements.length === 0, including DRAFT status"
);

// Approve button enabled for PENDING_REVIEW and DRAFT when requirements complete and not published
assert(
  reviewViewCode.includes(
    'disabled={saving !== null || missingRequirements.length > 0 || (listing.status !== "PENDING_REVIEW" && listing.status !== "DRAFT") || listing.published}'
  ),
  "Approve button must be enabled for complete listings in DRAFT or PENDING_REVIEW status"
);

// Unpublish button enabled when published
assert(
  reviewViewCode.includes('disabled={saving !== null || !listing.published}'),
  "Unpublish button must be enabled when listing is published"
);
console.log("✓ AdminListingReviewView button states verified!");

// --- [2] Admin Toggle Visibility Action Audit ---
console.log("\n--- [2] Admin Toggle Visibility Action Audit ---");
const adminActionsPath = path.resolve(__dirname, "../actions/admin/listingActions.ts");
assert(fs.existsSync(adminActionsPath), "actions/admin/listingActions.ts must exist");
const adminActionsCode = fs.readFileSync(adminActionsPath, "utf-8");

// Must not artificially block publishing when status is DRAFT
assert(
  !adminActionsCode.includes('listing.status !== ListingStatus.ACTIVE && listing.status !== ListingStatus.APPROVED'),
  "adminToggleVisibilityAction must not throw 'Approve a submitted listing before making it public' for complete draft listings"
);

// Validates completeness before publishing
assert(
  adminActionsCode.includes("listingService.getPublishReadiness(listing)"),
  "adminToggleVisibilityAction must validate publish readiness before publishing"
);

// Sets ACTIVE and approval metadata when publishing
assert(
  adminActionsCode.includes("status: ListingStatus.ACTIVE"),
  "Publishing must set status to ACTIVE"
);
assert(
  adminActionsCode.includes("approvedAt: listing.approvedAt ?? new Date()"),
  "Publishing must set approvedAt timestamp"
);

// Sets DRAFT when unpublishing
assert(
  adminActionsCode.includes("status: ListingStatus.DRAFT"),
  "Unpublishing must set status to DRAFT"
);
console.log("✓ adminToggleVisibilityAction verified!");

// --- [3] Listing Service Publishing & Approval Audit ---
console.log("\n--- [3] Listing Service Publishing & Approval Audit ---");
const servicePath = path.resolve(__dirname, "../services/listing.service.ts");
assert(fs.existsSync(servicePath), "services/listing.service.ts must exist");
const serviceCode = fs.readFileSync(servicePath, "utf-8");

// approveListingByAdmin allows DRAFT
assert(
  serviceCode.includes('existing.status !== ListingStatus.PENDING_REVIEW && existing.status !== ListingStatus.DRAFT'),
  "approveListingByAdmin must allow approving complete listings in DRAFT status"
);

// publishListing allows admins or approved listings
assert(
  serviceCode.includes("actor.role === Role.ADMIN") &&
  serviceCode.includes("Boolean(existing.approvedAt)"),
  "publishListing must allow admins and previously approved listings to publish directly"
);
console.log("✓ services/listing.service.ts verified!");

// --- [4] Host Status View Re-Publish Audit ---
console.log("\n--- [4] Host Status View Re-Publish Audit ---");
const hostStatusViewPath = path.resolve(
  __dirname,
  "../app/(protected)/host/listings/[id]/components/ListingStatusView.tsx"
);
assert(fs.existsSync(hostStatusViewPath), "ListingStatusView.tsx must exist");
const hostStatusCode = fs.readFileSync(hostStatusViewPath, "utf-8");

assert(
  hostStatusCode.includes("Boolean(listing?.approvedAt)"),
  "ListingStatusView must recognize approvedAt so hosts can re-publish approved listings after unpublishing"
);
console.log("✓ ListingStatusView verified!");

console.log("\n==================================================================");
console.log("   ALL DRAFT & READY PUBLISH / UNPUBLISH TESTS PASSED!            ");
console.log("==================================================================\n");

