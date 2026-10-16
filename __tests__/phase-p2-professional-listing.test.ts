import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  roomsSchema,
  bedItemSchema,
  BED_TYPES,
  ROOM_TYPES,
  updateListingSchema,
  createListingSchema,
} from "../lib/validation/listing";
import {
  AMENITIES_CATALOG,
  AMENITY_CATEGORIES,
  ALL_CANONICAL_AMENITY_IDS,
  normalizeAmenityId,
  searchAmenitiesCatalog,
} from "../lib/constants/amenities";
import {
  slugToSection,
  sectionToSlug,
  SECTION_SLUG_MAP,
} from "../app/(protected)/host/listings/[id]/section-helpers";
import { toPublicListingDTO, toOwnerListingDTO, toListingDTO } from "../services/mappers";

async function runPhaseP2Tests() {
  console.log("\n==================================================================");
  console.log("   PHASE P2 HOMYZ PROFESSIONAL LISTING & EDITOR VERIFICATION   ");
  console.log("==================================================================\n");

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
  // 1. Bed & Room Validation Schemas
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [1] Room-Level Sleeping Arrangements Schema ---");

  assert(BED_TYPES.includes("KING"), "BED_TYPES must include KING");
  assert(BED_TYPES.includes("QUEEN"), "BED_TYPES must include QUEEN");
  assert(BED_TYPES.includes("SOFA_BED"), "BED_TYPES must include SOFA_BED");
  assert(ROOM_TYPES.includes("BEDROOM"), "ROOM_TYPES must include BEDROOM");
  assert(ROOM_TYPES.includes("LIVING_ROOM"), "ROOM_TYPES must include LIVING_ROOM");

  const validRooms = [
    {
      id: "room_1",
      name: "Master Bedroom",
      type: "BEDROOM",
      beds: [
        { type: "KING", count: 1 },
        { type: "CRIB", count: 1 },
      ],
    },
    {
      id: "room_2",
      name: "Living Room",
      type: "LIVING_ROOM",
      beds: [{ type: "SOFA_BED", count: 2 }],
    },
  ];

  const parsedRooms = roomsSchema.safeParse(validRooms);
  assert(parsedRooms.success, "Valid rooms array parses successfully");

  const invalidBed = bedItemSchema.safeParse({ type: "WATER_BED", count: 1 });
  assert(!invalidBed.success, "Invalid bed type must fail validation");

  const negativeBedCount = bedItemSchema.safeParse({ type: "KING", count: -1 });
  assert(!negativeBedCount.success, "Negative bed count must fail validation");

  // ─────────────────────────────────────────────────────────────
  // 2. Listing Validation Schemas with Professional Fields
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [2] Extended Listing Validation Schemas ---");

  const sampleProfessionalPayload = {
    title: "Luxury Riyadh Penthouse",
    propertySize: 180,
    propertySizeUnit: "SQM",
    listingFloor: 14,
    totalFloors: 25,
    yearBuilt: 2022,
    privateEntrance: true,
    elevatorAvailable: true,
    fullBathrooms: 2,
    halfBathrooms: 1,
    privateBathrooms: 2,
    sharedBathrooms: 0,
    parkingAvailable: true,
    parkingType: "GARAGE",
    parkingSpaces: 2,
    parkingReservation: true,
    parkingInstructions: "Enter basement level B2, space 44.",
    petsAllowed: true,
    maxPets: 2,
    petFee: 15000,
    petRestrictions: "Small dogs and cats only under 15kg",
    dogsAllowed: true,
    catsAllowed: true,
    smokingAllowed: true,
    smokingLocation: "OUTSIDE_ONLY",
    eventsAllowed: false,
    quietHours: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    checkInMethod: "SMART_LOCK",
    checkInStart: "15:00",
    checkInEnd: "22:00",
    checkOutTime: "11:00",
    checkInInstructions: "Touch keypad to activate screen.",
    doorCode: "9482",
    lockboxCode: "3321",
    wifiNetwork: "SkyTower_Penthouse_5G",
    wifiPassword: "RiyadhSecretPass2026",
    houseManual: "Trash chutes are located at the end of the hallway.",
    safetyEquipment: ["SMOKE_ALARM", "CARBON_MONOXIDE_ALARM", "FIRST_AID_KIT"],
    safetyHazards: ["Stairs with no railing"],
    accessibilityFeatures: ["step_free", "disabled_parking"],
    rooms: validRooms,
  };

  const updateResult = updateListingSchema.safeParse(sampleProfessionalPayload);
  assert(updateResult.success, "updateListingSchema safely parses all Phase P2 professional fields");

  // ─────────────────────────────────────────────────────────────
  // 3. Security Boundary & Masking of Confidential Access Data
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [3] Security Masking in Public Listing DTO ---");

  const mockDbListing: any = {
    id: "list_test_p2_123",
    hostId: "usr_host_123",
    title: "Security Verified Villa",
    description: "Private oasis",
    propertyType: "Villa",
    listingType: "Entire place",
    address: "King Fahd Road",
    city: "Riyadh",
    district: "Al Olaya",
    postalCode: "12211",
    country: "Saudi Arabia",
    price: 85000,
    status: "ACTIVE",
    isPublished: true,
    isApproved: true,
    photos: ["https://example.com/photo1.jpg"],
    amenities: ["wifi", "air_conditioning"],
    doorCode: "CONFIDENTIAL_DOOR_CODE_9999",
    lockboxCode: "CONFIDENTIAL_LOCKBOX_8888",
    wifiPassword: "SECRET_WIFI_PASSWORD",
    wifiNetwork: "SecretNet",
    checkInInstructions: "Key under the flower pot at side gate.",
    directions: "Take exit 5 and turn right at the palm tree.",
    parkingInstructions: "Park in garage spot #3.",
    houseManual: "Do not touch thermostat setting 4.",
    rooms: validRooms,
    parkingAvailable: true,
    parkingType: "GARAGE",
    petsAllowed: true,
    smokingAllowed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const publicDTO: any = toPublicListingDTO(mockDbListing);

  assert(publicDTO.doorCode === undefined, "toPublicListingDTO MUST NEVER expose doorCode");
  assert(publicDTO.lockboxCode === undefined, "toPublicListingDTO MUST NEVER expose lockboxCode");
  assert(publicDTO.wifiPassword === undefined, "toPublicListingDTO MUST NEVER expose wifiPassword");
  assert(publicDTO.wifiNetwork === undefined, "toPublicListingDTO MUST NEVER expose wifiNetwork");
  assert(publicDTO.checkInInstructions === undefined, "toPublicListingDTO MUST NEVER expose checkInInstructions");
  assert(publicDTO.directions === undefined, "toPublicListingDTO MUST NEVER expose directions");
  assert(publicDTO.parkingInstructions === undefined, "toPublicListingDTO MUST NEVER expose parkingInstructions");
  assert(publicDTO.houseManual === undefined, "toPublicListingDTO MUST NEVER expose houseManual");

  const ownerDTO: any = toOwnerListingDTO(mockDbListing);
  assert(ownerDTO.doorCode === "CONFIDENTIAL_DOOR_CODE_9999", "toOwnerListingDTO preserves doorCode for host/owner");
  assert(ownerDTO.wifiPassword === "SECRET_WIFI_PASSWORD", "toOwnerListingDTO preserves wifiPassword for host/owner");
  assert(ownerDTO.parkingAvailable === true, "toOwnerListingDTO preserves parkingAvailable");

  // ─────────────────────────────────────────────────────────────
  // 4. Canonical Amenities Catalog Verification
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [4] Canonical Amenities Catalog ---");

  assert(AMENITY_CATEGORIES.length >= 10, `AMENITY_CATEGORIES must contain at least 10 categories (found: ${AMENITY_CATEGORIES.length})`);
  assert(ALL_CANONICAL_AMENITY_IDS.length > 50, `Canonical amenities must contain > 50 items (found: ${ALL_CANONICAL_AMENITY_IDS.length})`);
  assert(ALL_CANONICAL_AMENITY_IDS.includes("smoke_alarm"), "Catalog must include smoke_alarm");
  assert(ALL_CANONICAL_AMENITY_IDS.includes("carbon_monoxide_alarm"), "Catalog must include carbon_monoxide_alarm");
  assert(ALL_CANONICAL_AMENITY_IDS.includes("ev_charger"), "Catalog must include ev_charger");
  assert(ALL_CANONICAL_AMENITY_IDS.includes("step_free_entrance"), "Catalog must include step_free_entrance");
  assert(normalizeAmenityId("step_free_access") === "step_free_entrance", "Normalizes step_free_access to step_free_entrance");

  const searchWifi = searchAmenitiesCatalog("wifi");
  assert(searchWifi.some((a) => a.id === "wifi" || a.id === "fast_wifi"), "searchAmenitiesCatalog('wifi') finds matching wifi amenities");

  // ─────────────────────────────────────────────────────────────
  // 5. Section Helpers & Deep Linking Slugs
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [5] Section Slug Bidirectional Mapping ---");

  assert(slugToSection("sleeping-arrangements") === "sleeping-arrangements", "slugToSection('sleeping-arrangements') maps correctly");
  assert(slugToSection("parking") === "parking", "slugToSection('parking') maps correctly");
  assert(slugToSection("safety-equipment") === "safety-equipment", "slugToSection('safety-equipment') maps correctly");
  assert(sectionToSlug("sleeping-arrangements") === "sleeping-arrangements", "sectionToSlug('sleeping-arrangements') maps correctly");
  assert(sectionToSlug("parking") === "parking", "sectionToSlug('parking') maps correctly");

  // ─────────────────────────────────────────────────────────────
  // 6. UI & Component Contract Static Integrity
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- [6] Component Contract & Wiring Check ---");

  const editorClientFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");
  const editorClientSrc = fs.readFileSync(editorClientFile, "utf-8");

  assert(editorClientSrc.includes("rooms={rooms}"), "host-listing-editor-client passes rooms prop to PropertyDetailsViews");
  assert(editorClientSrc.includes("fullBathrooms={fullBathrooms}"), "host-listing-editor-client passes fullBathrooms prop");
  assert(editorClientSrc.includes("parkingAvailable={parkingAvailable}"), "host-listing-editor-client passes parkingAvailable prop");
  assert(editorClientSrc.includes("doorCode={doorCode}"), "host-listing-editor-client passes doorCode prop");
  assert(editorClientSrc.includes("lockboxCode={lockboxCode}"), "host-listing-editor-client passes lockboxCode prop");

  const sidebarFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx");
  const sidebarSrc = fs.readFileSync(sidebarFile, "utf-8");

  assert(sidebarSrc.includes("setActiveSection(\"sleeping-arrangements\")"), "EditorSidebar includes Sleeping arrangements navigation card");
  assert(sidebarSrc.includes("setActiveSection(\"parking\")"), "EditorSidebar includes Parking navigation card");

  const propertyDetailsViewsFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PropertyDetailsViews.tsx");
  const propertyDetailsSrc = fs.readFileSync(propertyDetailsViewsFile, "utf-8");

  assert(!propertyDetailsSrc.includes("Lorem ipsum massa pellentesque enim"), "PropertyDetailsViews removes dummy lorem ipsum category text");
  assert(propertyDetailsSrc.includes("Room-by-room sleeping arrangements"), "PropertyDetailsViews renders real room sleeping arrangements");

  const houseRulesViewsFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx");
  const houseRulesSrc = fs.readFileSync(houseRulesViewsFile, "utf-8");

  assert(houseRulesSrc.includes("Directions preview updated") === false, "HouseRulesAndArrivalViews removes fake directions preview alert");
  assert(houseRulesSrc.includes("parkingInstructions"), "HouseRulesAndArrivalViews binds parkingInstructions");

  console.log("\n==================================================================");
  console.log(`   ALL PHASE P2 TESTS PASSED (${passed}/${passed + failed})   `);
  console.log("==================================================================\n");
}

runPhaseP2Tests().catch((err) => {
  console.error("Test run error:", err);
  process.exit(1);
});
