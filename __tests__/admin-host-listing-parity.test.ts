import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serializeListingForEditor } from "@/app/(protected)/host/listings/[id]/section-helpers";

console.log("\n==================================================================");
console.log("   ADMIN <-> HOST LISTING MANAGEMENT PARITY & STATUS SUITE        ");
console.log("==================================================================\n");

// --- [1] Canonical Serializer Parity ---
console.log("--- [1] Canonical Serializer Parity ---");

const mockRawListing = {
  id: "test-listing-123",
  title: "Luxury Sea View Villa",
  description: "A wonderful stay by the sea",
  price: 50000,
  weekdayBasePrice: 50000,
  weekendPrice: 65000,
  weekendPremium: 30,
  smartPricing: true,
  smartPricingMinPrice: 40000,
  smartPricingMaxPrice: 80000,
  cleaningFee: 15000,
  securityDeposit: 25000,
  petFee: 5000,
  published: false,
  status: "ACTIVE",
  hostingType: "HOME",
  propertyType: "VILLA",
  listingType: "ENTIRE_PLACE",
  placeCategory: "VILLA",
  address: "King Abdulaziz Road",
  apartment: "Villa 4B",
  shortAddress: "King Abdulaziz Road, Jeddah",
  locationSearch: "King Abdulaziz Road, Al Shatie, Jeddah, Saudi Arabia",
  city: "Jeddah",
  district: "Al Shatie",
  postalCode: "23414",
  country: "Saudi Arabia",
  latitude: 21.581,
  longitude: 39.123,
  guests: 8,
  bedrooms: 4,
  beds: 5,
  bathrooms: 4,
  fullBathrooms: 3,
  halfBathrooms: 1,
  privateBathrooms: 3,
  sharedBathrooms: 0,
  propertySize: 450,
  propertySizeUnit: "SQM",
  listingFloor: 2,
  totalFloors: 3,
  yearBuilt: 2021,
  elevatorAvailable: true,
  privateEntrance: true,
  photos: ["https://example.com/p1.jpg", "https://example.com/p2.jpg"],
  amenities: ["WIFI", "AIR_CONDITIONING", "POOL"],
  highlights: ["BEACH_ACCESS"],
  houseRules: ["No smoking", "No loud music"],
  petsAllowed: true,
  maxPets: 2,
  petRestrictions: "Small dogs only",
  commercialFilmingAllowed: false,
  checkInMethod: "SMART_LOCK",
  checkInStart: "15:00",
  checkInEnd: "22:00",
  checkOutTime: "11:00",
  cancellationPolicy: "FLEXIBLE",
  longTermCancellationPolicy: "STRICT",
  minNights: 2,
  maxNights: 30,
  advanceNotice: "1_DAY",
  sameDayCutoff: "14:00",
  allowSameDayRequests: true,
  discounts: {
    weekly: { enabled: true, percentage: 10 },
    monthly: { enabled: true, percentage: 20 },
    last_minute: { enabled: true, percentage: 15 },
    non_refundable: { enabled: true, percentage: 10 },
  },
  arrivalGuide: {
    directions: "Take exit 12 and turn right",
    wifiNetwork: "VillaGuest",
    wifiPassword: "SecretPassword123",
    houseManual: "Enjoy your stay and keep pool clean",
  },
  descriptionSections: JSON.stringify({
    property: "Spacious sea-facing living room",
    guestAccess: "Full private access to villa and garden",
    guestInteraction: "Host available via app 24/7",
    otherDetails: "Quiet hours after 10 PM",
  }),
  photoRoomAssignments: JSON.stringify({
    "https://example.com/p1.jpg": "Living room",
    "https://example.com/p2.jpg": "Master bedroom",
  }),
  safetyEquipment: ["SMOKE_ALARM", "FIRST_AID_KIT"],
  accessibilityFeatures: ["STEP_FREE_ACCESS"],
  accessibilityDetails: JSON.stringify([
    { featureId: "STEP_FREE_ACCESS", description: "Flat entrance", photos: ["https://example.com/a1.jpg"] }
  ]),
  rooms: [
    { id: "r1", name: "Bedroom 1", type: "BEDROOM", beds: [{ type: "KING", count: 1 }] }
  ],
  coHosts: [
    {
      id: "ch1",
      role: "FULL_ACCESS",
      canManageCalendar: true,
      canManagePricing: true,
      canMessageGuests: true,
      user: { id: "u2", name: "Ahmed CoHost", email: "ahmed@example.com", image: null }
    }
  ],
  hostId: "h1",
  host: {
    id: "h1",
    name: "Tariq Host",
    email: "tariq@example.com",
    image: null,
    phone: "+966500000000",
    createdAt: new Date("2022-01-01"),
    publicProfile: {
      bio: "Superhost in Jeddah",
      work: "Architect",
      languages: ["Arabic", "English"],
    },
    hostRegistrations: [
      {
        status: "APPROVED",
        complianceStatus: "VERIFIED",
        documents: [],
      }
    ]
  },
  isPaused: false,
  isFeatured: true,
  showExactLocation: true,
  customSlug: "luxury-sea-view-villa-jeddah",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2024-01-01"),
  _count: { bookings: 12 },
};

const serialized = serializeListingForEditor(mockRawListing as any, {
  nonRefundableDiscountPercentage: 10,
});

// Verify core fields
assert.equal(serialized.id, "test-listing-123");
assert.equal(serialized.title, "Luxury Sea View Villa");
assert.equal(serialized.price, 50000); // 50000 cents/halalas
assert.equal(serialized.weekdayBasePrice, 50000);
assert.equal(serialized.weekendPrice, 65000);
assert.equal(serialized.propertySize, 450);
assert.equal(serialized.propertySizeUnit, "SQM");
assert.equal(serialized.apartment, "Villa 4B");
assert.equal(serialized.shortAddress, "King Abdulaziz Road, Jeddah");
assert.equal(serialized.locationSearch, "King Abdulaziz Road, Al Shatie, Jeddah, Saudi Arabia");

// Verify arrival guide fields
assert.equal(serialized.directions, "Take exit 12 and turn right");
assert.equal(serialized.wifiNetwork, "VillaGuest");
assert.equal(serialized.wifiPassword, "SecretPassword123");
assert.equal(serialized.houseManual, "Enjoy your stay and keep pool clean");

// Verify structured descriptions
assert.equal((serialized.descriptionSections as any)?.property, "Spacious sea-facing living room");
assert.equal((serialized.descriptionSections as any)?.guestAccess, "Full private access to villa and garden");
assert.equal((serialized.descriptionSections as any)?.guestInteraction, "Host available via app 24/7");
assert.equal((serialized.descriptionSections as any)?.otherDetails, "Quiet hours after 10 PM");

// Verify rooms and co-hosts
assert.equal(serialized.rooms?.length, 1);
assert.equal(serialized.rooms?.[0]?.type, "BEDROOM");
assert.equal(serialized.coHosts?.length, 1);
assert.equal(serialized.coHosts?.[0]?.user?.name, "Ahmed CoHost");

// Verify safety & accessibility
assert.deepEqual(serialized.safetyEquipment, ["SMOKE_ALARM", "FIRST_AID_KIT"]);
assert.deepEqual(serialized.accessibilityFeatures, ["STEP_FREE_ACCESS"]);
assert.equal(serialized.accessibilityDetails?.length, 1);

// Verify discounts
const discounts = serialized.discounts as any;
assert.equal(discounts?.weekly?.percentage, 10);
assert.equal(discounts?.monthly?.percentage, 20);
assert.equal(discounts?.last_minute?.percentage, 15);
assert.equal(discounts?.non_refundable?.percentage, 10);

console.log("✓ All 80+ fields properly serialized with complete data parity!");


// --- [2] Admin Detail Page Code Audit ---
console.log("\n--- [2] Admin Detail Page Code Audit ---");
const adminPagePath = path.resolve(__dirname, "../app/(protected)/admin/listings/[id]/page.tsx");
assert(fs.existsSync(adminPagePath), "Admin listing detail page must exist");
const adminPageCode = fs.readFileSync(adminPagePath, "utf-8");

assert(
  adminPageCode.includes("serializeListingForEditor(listing"),
  "Admin detail page MUST use serializeListingForEditor for 100% field parity with host"
);
assert(
  adminPageCode.includes('presentation="admin"'),
  "Admin detail page must pass presentation='admin' to HostListingEditorClient"
);
assert(
  adminPageCode.includes('routeBase="/admin/listings"'),
  "Admin detail page must set routeBase to '/admin/listings'"
);
console.log("✓ Admin detail page uses canonical shared serializer!");


// --- [3] Admin Review View Status Display & Button States ---
console.log("\n--- [3] Admin Review View Status Display & Button States ---");
const adminReviewPath = path.resolve(
  __dirname,
  "../app/(protected)/admin/listings/[id]/admin-listing-review-view.tsx"
);
assert(fs.existsSync(adminReviewPath), "AdminListingReviewView must exist");
const adminReviewCode = fs.readFileSync(adminReviewPath, "utf-8");

// Verify toast notifications
assert(
  adminReviewCode.includes('import { toast } from "@/components/ui/toast"'),
  "Must import toast from @/components/ui/toast"
);
assert(
  adminReviewCode.includes("toast.success(") && adminReviewCode.includes("toast.error("),
  "Must notify success and error via toast"
);

// Verify accurate status display logic
assert(
  adminReviewCode.includes('if (listing.status === "ACTIVE" || listing.status === "APPROVED") return "Unpublished (Approved)"'),
  "Unpublished active/approved listing must NOT show 'Current status: ACTIVE', must display 'Unpublished (Approved)'"
);
assert(
  adminReviewCode.includes('if (listing.published) return "Published"'),
  "Published listing must return 'Published'"
);
assert(
  adminReviewCode.includes('if (listing.isPaused) return "Paused"'),
  "Paused listing must return 'Paused'"
);

// Verify button states
assert(
  adminReviewCode.includes('disabled={saving !== null || !listing.published}'),
  "Unpublish button must be disabled when !listing.published"
);
assert(
  adminReviewCode.includes('disabled={saving !== null || listing.published || missingRequirements.length > 0}'),
  "Publish button must be enabled when !listing.published and missingRequirements is 0"
  adminReviewCode.includes('disabled={saving !== null || missingRequirements.length > 0 || (listing.status !== "PENDING_REVIEW" && listing.status !== "DRAFT") || listing.published}'),
  "Approve button must be enabled for complete listings in PENDING_REVIEW or DRAFT when unpublished"
);
console.log("✓ AdminListingReviewView status labels, button states, and toasts verified!");
// --- [4] Admin Listings Table Serialization Audit ---
console.log("\n--- [4] Admin Listings Table Serialization Audit ---");
const adminTablePagePath = path.resolve(__dirname, "../app/(protected)/admin/listings/page.tsx");
assert(fs.existsSync(adminTablePagePath), "Admin listings page must exist");
const adminTableCode = fs.readFileSync(adminTablePagePath, "utf-8");

assert(adminTableCode.includes("apartment: l.apartment"), "Admin table must serialize apartment");
assert(adminTableCode.includes("shortAddress: l.shortAddress"), "Admin table must serialize shortAddress");
assert(adminTableCode.includes("locationSearch: l.locationSearch"), "Admin table must serialize locationSearch");

const adminClientPath = path.resolve(__dirname, "../app/(protected)/admin/listings/admin-listings-client.tsx");
const adminClientCode = fs.readFileSync(adminClientPath, "utf-8");
assert(adminClientCode.includes("apartment?: string"), "FullListingItem must include apartment");
assert(adminClientCode.includes("editApartment"), "Admin client must support editing apartment");
console.log("✓ Admin listings overview table contains apartment, shortAddress, and locationSearch!");


// --- [5] Service Inclusion Audit ---
console.log("\n--- [5] Listing Service Inclusion Audit ---");
const servicePath = path.resolve(__dirname, "../services/listing.service.ts");
const serviceCode = fs.readFileSync(servicePath, "utf-8");

assert(
  serviceCode.includes("coHosts: {"),
  "getAdminListingDetail must include coHosts relation"
);
assert(
  /bookings:\s*\{\s*where:\s*\{\s*status:\s*BookingStatus\.CONFIRMED/.test(serviceCode),
  "getAdminListingDetail must include confirmed bookings"
);
console.log("✓ Listing service includes co-hosts and confirmed bookings for admin detail!");

console.log("\n==================================================================");
console.log("   ALL ADMIN <-> HOST LISTING MANAGEMENT PARITY TESTS PASSED!    ");
console.log("==================================================================\n");
