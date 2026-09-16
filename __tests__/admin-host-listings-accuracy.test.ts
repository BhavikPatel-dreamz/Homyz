import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   ADMIN HOST LISTINGS & METRICS ACCURACY VERIFICATION SUITE       ");
console.log("==================================================================\n");

// --- [1] Admin Service Audit ---
console.log("--- [1] Admin Service Audit (services/admin.service.ts) ---");
const servicePath = path.resolve(__dirname, "../services/admin.service.ts");
assert(fs.existsSync(servicePath), "services/admin.service.ts must exist");
const serviceCode = fs.readFileSync(servicePath, "utf-8");

// Verify listUnifiedHosts queries live DB data without stale caching
assert(
  !serviceCode.includes("getOrSetCache(CACHE_KEYS.ADMIN_UNIFIED_HOSTS"),
  "listUnifiedHosts must not use stale caching that prevents updated host listing counts from reflecting immediately"
);

// Verify listings filtering for deletedAt: null
assert(
  serviceCode.includes("deletedAt: null"),
  "admin.service.ts must query listings with deletedAt: null to exclude soft-deleted listings"
);

// Verify totalListings and totalBookings platform-wide metrics calculation
assert(
  serviceCode.includes("prisma.listing.count({ where: { deletedAt: null } })"),
  "admin.service.ts must calculate totalListings platform-wide excluding deleted listings"
);
assert(
  serviceCode.includes("prisma.booking.count()"),
  "admin.service.ts must calculate totalBookings platform-wide"
);

// Verify getHostDetails resolves host from either user ID, registration request ID, or application ID
assert(
  serviceCode.includes("prisma.hostRegistrationRequest.findFirst"),
  "getHostDetails must support resolving host from registration request"
);
assert(
  serviceCode.includes("req.hostId") && serviceCode.includes("req.applicantEmail"),
  "getHostDetails must resolve user from req.hostId or applicantEmail"
);

// Verify co-host listings inclusion
assert(
  serviceCode.includes("coHostAssignments") || serviceCode.includes("ListingCoHostStatus.ACCEPTED"),
  "admin.service.ts must handle co-host assignments for hosts"
);

// Verify displayStatus mapping
assert(
  serviceCode.includes('displayStatus = "PAUSED"') && serviceCode.includes('displayStatus = "PUBLISHED"'),
  "admin.service.ts must map displayStatus accurately distinguishing PAUSED and PUBLISHED"
);

// Verify booking earnings calculation uses actual booking total/nightly price
assert(
  serviceCode.includes("b.totalPrice ?? b.nightlyPrice ?? l.price"),
  "admin.service.ts must use booking totalPrice or nightlyPrice rather than overwriting with listing base price"
);
console.log("✓ services/admin.service.ts verified successfully!");

// --- [2] Host Dashboard Metrics Audit ---
console.log("\n--- [2] Host Dashboard Metrics Audit (components/admin/host-phase1-dashboard.tsx) ---");
const dashboardPath = path.resolve(__dirname, "../components/admin/host-phase1-dashboard.tsx");
assert(fs.existsSync(dashboardPath), "components/admin/host-phase1-dashboard.tsx must exist");
const dashboardCode = fs.readFileSync(dashboardPath, "utf-8");

assert(
  dashboardCode.includes("analytics.totalListings ?? totalListings"),
  "Host Dashboard must use analytics.totalListings for the Total Listings metric card"
);
assert(
  dashboardCode.includes("analytics.totalBookings ?? totalBookings"),
  "Host Dashboard must use analytics.totalBookings for the Total Bookings metric card"
);
console.log("✓ components/admin/host-phase1-dashboard.tsx verified successfully!");

// --- [3] Host Details View Audit ---
console.log("\n--- [3] Host Details View Audit (components/admin/host-details-view.tsx) ---");
const detailsPath = path.resolve(__dirname, "../components/admin/host-details-view.tsx");
assert(fs.existsSync(detailsPath), "components/admin/host-details-view.tsx must exist");
const detailsCode = fs.readFileSync(detailsPath, "utf-8");

// Verify status badge
assert(
  detailsCode.includes("ListingStatusBadge"),
  "Host Details View must use ListingStatusBadge to display status"
);
assert(
  detailsCode.includes("Disabled / Paused") && detailsCode.includes("Published (Live)"),
  "ListingStatusBadge must properly show Disabled/Paused and Published statuses"
);

// Verify listings table columns & elements
assert(
  detailsCode.includes("formatSarFromHalalas(listing.price)"),
  "Host Details View must format listing price in SAR"
);
assert(
  detailsCode.includes("listing.propertyType") && detailsCode.includes("listing.listingType"),
  "Host Details View must display property type and listing type"
);
assert(
  detailsCode.includes("listing.city") || detailsCode.includes("listing.country"),
  "Host Details View must display property location (city, country)"
);
assert(
  detailsCode.includes("/admin/listings/${listing.id}"),
  "Host Details View must provide direct links to admin listing review (/admin/listings/[id])"
);

// Verify listings tab header
assert(
  detailsCode.includes("Properties & Listings"),
  "Host Details View listings tab must include Properties & Listings section"
);
console.log("✓ components/admin/host-details-view.tsx verified successfully!");

console.log("\n==================================================================");
console.log("   ALL ADMIN HOST LISTINGS ACCURACY TESTS PASSED!                 ");
console.log("==================================================================\n");
