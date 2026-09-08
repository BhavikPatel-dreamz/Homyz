import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  normalizeAmenityId,
  normalizeAmenities,
  CANONICAL_AMENITIES,
} from "../lib/constants/amenities";
import {
  createListingSchema,
  updateListingSchema,
} from "../lib/validation/listing";
import {
  toPublicListingDTO,
  toOwnerListingDTO,
  toAdminListingDTO,
  ListingDTO,
} from "../services/mappers";

async function runPhaseP0Tests() {
  console.log("\n=======================================================");
  console.log("  PHASE P0 HOST LISTING STABILIZATION REGRESSION TESTS  ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(` ❌ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      console.log(` ✅ PASS: ${msg}`);
      passed++;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Photo Management & Blob URL Elimination
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [1] Photo Management & Blob URL Security ---");
  const stepPhotoFile = path.join(
    process.cwd(),
    "components/host/onboarding/step-photo-management.tsx"
  );
  const stepPhotoContent = fs.readFileSync(stepPhotoFile, "utf-8");

  assert(
    !stepPhotoContent.includes("createObjectURL"),
    "step-photo-management.tsx must NOT contain createObjectURL (zero temporary blob URLs)"
  );

  assert(
    stepPhotoContent.includes("/api/v1/upload/listing-photo"),
    "step-photo-management.tsx must upload via real server endpoint /api/v1/upload/listing-photo"
  );

  assert(
    !stepPhotoContent.includes("Drag photos to reorder"),
    "step-photo-management.tsx removed misleading drag-to-reorder placeholder copy"
  );

  // ─────────────────────────────────────────────────────────────
  // 2. Studio Listing Support (bedrooms: 0)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [2] Studio Listing Support ---");
  const studioInput = {
    title: "Cozy Downtown Studio",
    price: 15000,
    bedrooms: 0,
    guests: 2,
    beds: 1,
    bathrooms: 1,
  };

  const parsedStudio = createListingSchema.safeParse(studioInput);
  assert(
    parsedStudio.success && parsedStudio.data.bedrooms === 0,
    "createListingSchema must allow bedrooms: 0 for studio apartments"
  );

  const updatedStudio = updateListingSchema.safeParse({ bedrooms: 0 });
  assert(
    updatedStudio.success && updatedStudio.data.bedrooms === 0,
    "updateListingSchema must allow bedrooms: 0"
  );

  const invalidBedrooms = createListingSchema.safeParse({
    ...studioInput,
    bedrooms: -1,
  });
  assert(
    !invalidBedrooms.success,
    "createListingSchema must reject negative bedrooms (bedrooms: -1)"
  );

  // ─────────────────────────────────────────────────────────────
  // 3. Amenity ID Normalization & Canonical Catalog
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [3] Canonical Amenities & Aliases Normalization ---");
  assert(
    normalizeAmenityId("WIFI") === "wifi",
    "Normalizes uppercase WIFI to canonical wifi"
  );
  assert(
    normalizeAmenityId("wi-fi") === "wifi",
    "Normalizes hyphenated wi-fi to wifi"
  );
  assert(
    normalizeAmenityId("AIR_CONDITIONING") === "air_conditioning",
    "Normalizes AIR_CONDITIONING to air_conditioning"
  );
  assert(
    normalizeAmenityId("ac") === "air_conditioning",
    "Normalizes ac alias to air_conditioning"
  );
  assert(
    normalizeAmenityId("Free parking on premises") === "free_parking",
    "Normalizes Free parking on premises to free_parking"
  );
  assert(
    normalizeAmenityId("JACUZZI") === "hot_tub",
    "Normalizes JACUZZI alias to hot_tub"
  );
  assert(
    normalizeAmenityId("BBQ") === "bbq_grill",
    "Normalizes BBQ alias to bbq_grill"
  );

  const mixedList = [
    "WIFI",
    "wifi",
    "AIR_CONDITIONING",
    "ac",
    "Free parking",
    "PARKING",
    "JACUZZI",
    "custom_rare_amenity",
  ];
  const normalized = normalizeAmenities(mixedList);
  assert(
    normalized.includes("wifi") &&
      normalized.includes("air_conditioning") &&
      normalized.includes("free_parking") &&
      normalized.includes("hot_tub") &&
      normalized.includes("custom_rare_amenity"),
    "normalizeAmenities deduplicates and resolves aliases while preserving custom unknown IDs"
  );
  assert(
    normalized.filter((x) => x === "wifi").length === 1,
    "normalizeAmenities eliminates duplicates of the same canonical concept"
  );

  // ─────────────────────────────────────────────────────────────
  // 4. Privacy Leak Prevention & DTO Separation
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [4] Listing Privacy & DTO Separation ---");
  const rawMockListing: any = {
    id: "lst_sample_123",
    hostId: "usr_host_456",
    title: "Luxury Penthouse in Olaya",
    description: "Stunning skyline views.",
    price: 35000,
    published: true,
    status: "ACTIVE",
    hostingType: "HOME",
    propertyType: "Apartment",
    listingType: "ENTIRE_PLACE",
    locationSearch: "Olaya Street, Riyadh, Saudi Arabia",
    shortAddress: "Olaya, Riyadh",
    address: "742 Evergreen Terrace, Flat 4B",
    apartment: "Penthouse Suite 4B",
    city: "Riyadh",
    district: "Al Olaya",
    postalCode: "12211",
    country: "Saudi Arabia",
    latitude: 24.713554,
    longitude: 46.675298,
    showExactLocation: false, // EXACT LOCATION OFF
    guests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 2,
    photos: ["https://example.com/p1.jpg"],
    highlights: ["Central location"],
    amenities: ["wifi", "air_conditioning"],
    safetyDisclosures: ["SECURITY_CAMERA:YES"],
    houseRules: ["No smoking"],
    checkInMethod: "SMART_LOCK",
    checkInStart: "15:00",
    checkInEnd: "22:00",
    checkOutTime: "11:00",
    cancellationPolicy: "FLEXIBLE",
    minNights: 1,
    maxNights: 30,
    instantBook: true,
    isPaused: false,
    blockedDates: [],
    cleaningFee: 5000,
    securityDeposit: 10000,
    weekendPrice: 40000,
    weekendPremium: null,
    discounts: null,
    currentStep: 19,
    submittedAt: new Date(),
    resubmittedAt: null,
    reviewStartedAt: new Date(),
    reviewerId: "admin_secret_999",
    rejectionReason: "Internal notes not for guests",
    requestedChanges: null,
    approvedAt: new Date(),
    approvedById: "admin_boss_888",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const publicDTO = toPublicListingDTO(rawMockListing);

  // Privacy assertions:
  assert(
    publicDTO.apartment === null,
    "toPublicListingDTO: apartment/unit must NEVER be exposed publicly"
  );
  assert(
    publicDTO.address !== rawMockListing.address,
    "toPublicListingDTO: exact street address is masked when showExactLocation is false"
  );
  assert(
    publicDTO.postalCode === null,
    "toPublicListingDTO: exact postalCode is null when showExactLocation is false"
  );
  assert(
    publicDTO.latitude === 24.71 && publicDTO.longitude === 46.68,
    "toPublicListingDTO: coordinates are rounded to 2 decimal places when showExactLocation is false"
  );
  assert(
    (publicDTO as any).reviewerId === undefined &&
      (publicDTO as any).approvedById === undefined &&
      (publicDTO as any).rejectionReason === undefined &&
      (publicDTO as any).currentStep === undefined,
    "toPublicListingDTO: internal admin/review metadata is strictly omitted"
  );

  // When showExactLocation is true:
  const publicExactDTO = toPublicListingDTO({
    ...rawMockListing,
    showExactLocation: true,
  });
  assert(
    publicExactDTO.address === rawMockListing.address,
    "toPublicListingDTO: exact address is provided when showExactLocation is true"
  );
  assert(
    publicExactDTO.apartment === null,
    "toPublicListingDTO: apartment remains null even when showExactLocation is true"
  );
  assert(
    publicExactDTO.latitude === 24.713554 &&
      publicExactDTO.longitude === 46.675298,
    "toPublicListingDTO: exact coordinates are provided when showExactLocation is true"
  );

  // Owner DTO assertions:
  const ownerDTO = toOwnerListingDTO(rawMockListing);
  assert(
    ownerDTO.apartment === "Penthouse Suite 4B" &&
      ownerDTO.address === rawMockListing.address &&
      ownerDTO.latitude === 24.713554,
    "toOwnerListingDTO: owner retains full address and apartment details"
  );

  // ─────────────────────────────────────────────────────────────
  // 5. Booking Deletion Protection & Schema Constraints
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [5] Booking Deletion Safety & Prisma Schema ---");
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  assert(
    schemaContent.includes(
      "listing Listing @relation(fields: [listingId], references: [id], onDelete: Restrict)"
    ),
    "prisma/schema.prisma must enforce onDelete: Restrict on Booking.listing relation"
  );

  const listingServicePath = path.join(
    process.cwd(),
    "services/listing.service.ts"
  );
  const listingServiceContent = fs.readFileSync(listingServicePath, "utf-8");

  assert(
    listingServiceContent.includes("prisma.booking.count") &&
      listingServiceContent.includes("Cannot delete a listing that has associated bookings"),
    "services/listing.service.ts remove() verifies booking count > 0 and rejects deletion"
  );

  console.log("\n=======================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");
}

runPhaseP0Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(" ❌ Test execution failed:", err);
    process.exit(1);
  });

