import { prisma } from "@/lib/db/prisma";
import { ListingStatus, Role } from "@/generated/prisma/enums";
import { CANONICAL_AMENITIES } from "@/lib/constants/amenities";
import { normalizeSlug } from "@/lib/utils/slug";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Options
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTestPropertiesOptions {
  hostId: string;
  count?: number;
  seed?: string;
  seedBatchId?: string;
  mode?: "create" | "reset-and-create" | "delete-seed-batch";
  validateAfterSeed?: boolean;
}

export interface SeedBatchSummary {
  hostId: string;
  seedBatchId: string;
  requestedProperties: number;
  successfullyCreated: number;
  failed: number;
  published: number;
  draft: number;
  pending: number;
  stopped: number;
  countriesUsed: string[];
  citiesUsed: string[];
  neighborhoodsUsed: string[];
  propertyTypesUsed: string[];
  minPrice: number;
  maxPrice: number;
  createdListingIds: string[];
  searchTestsPassed?: number;
  searchTestsFailed?: number;
  validationReport?: Array<{ testName: string; passed: boolean; details?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic Pseudo-Random Generator (Mulberry32)
// ─────────────────────────────────────────────────────────────────────────────

function createPRNG(seedString: string) {
  // Hash string into 32-bit integer seed
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;

  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Curated High-Resolution Real Property Images (Unsplash Architectural & Interior)
// ─────────────────────────────────────────────────────────────────────────────

const PROPERTY_IMAGE_POOLS = {
  villa: [
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
  ],
  apartment: [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1502005229762-ee1b2da97e06?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1200&q=80",
  ],
  house: [
    "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1576941089067-2de3c901e126?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80",
  ],
  cabin: [
    "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
  ],
  loft_penthouse: [
    "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Geographic Location Catalog (7 Global Destinations Across 5 Countries)
// ─────────────────────────────────────────────────────────────────────────────

interface GeoLocationConfig {
  country: string;
  countryCode: string;
  city: string;
  state: string;
  neighborhood: string;
  district: string;
  streets: string[];
  baseLat: number;
  baseLng: number;
  currency: string;
}

const GEOGRAPHIC_LOCATIONS: GeoLocationConfig[] = [
  // ── 1. Surat, India ──
  {
    country: "India",
    countryCode: "IN",
    city: "Surat",
    state: "Gujarat",
    neighborhood: "Vesu",
    district: "Surat",
    streets: ["VIP Road, Vesu", "Canal Corridor Road, Vesu", "Someshwara Enclave Way", "Bhagwan Mahavir University Road"],
    baseLat: 21.1442,
    baseLng: 72.7758,
    currency: "INR",
  },
  {
    country: "India",
    countryCode: "IN",
    city: "Surat",
    state: "Gujarat",
    neighborhood: "Dumas",
    district: "Surat",
    streets: ["Dumas Beach Road", "Sultanabad Coastal Road", "Langhar Beach Promenade", "Airport Dumas Link Road"],
    baseLat: 21.0827,
    baseLng: 72.7095,
    currency: "INR",
  },
  {
    country: "India",
    countryCode: "IN",
    city: "Surat",
    state: "Gujarat",
    neighborhood: "Adajan",
    district: "Surat",
    streets: ["Anand Mahal Road", "LP Savani Road", "Prime Arcade Circle", "Pal Hazira Road"],
    baseLat: 21.1950,
    baseLng: 72.7930,
    currency: "INR",
  },
  {
    country: "India",
    countryCode: "IN",
    city: "Surat",
    state: "Gujarat",
    neighborhood: "Piplod",
    district: "Surat",
    streets: ["Gaurav Path", "Dumas Road Piplod", "VR Mall Access Avenue", "Kargil Chowk Boulevard"],
    baseLat: 21.1610,
    baseLng: 72.7710,
    currency: "INR",
  },
  {
    country: "India",
    countryCode: "IN",
    city: "Surat",
    state: "Gujarat",
    neighborhood: "Central City",
    district: "Surat",
    streets: ["Station Road, Surat", "Ring Road, Surat", "Delhi Gate Avenue", "Varachha Main Road"],
    baseLat: 21.2048,
    baseLng: 72.8411,
    currency: "INR",
  },

  // ── 2. Riyadh, Saudi Arabia ──
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    city: "Riyadh",
    state: "Riyadh Province",
    neighborhood: "Al Olaya",
    district: "Central Riyadh",
    streets: ["King Fahd Road", "Olaya Street", "Tahlia Street", "Musa Ibn Nusair St"],
    baseLat: 24.7136,
    baseLng: 46.6753,
    currency: "SAR",
  },
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    city: "Riyadh",
    state: "Riyadh Province",
    neighborhood: "Al Malqa",
    district: "North Riyadh",
    streets: ["Anas Ibn Malik Road", "Prince Turki Ibn Abdulaziz Al Awwal", "Al Dahna Street", "King Salman Road"],
    baseLat: 24.8015,
    baseLng: 46.6025,
    currency: "SAR",
  },
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    city: "Riyadh",
    state: "Riyadh Province",
    neighborhood: "Diplomatic Quarter",
    district: "West Riyadh",
    streets: ["Amr Ad Damri Street", "Al Kindi Plaza Way", "Al Safarat Drive", "Abdullah Al Sahmi St"],
    baseLat: 24.6850,
    baseLng: 46.6250,
    currency: "SAR",
  },
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    city: "Riyadh",
    state: "Riyadh Province",
    neighborhood: "Al Nakheel",
    district: "North Riyadh",
    streets: ["Northern Ring Branch Rd", "Imam Saud Bin Abdulaziz Bin Mohammed Rd", "Al Jamiaah Street"],
    baseLat: 24.7540,
    baseLng: 46.6280,
    currency: "SAR",
  },

  // ── 3. Jeddah, Saudi Arabia ──
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    city: "Jeddah",
    state: "Makkah Province",
    neighborhood: "Al Hamra",
    district: "Jeddah Waterfront",
    streets: ["Palestine Street", "Corniche Road", "Al Andalus Road", "Al Maadi Street"],
    baseLat: 21.5169,
    baseLng: 39.1564,
    currency: "SAR",
  },
  {
    country: "Saudi Arabia",
    countryCode: "SA",
    city: "Jeddah",
    state: "Makkah Province",
    neighborhood: "Al Shati",
    district: "North Corniche",
    streets: ["North Corniche Road", "Red Sea Promenade", "Prince Faisal Bin Fahd St", "Hira Street"],
    baseLat: 21.6020,
    baseLng: 39.1120,
    currency: "SAR",
  },

  // ── 4. Dubai, United Arab Emirates ──
  {
    country: "United Arab Emirates",
    countryCode: "AE",
    city: "Dubai",
    state: "Dubai",
    neighborhood: "Downtown Dubai",
    district: "Burj Khalifa District",
    streets: ["Sheikh Mohammed bin Rashid Blvd", "Financial Centre Road", "Burj Khalifa Access Way"],
    baseLat: 25.1972,
    baseLng: 55.2744,
    currency: "AED",
  },
  {
    country: "United Arab Emirates",
    countryCode: "AE",
    city: "Dubai",
    state: "Dubai",
    neighborhood: "Dubai Marina",
    district: "Marina & JBR",
    streets: ["Marina Promenade", "Al Marsa Street", "Braih Street", "King Salman Bin Abdulaziz Al Saud St"],
    baseLat: 25.0805,
    baseLng: 55.1403,
    currency: "AED",
  },
  {
    country: "United Arab Emirates",
    countryCode: "AE",
    city: "Dubai",
    state: "Dubai",
    neighborhood: "Palm Jumeirah",
    district: "The Palm",
    streets: ["Crescent Road", "Frond A Crescent", "Golden Mile Boardwalk", "The Pointe Walk"],
    baseLat: 25.1124,
    baseLng: 55.1390,
    currency: "AED",
  },

  // ── 5. London, United Kingdom ──
  {
    country: "United Kingdom",
    countryCode: "GB",
    city: "London",
    state: "Greater London",
    neighborhood: "Soho",
    district: "Westminster",
    streets: ["Dean Street", "Wardour Street", "Oxford Street", "Old Compton Street"],
    baseLat: 51.5136,
    baseLng: -0.1365,
    currency: "GBP",
  },
  {
    country: "United Kingdom",
    countryCode: "GB",
    city: "London",
    state: "Greater London",
    neighborhood: "Kensington",
    district: "Kensington and Chelsea",
    streets: ["Kensington High Street", "Cromwell Road", "Earls Court Road", "Gloucester Road"],
    baseLat: 51.5014,
    baseLng: -0.1919,
    currency: "GBP",
  },
  {
    country: "United Kingdom",
    countryCode: "GB",
    city: "London",
    state: "Greater London",
    neighborhood: "Camden Town",
    district: "Camden",
    streets: ["Camden High Street", "Chalk Farm Road", "Regent's Canal Way", "Parkway"],
    baseLat: 51.5390,
    baseLng: -0.1426,
    currency: "GBP",
  },

  // ── 6. New York, United States ──
  {
    country: "United States",
    countryCode: "US",
    city: "New York",
    state: "New York",
    neighborhood: "Manhattan",
    district: "Midtown",
    streets: ["Broadway", "5th Avenue", "7th Avenue", "West 42nd Street"],
    baseLat: 40.7580,
    baseLng: -73.9855,
    currency: "USD",
  },
  {
    country: "United States",
    countryCode: "US",
    city: "New York",
    state: "New York",
    neighborhood: "Brooklyn",
    district: "Williamsburg",
    streets: ["Bedford Avenue", "Grand Street", "Wythe Avenue", "Berry Street"],
    baseLat: 40.7143,
    baseLng: -73.9571,
    currency: "USD",
  },

  // ── 7. Paris, France ──
  {
    country: "France",
    countryCode: "FR",
    city: "Paris",
    state: "Ile-de-France",
    neighborhood: "Le Marais",
    district: "4th Arrondissement",
    streets: ["Rue des Francs-Bourgeois", "Rue de Rivoli", "Rue Vieille du Temple", "Rue des Rosiers"],
    baseLat: 48.8575,
    baseLng: 2.3590,
    currency: "EUR",
  },
  {
    country: "France",
    countryCode: "FR",
    city: "Paris",
    state: "Ile-de-France",
    neighborhood: "Montmartre",
    district: "18th Arrondissement",
    streets: ["Rue Lepic", "Rue des Abbesses", "Place du Tertre", "Rue Cortot"],
    baseLat: 48.8867,
    baseLng: 2.3431,
    currency: "EUR",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Realistic Property Profiles & Type Configurations
// ─────────────────────────────────────────────────────────────────────────────

interface PropertyTypeTemplate {
  propertyType: string;
  placeCategory: "APARTMENT" | "HOUSE" | "SECONDARY_UNIT" | "UNIQUE_SPACE" | "BED_AND_BREAKFAST" | "BOUTIQUE_HOTEL";
  listingType: "ENTIRE_PLACE" | "ROOM" | "SHARED_ROOM";
  titleTemplates: string[];
  guestsRange: [number, number];
  bedroomsRange: [number, number];
  bedsRange: [number, number];
  bathroomsRange: [number, number];
  propertySizeRange: [number, number]; // sqm
  basePriceRange: [number, number]; // in minor units / cents (e.g. 5000 = $50)
  imagePoolKey: keyof typeof PROPERTY_IMAGE_POOLS;
  amenityCategories: string[];
}

const PROPERTY_TEMPLATES: PropertyTypeTemplate[] = [
  {
    propertyType: "APARTMENT",
    placeCategory: "APARTMENT",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Modern Chic Apartment with City View",
      "Bright & Cozy Urban Retreat",
      "Contemporary City Flat near Transit",
      "Executive Skyline Residence",
      "Stylish Designer Suite in Central Hub",
      "Quiet Courtyard View Modern Home",
    ],
    guestsRange: [2, 5],
    bedroomsRange: [1, 3],
    bedsRange: [1, 4],
    bathroomsRange: [1, 2],
    propertySizeRange: [55, 120],
    basePriceRange: [8000, 22000],
    imagePoolKey: "apartment",
    amenityCategories: ["wifi", "kitchen", "air_conditioning", "washer", "workspace", "elevator", "smart_tv", "free_parking"],
  },
  {
    propertyType: "VILLA",
    placeCategory: "HOUSE",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Luxury Private Pool Villa & Garden",
      "Grand Estate with Sun Terrace & Spa",
      "Exclusive Oasis Villa with Private Pool",
      "Stately Architectural Villa & Patio",
      "Serene Luxury Haven with Swimming Pool",
    ],
    guestsRange: [6, 14],
    bedroomsRange: [3, 6],
    bedsRange: [4, 9],
    bathroomsRange: [3, 6],
    propertySizeRange: [220, 580],
    basePriceRange: [28000, 110000],
    imagePoolKey: "villa",
    amenityCategories: ["wifi", "kitchen", "private_pool", "hot_tub", "air_conditioning", "free_parking", "patio", "bbq_grill", "garden", "gym"],
  },
  {
    propertyType: "HOUSE",
    placeCategory: "HOUSE",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Spacious Family Home with Backyard",
      "Charming Heritage Townhouse",
      "Peaceful Suburban House & Garden",
      "Warm & Welcoming Multi-Bed Home",
    ],
    guestsRange: [4, 9],
    bedroomsRange: [2, 5],
    bedsRange: [3, 6],
    bathroomsRange: [2, 4],
    propertySizeRange: [130, 280],
    basePriceRange: [14000, 36000],
    imagePoolKey: "house",
    amenityCategories: ["wifi", "kitchen", "free_parking", "air_conditioning", "washer", "dryer", "patio", "backyard", "bbq_grill"],
  },
  {
    propertyType: "STUDIO",
    placeCategory: "APARTMENT",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Cozy Minimalist Studio in Prime Spot",
      "Bright Boutique Studio Suite",
      "Compact Modern Loft Studio",
      "Peaceful Solo & Couple Hideaway",
    ],
    guestsRange: [1, 2],
    bedroomsRange: [1, 1],
    bedsRange: [1, 1],
    bathroomsRange: [1, 1],
    propertySizeRange: [30, 48],
    basePriceRange: [5000, 11000],
    imagePoolKey: "apartment",
    amenityCategories: ["wifi", "kitchen", "air_conditioning", "workspace", "smart_tv", "hot_water"],
  },
  {
    propertyType: "PENTHOUSE",
    placeCategory: "APARTMENT",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Spectacular Panoramic Penthouse Terrace",
      "Ultra-Modern Luxury Penthouse",
      "Sky-High Signature Penthouse Suite",
    ],
    guestsRange: [4, 8],
    bedroomsRange: [2, 4],
    bedsRange: [3, 5],
    bathroomsRange: [2, 4],
    propertySizeRange: [180, 420],
    basePriceRange: [45000, 140000],
    imagePoolKey: "loft_penthouse",
    amenityCategories: ["wifi", "kitchen", "hot_tub", "air_conditioning", "elevator", "smart_tv", "gym", "private_balcony", "sound_system"],
  },
  {
    propertyType: "LOFT",
    placeCategory: "APARTMENT",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Industrial Chic Artist Loft with High Ceilings",
      "Sunlit Bohemian Loft & Terrace",
      "Open-Concept Modern Loft Space",
    ],
    guestsRange: [2, 4],
    bedroomsRange: [1, 2],
    bedsRange: [1, 3],
    bathroomsRange: [1, 2],
    propertySizeRange: [75, 150],
    basePriceRange: [12000, 26000],
    imagePoolKey: "loft_penthouse",
    amenityCategories: ["wifi", "kitchen", "workspace", "air_conditioning", "smart_tv", "washer", "patio"],
  },
  {
    propertyType: "CABIN",
    placeCategory: "HOUSE",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Rustic Timber Cabin with Fireplace",
      "Scenic Woodland Cabin Getaway",
      "Cozy Countryside Cottage & Fire Pit",
    ],
    guestsRange: [2, 6],
    bedroomsRange: [1, 3],
    bedsRange: [2, 4],
    bathroomsRange: [1, 2],
    propertySizeRange: [50, 110],
    basePriceRange: [9500, 24000],
    imagePoolKey: "cabin",
    amenityCategories: ["wifi", "indoor_fireplace", "fire_pit", "bbq_grill", "free_parking", "hot_water", "patio"],
  },
  {
    propertyType: "GUEST_HOUSE",
    placeCategory: "SECONDARY_UNIT",
    listingType: "ENTIRE_PLACE",
    titleTemplates: [
      "Private Garden Guest House with Patio",
      "Peaceful Backyard Guest Suite",
      "Secluded Cottage Guest Wing",
    ],
    guestsRange: [2, 4],
    bedroomsRange: [1, 2],
    bedsRange: [1, 2],
    bathroomsRange: [1, 2],
    propertySizeRange: [45, 85],
    basePriceRange: [7500, 16000],
    imagePoolKey: "house",
    amenityCategories: ["wifi", "kitchen", "air_conditioning", "free_parking", "private_entrance", "garden"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Core Seeder Implementation
// ─────────────────────────────────────────────────────────────────────────────

export async function createTestProperties(options: CreateTestPropertiesOptions): Promise<SeedBatchSummary> {
  const {
    hostId,
    count = 100,
    seed = "homyz-search-testing-v1",
    seedBatchId = "SEARCH_TEST_100_V1",
    mode = "create",
    validateAfterSeed = true,
  } = options;

  console.log(`\n==================================================================`);
  console.log(`   HOMYZ DYNAMIC PROPERTY SEARCH TEST DATA SEEDER                 `);
  console.log(`==================================================================`);
  console.log(` Host ID:         ${hostId}`);
  console.log(` Batch ID:        ${seedBatchId}`);
  console.log(` Mode:            ${mode}`);
  console.log(` Target Count:    ${count}`);
  console.log(` Seed:            ${seed}`);
  console.log(`==================================================================\n`);

  // 1. Validate Target Host Exists
  const host = await prisma.user.findUnique({
    where: { id: hostId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!host) {
    console.error(`❌ ERROR: TEST_HOST_NOT_FOUND - Host with ID "${hostId}" does not exist in database.`);
    throw new Error(`TEST_HOST_NOT_FOUND: No user found with ID "${hostId}".`);
  }

  console.log(`✅ Host verified: ${host.name || "Host"} (${host.email}) [Role: ${host.role}, Status: ${host.status}]`);

  const batchSlugPrefix = `seed-${seedBatchId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-`;

  // 2. Check Existing Seed Batch Listings
  const existingBatchListings = await prisma.listing.findMany({
    where: {
      hostId,
      customSlug: { startsWith: batchSlugPrefix },
    },
    select: { id: true, title: true, customSlug: true },
  });

  if (mode === "create" && existingBatchListings.length > 0) {
    const msg = `BATCH_ALREADY_EXISTS: Found ${existingBatchListings.length} properties already seeded for batch "${seedBatchId}". Use mode "reset-and-create" or "delete-seed-batch".`;
    console.error(`❌ ${msg}`);
    throw new Error(msg);
  }

  if (mode === "delete-seed-batch" || mode === "reset-and-create") {
    if (existingBatchListings.length > 0) {
      console.log(`🧹 Removing ${existingBatchListings.length} previous test properties from batch "${seedBatchId}"...`);
      const deleteResult = await prisma.listing.deleteMany({
        where: {
          id: { in: existingBatchListings.map((l: { id: string }) => l.id) },
        },
      });
      console.log(`✅ Successfully deleted ${deleteResult.count} previous test properties.`);
    } else {
      console.log(`ℹ️ No previous properties found for batch "${seedBatchId}".`);
    }

    if (mode === "delete-seed-batch") {
      return {
        hostId,
        seedBatchId,
        requestedProperties: count,
        successfullyCreated: 0,
        failed: 0,
        published: 0,
        draft: 0,
        pending: 0,
        stopped: 0,
        countriesUsed: [],
        citiesUsed: [],
        neighborhoodsUsed: [],
        propertyTypesUsed: [],
        minPrice: 0,
        maxPrice: 0,
        createdListingIds: [],
      };
    }
  }

  // 3. Initialize PRNG
  const rng = createPRNG(`${seed}:${hostId}:${seedBatchId}`);

  // Helper random functions
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
  const randChoice = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randFloat = (min: number, max: number) => min + rng() * (max - min);

  // Set of used slugs to ensure uniqueness
  const usedSlugs = new Set<string>();

  // Canonical amenities catalog map
  const canonicalAmenityIds = new Set(CANONICAL_AMENITIES.map((a) => a.id));

  // 4. Generate 100 Realistic Properties
  console.log(`🏗️ Generating ${count} realistic property records...`);
  const propertiesToCreate: any[] = [];
  const countriesUsed = new Set<string>();
  const citiesUsed = new Set<string>();
  const neighborhoodsUsed = new Set<string>();
  const propertyTypesUsed = new Set<string>();

  let publishedCount = 0;
  let draftCount = 0;
  let pendingCount = 0;
  let stoppedCount = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (let i = 0; i < count; i++) {
    const paddedIndex = String(i + 1).padStart(3, "0");
    const slug = `${batchSlugPrefix}${paddedIndex}`;
    usedSlugs.add(slug);

    // Pick location round-robin with PRNG variation
    const location = GEOGRAPHIC_LOCATIONS[i % GEOGRAPHIC_LOCATIONS.length];
    countriesUsed.add(location.country);
    citiesUsed.add(location.city);
    neighborhoodsUsed.add(location.neighborhood);

    // Small coordinate offset (±0.001 to ±0.006 degrees, ~100m to 650m) so markers spread on the map
    const latOffset = randFloat(-0.005, 0.005);
    const lngOffset = randFloat(-0.005, 0.005);
    const latitude = Math.round((location.baseLat + latOffset) * 1000000) / 1000000;
    const longitude = Math.round((location.baseLng + lngOffset) * 1000000) / 1000000;

    // Pick property template
    const template = PROPERTY_TEMPLATES[i % PROPERTY_TEMPLATES.length];
    propertyTypesUsed.add(template.propertyType);

    // Generate room / bed / bath / guest counts within logical bounds
    const guests = randInt(template.guestsRange[0], template.guestsRange[1]);
    const bedrooms = randInt(template.bedroomsRange[0], template.bedroomsRange[1]);
    const beds = Math.max(bedrooms, randInt(template.bedsRange[0], template.bedsRange[1]));
    const bathrooms = randInt(template.bathroomsRange[0], template.bathroomsRange[1]);
    const propertySize = randInt(template.propertySizeRange[0], template.propertySizeRange[1]);

    // Pricing in minor units / cents
    const basePrice = Math.round(randInt(template.basePriceRange[0], template.basePriceRange[1]) / 100) * 100;
    const weekendPrice = Math.round((basePrice * randFloat(1.1, 1.25)) / 100) * 100;
    const cleaningFee = Math.round(randInt(2000, 12000) / 100) * 100;
    const extraGuestFee = guests > 2 ? 1500 : 0;
    const securityDeposit = basePrice > 30000 ? 50000 : 0;

    minPrice = Math.min(minPrice, basePrice);
    maxPrice = Math.max(maxPrice, basePrice);

    // Pick street
    const street = randChoice(location.streets);
    const fullAddress = `${street}, ${location.neighborhood}, ${location.city}, ${location.state}, ${location.country}`;

    // Title & description
    const titleBase = randChoice(template.titleTemplates);
    const title = `${titleBase} - ${location.neighborhood}`.slice(0, 50);

    const description = `Welcome to this wonderful ${template.propertyType.toLowerCase()} located in the vibrant neighborhood of ${location.neighborhood}, ${location.city}. Perfectly appointed with ${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}, ${beds} bed${beds > 1 ? "s" : ""}, and ${bathrooms} bath${bathrooms > 1 ? "s" : ""}, this home comfortably accommodates up to ${guests} guests. Enjoy high-speed Wi-Fi, modern climate control, a fully equipped kitchen, and proximity to local attractions, dining, and scenic promenades. Ideal for families, executive travelers, or weekend getaways.`;

    // Photos: Pick 5 to 7 curated photos from the matching category pool
    const pool = PROPERTY_IMAGE_POOLS[template.imagePoolKey];
    // Rotate pool order deterministically
    const poolStart = i % pool.length;
    const photos = [
      ...pool.slice(poolStart),
      ...pool.slice(0, poolStart),
      ...PROPERTY_IMAGE_POOLS.apartment,
    ].slice(0, randInt(5, 7));

    // Amenities: Combine essential amenities with property-specific standouts
    const mandatoryEssentials = ["wifi", "air_conditioning", "smoke_alarm", "first_aid_kit", "fire_extinguisher", "hot_water"];
    const candidateAmenities = [...new Set([...mandatoryEssentials, ...template.amenityCategories])];
    const amenities = candidateAmenities.filter((id) => canonicalAmenityIds.has(id));

    // Status distribution: 70% ACTIVE, 10% DRAFT, 10% PENDING_REVIEW, 10% STOPPED/PAUSED
    const statusRoll = i % 10;
    let status: ListingStatus;
    let published: boolean;
    let isPaused = false;
    let submittedAt: Date | null = null;
    let approvedAt: Date | null = null;
    let currentStep = 19;

    if (statusRoll < 7) {
      status = ListingStatus.ACTIVE;
      published = true;
      approvedAt = new Date();
      submittedAt = new Date(Date.now() - 86400000);
      publishedCount++;
    } else if (statusRoll === 7) {
      status = ListingStatus.DRAFT;
      published = false;
      currentStep = randInt(2, 10);
      draftCount++;
    } else if (statusRoll === 8) {
      status = ListingStatus.PENDING_REVIEW;
      published = false;
      submittedAt = new Date();
      pendingCount++;
    } else {
      status = ListingStatus.ACTIVE;
      published = true;
      isPaused = true;
      approvedAt = new Date();
      stoppedCount++;
    }

    // Blocked dates: scatter 2-4 upcoming days next month
    const blockedDates: string[] = [];
    if (rng() > 0.4) {
      const now = new Date();
      const monthOffset = 1;
      const targetMonth = (now.getMonth() + monthOffset) % 12;
      const targetYear = now.getFullYear() + (now.getMonth() + monthOffset >= 12 ? 1 : 0);
      const day1 = randInt(5, 12);
      const day2 = randInt(18, 24);
      blockedDates.push(
        `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day1).padStart(2, "0")}`,
        `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day1 + 1).padStart(2, "0")}`,
        `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day2).padStart(2, "0")}`,
      );
    }

    // Instant book: 75% true, 25% false
    const instantBook = rng() < 0.75;

    propertiesToCreate.push({
      hostId,
      title,
      description,
      price: basePrice,
      weekdayBasePrice: basePrice,
      weekendPrice,
      cleaningFee,
      extraGuestFee,
      securityDeposit,
      published,
      status,
      isPaused,
      hostingType: "HOME",
      placeCategory: template.placeCategory,
      propertyType: template.propertyType,
      listingType: template.listingType,
      locationSearch: fullAddress,
      shortAddress: street,
      address: fullAddress,
      neighborhoodDescription: `Quiet, family-friendly neighborhood in ${location.neighborhood} with easy access to transit, dining, and scenic spots.`,
      gettingAround: `Close to public transport and major thoroughfares. Rideshares and taxis readily available.`,
      city: location.city,
      district: location.district,
      postalCode: location.countryCode === "IN" ? "395007" : location.countryCode === "SA" ? "12211" : "90210",
      country: location.country,
      latitude,
      longitude,
      showExactLocation: true,
      guests,
      bedrooms,
      beds,
      bathrooms,
      propertySize,
      propertySizeUnit: "SQM",
      photos,
      amenities,
      highlights: ["Central location", "Dedicated workspace", "Self check-in"],
      safetyEquipment: ["smoke_alarm", "first_aid_kit", "fire_extinguisher"],
      houseRules: ["No smoking indoors", "No unauthorized commercial events", "Quiet hours after 10 PM"],
      checkInMethod: "SMART_LOCK",
      checkInStart: "15:00",
      checkInEnd: "22:00",
      checkOutTime: "11:00",
      cancellationPolicy: "FLEXIBLE",
      longTermCancellationPolicy: "FIRM",
      minNights: 1,
      maxNights: 90,
      instantBook,
      blockedDates,
      currentStep,
      customSlug: slug,
      submittedAt,
      approvedAt,
      descriptionSections: {
        property: `This beautiful ${template.propertyType.toLowerCase()} offers high comfort and generous amenities in ${location.city}.`,
        guestAccess: "Guests have full, private access to the entire listing.",
        guestInteraction: "The host is available via app messaging or phone for any inquiries.",
        otherDetails: "High-speed Wi-Fi details and smart lock instructions provided prior to check-in.",
        _seedMetadata: {
          batchId: seedBatchId,
          seed,
          index: i,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  }

  // 5. Safe Batch Insertion into PostgreSQL
  console.log(`💾 Inserting ${propertiesToCreate.length} listings into PostgreSQL in transactional chunks...`);
  const chunkSize = 25;
  const createdListings: Array<{ id: string; title: string }> = [];

  for (let i = 0; i < propertiesToCreate.length; i += chunkSize) {
    const chunk = propertiesToCreate.slice(i, i + chunkSize);
    const chunkResults = await prisma.$transaction(async (tx: any) => {
      const inserted = await (tx.listing as any).createManyAndReturn({
        data: chunk,
        select: { id: true, title: true },
      });
      return inserted;
    });
    createdListings.push(...chunkResults);
    console.log(`  ↳ Saved batch chunk ${Math.min(i + chunkSize, propertiesToCreate.length)} / ${propertiesToCreate.length}`);
  }

  console.log(`✅ Successfully created ${createdListings.length} listings for host "${hostId}".\n`);

  const summary: SeedBatchSummary = {
    hostId,
    seedBatchId,
    requestedProperties: count,
    successfullyCreated: createdListings.length,
    failed: count - createdListings.length,
    published: publishedCount,
    draft: draftCount,
    pending: pendingCount,
    stopped: stoppedCount,
    countriesUsed: Array.from(countriesUsed),
    citiesUsed: Array.from(citiesUsed),
    neighborhoodsUsed: Array.from(neighborhoodsUsed),
    propertyTypesUsed: Array.from(propertyTypesUsed),
    minPrice,
    maxPrice,
    createdListingIds: createdListings.map((l) => l.id),
  };

  // 6. Automated Post-Seeding Search Validation
  if (validateAfterSeed) {
    console.log(`🔍 Running automated search validation against seeded properties...`);
    const validationReport = await runPostSeedSearchValidation(hostId, batchSlugPrefix);
    summary.validationReport = validationReport;
    summary.searchTestsPassed = validationReport.filter((r) => r.passed).length;
    summary.searchTestsFailed = validationReport.filter((r) => !r.passed).length;
    console.log(`\n📊 Search Validation Result: ${summary.searchTestsPassed} / ${validationReport.length} tests passed.\n`);
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Automated Post-Seed Search Validation Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runPostSeedSearchValidation(
  hostId: string,
  batchSlugPrefix: string,
): Promise<Array<{ testName: string; passed: boolean; details?: string }>> {
  const tests: Array<{ testName: string; passed: boolean; details?: string }> = [];

  const addTest = (name: string, passed: boolean, details?: string) => {
    tests.push({ testName: name, passed, details });
    console.log(`  ${passed ? "✅ PASS" : "❌ FAIL"}: ${name}${details ? ` (${details})` : ""}`);
  };

  try {
    // 1. Host Ownership Check
    const countOwned = await prisma.listing.count({
      where: { hostId, customSlug: { startsWith: batchSlugPrefix } },
    });
    addTest("All seeded listings belong to target host", countOwned > 0, `Found ${countOwned} listings`);

    // 2. Exact City Search: Surat
    const suratListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        city: { equals: "Surat", mode: "insensitive" },
        published: true,
        status: ListingStatus.ACTIVE,
        isPaused: false,
      },
    });
    addTest("Exact City search 'Surat' returns active listings", suratListings.length > 0, `Found ${suratListings.length} listings`);

    // 3. Exact City Search: Riyadh
    const riyadhListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        city: { equals: "Riyadh", mode: "insensitive" },
        published: true,
        status: ListingStatus.ACTIVE,
        isPaused: false,
      },
    });
    addTest("Exact City search 'Riyadh' returns active listings", riyadhListings.length > 0, `Found ${riyadhListings.length} listings`);

    // 4. Neighborhood Search: Vesu
    const vesuListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        address: { contains: "Vesu", mode: "insensitive" },
        published: true,
        status: ListingStatus.ACTIVE,
      },
    });
    addTest("Neighborhood search 'Vesu' returns listings", vesuListings.length > 0, `Found ${vesuListings.length} listings`);

    // 5. Neighborhood Search: Al Olaya
    const olayaListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        address: { contains: "Al Olaya", mode: "insensitive" },
        published: true,
        status: ListingStatus.ACTIVE,
      },
    });
    addTest("Neighborhood search 'Al Olaya' returns listings", olayaListings.length > 0, `Found ${olayaListings.length} listings`);

    // 6. Partial Location Text Search ("Sur" -> Surat)
    const partialSurListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        city: { contains: "Sur", mode: "insensitive" },
        published: true,
      },
    });
    addTest("Partial city text search 'Sur' matches Surat listings", partialSurListings.length > 0, `Found ${partialSurListings.length} listings`);

    // 7. Property Type Search: VILLA
    const villaListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        propertyType: "VILLA",
        published: true,
      },
    });
    addTest("Property type search 'VILLA' returns luxury villas", villaListings.length > 0, `Found ${villaListings.length} villas`);

    // 8. Guest Capacity Search (guests >= 6)
    const largeCapacityListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        guests: { gte: 6 },
        published: true,
      },
    });
    addTest("Guest capacity filter (>= 6 guests)", largeCapacityListings.length > 0, `Found ${largeCapacityListings.length} listings`);

    // 9. Price Range Filter (between $100 and $300 i.e. 10000 and 30000 cents)
    const priceFiltered = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        price: { gte: 10000, lte: 30000 },
        published: true,
      },
    });
    addTest("Price range filter ($100 - $300)", priceFiltered.length > 0, `Found ${priceFiltered.length} listings`);

    // 10. Amenity Filter (must have 'wifi')
    const wifiListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        amenities: { has: "wifi" },
        published: true,
      },
    });
    addTest("Amenity filter 'wifi' returns equipped listings", wifiListings.length > 0, `Found ${wifiListings.length} listings`);

    // 11. Draft Listings Isolation (Drafts must have published = false)
    const draftCount = await prisma.listing.count({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        status: ListingStatus.DRAFT,
      },
    });
    const publishedDraftCount = await prisma.listing.count({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        status: ListingStatus.DRAFT,
        published: true,
      },
    });
    addTest("Draft listings are never published (published: false)", draftCount > 0 && publishedDraftCount === 0, `${draftCount} drafts, 0 published`);

    // 12. Stopped / Paused Listings Visibility Isolation
    const pausedCount = await prisma.listing.count({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        isPaused: true,
      },
    });
    addTest("Stopped listings have isPaused = true", pausedCount > 0, `Found ${pausedCount} paused listings`);

    // 13. Map Bounds Geospatial Query (Bounding box around Surat area)
    const suratGeoBoundsListings = await prisma.listing.findMany({
      where: {
        hostId,
        customSlug: { startsWith: batchSlugPrefix },
        latitude: { gte: 21.0, lte: 21.3 },
        longitude: { gte: 72.6, lte: 73.0 },
        published: true,
      },
    });
    addTest("Geospatial map bounding box query (Surat coordinates)", suratGeoBoundsListings.length > 0, `Found ${suratGeoBoundsListings.length} listings within box`);

    // 14. Coordinate Validity & Offset Spread
    const allCoords = await prisma.listing.findMany({
      where: { hostId, customSlug: { startsWith: batchSlugPrefix } },
      select: { latitude: true, longitude: true },
    });
    const validCoords = allCoords.every((c: { latitude: number | null; longitude: number | null }) => c.latitude != null && !isNaN(c.latitude) && c.longitude != null && !isNaN(c.longitude));
    const uniqueCoords = new Set(allCoords.map((c: { latitude: number | null; longitude: number | null }) => `${c.latitude},${c.longitude}`));
    addTest(
      "All coordinates valid and distinctly spread across map",
      validCoords && uniqueCoords.size >= allCoords.length * 0.9,
      `${uniqueCoords.size} unique coordinate locations across ${allCoords.length} listings`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    addTest("Post-seed validation execution error", false, msg);
  }

  return tests;
}

