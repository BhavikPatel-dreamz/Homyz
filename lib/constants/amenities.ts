export const AMENITY_CATEGORIES = [
  "favorites",
  "standout",
  "essentials",
  "internet_workspace",
  "kitchen_dining",
  "bathroom",
  "bedroom_laundry",
  "climate",
  "entertainment",
  "family",
  "outdoor",
  "premium",
  "parking",
  "services",
  "accessibility",
  "safety",
  "facilities",
] as const;

export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number];

export interface CanonicalAmenity {
  id: string;
  label: string;
  category: AmenityCategory;
  description?: string;
  icon?: string;
  isPopular?: boolean;
}

export const CANONICAL_AMENITIES: CanonicalAmenity[] = [
  // ─── Guest Favorites / Essentials ───
  { id: "wifi", label: "Wifi", category: "favorites", description: "High-speed wireless internet connection", icon: "📶", isPopular: true },
  { id: "tv", label: "TV", category: "favorites", description: "Television with streaming services or cable", icon: "📺", isPopular: true },
  { id: "kitchen", label: "Kitchen", category: "favorites", description: "Space where guests can cook meals", icon: "🍳", isPopular: true },
  { id: "washer", label: "Washer", category: "favorites", description: "Washer in building or in unit", icon: "🧺", isPopular: true },
  { id: "dryer", label: "Dryer", category: "essentials", description: "Clothes dryer in building or in unit", icon: "💨", isPopular: true },
  { id: "free_parking", label: "Free parking", category: "favorites", description: "Free parking on premises", icon: "🅿️", isPopular: true },
  { id: "paid_parking", label: "Paid parking", category: "favorites", description: "Paid parking on premises or nearby", icon: "💳", isPopular: true },
  { id: "air_conditioning", label: "Air conditioning", category: "favorites", description: "Central or split air conditioning", icon: "❄️", isPopular: true },
  { id: "heating", label: "Heating", category: "essentials", description: "Central heating or portable heater", icon: "🔥", isPopular: true },
  { id: "workspace", label: "Dedicated workspace", category: "favorites", description: "Desk or table with comfortable chair", icon: "💻", isPopular: true },
  { id: "hot_water", label: "Hot water", category: "essentials", description: "Reliable hot water supply", icon: "🚿" },
  { id: "iron", label: "Iron", category: "essentials", description: "Clothes iron & ironing board", icon: "👔" },
  { id: "hair_dryer", label: "Hair dryer", category: "essentials", description: "Hair dryer in bathroom", icon: "💇" },
  { id: "essentials", label: "Essentials", category: "essentials", description: "Towels, bed sheets, soap, toilet paper", icon: "🧼" },
  { id: "towels", label: "Towels", category: "essentials", description: "Bath towels and hand towels", icon: "🛁" },
  { id: "bed_linens", label: "Bed linens", category: "essentials", description: "Clean bed sheets and pillowcases", icon: "🛏️" },
  { id: "hangers", label: "Hangers", category: "essentials", description: "Clothes hangers in wardrobe", icon: "🧥" },
  { id: "extra_pillows_blankets", label: "Extra pillows & blankets", category: "essentials", description: "Additional pillows and blankets", icon: "🛋️" },

  // ─── Kitchen & Dining ───
  { id: "refrigerator", label: "Refrigerator", category: "kitchen_dining", description: "Full-size refrigerator", icon: "🧊" },
  { id: "freezer", label: "Freezer", category: "kitchen_dining", description: "Deep freezer or freezer compartment", icon: "❄️" },
  { id: "microwave", label: "Microwave", category: "kitchen_dining", description: "Microwave oven", icon: "🍿" },
  { id: "oven", label: "Oven", category: "kitchen_dining", description: "Baking and roasting oven", icon: "🥧" },
  { id: "stove", label: "Stove", category: "kitchen_dining", description: "Gas or electric stovetop", icon: "🔥" },
  { id: "dishwasher", label: "Dishwasher", category: "kitchen_dining", description: "Automatic dishwasher", icon: "🍽️" },
  { id: "coffee_maker", label: "Coffee maker", category: "kitchen_dining", description: "Espresso machine, drip or french press", icon: "☕" },
  { id: "kettle", label: "Kettle", category: "kitchen_dining", description: "Electric kettle for hot drinks", icon: "🫖" },
  { id: "toaster", label: "Toaster", category: "kitchen_dining", description: "Bread toaster", icon: "🍞" },
  { id: "cooking_basics", label: "Cooking basics", category: "kitchen_dining", description: "Pots, pans, oil, salt and pepper", icon: "🧂" },
  { id: "dishes_cutlery", label: "Dishes and silverware", category: "kitchen_dining", description: "Bowls, plates, cups, forks, knives", icon: "🍴" },
  { id: "dining_table", label: "Dining table", category: "kitchen_dining", description: "Indoor dining table with seating", icon: "🪑" },
  { id: "blender", label: "Blender", category: "kitchen_dining", description: "Kitchen food blender", icon: "🥤" },
  { id: "bbq_utensils", label: "Barbecue utensils", category: "kitchen_dining", description: "Grill tongs, skewers, brush", icon: "🍢" },

  // ─── Bathroom ───
  { id: "shower", label: "Walk-in shower", category: "bathroom", description: "Separate enclosed shower", icon: "🚿" },
  { id: "bathtub", label: "Bathtub", category: "bathroom", description: "Full soaking bathtub", icon: "🛁" },
  { id: "shampoo", label: "Shampoo", category: "bathroom", description: "Body shampoo provided", icon: "🧴" },
  { id: "conditioner", label: "Conditioner", category: "bathroom", description: "Hair conditioner provided", icon: "🧴" },
  { id: "body_soap", label: "Body soap", category: "bathroom", description: "Body wash or bar soap", icon: "🧼" },
  { id: "toilet_paper", label: "Toilet paper", category: "bathroom", description: "Extra rolls of toilet paper", icon: "🧻" },
  { id: "bidet", label: "Bidet", category: "bathroom", description: "Bidet sprayer or fixture", icon: "🚽" },

  // ─── Bedroom & Laundry ───
  { id: "room_darkening_shades", label: "Room-darkening shades", category: "bedroom_laundry", description: "Blackout blinds or curtains", icon: "🌑" },
  { id: "clothing_storage", label: "Clothing storage", category: "bedroom_laundry", description: "Closet, wardrobe or chest of drawers", icon: "🗄️" },
  { id: "drying_rack", label: "Drying rack for clothing", category: "bedroom_laundry", description: "Foldable laundry drying rack", icon: "👕" },

  // ─── Entertainment ───
  { id: "smart_tv", label: "Smart TV", category: "entertainment", description: "Smart TV with Netflix, Prime, YouTube", icon: "📺" },
  { id: "sound_system", label: "Sound system", category: "entertainment", description: "Bluetooth speaker or surround audio", icon: "🔊" },
  { id: "books", label: "Books & reading material", category: "entertainment", description: "Selection of books and magazines", icon: "📚" },
  { id: "board_games", label: "Board games", category: "entertainment", description: "Family board games and puzzles", icon: "🎲" },
  { id: "game_console", label: "Video game console", category: "entertainment", description: "PlayStation, Xbox or Switch", icon: "🎮" },
  { id: "pool_table", label: "Pool table", category: "standout", description: "Billiards / pool table", icon: "🎱" },

  // ─── Standout & Premium Features ───
  { id: "pool", label: "Pool", category: "standout", description: "Private or shared swimming pool", icon: "🏊", isPopular: true },
  { id: "private_pool", label: "Private pool", category: "premium", description: "Exclusive private swimming pool", icon: "🏊" },
  { id: "shared_pool", label: "Shared pool", category: "premium", description: "Community or building pool", icon: "🏊" },
  { id: "hot_tub", label: "Hot tub", category: "standout", description: "Private or shared hot tub or jacuzzi", icon: "♨️", isPopular: true },
  { id: "sauna", label: "Sauna", category: "premium", description: "Steam room or dry heat sauna", icon: "🧖" },
  { id: "gym", label: "Fitness gym", category: "facilities", description: "Gym equipment or fitness room", icon: "🏋️" },
  { id: "indoor_fireplace", label: "Indoor fireplace", category: "standout", description: "Wood-burning or gas indoor fireplace", icon: "🔥" },
  { id: "piano", label: "Piano", category: "standout", description: "Upright or grand piano", icon: "🎹" },
  { id: "beach_access", label: "Beach access", category: "facilities", description: "Direct or walking beach access", icon: "🏖️" },
  { id: "lake_access", label: "Lake access", category: "premium", description: "Direct or walking lake access", icon: "🛶" },
  { id: "waterfront", label: "Waterfront", category: "premium", description: "Property located directly by the water", icon: "🌊" },

  // ─── Outdoor ───
  { id: "patio", label: "Patio", category: "standout", description: "Private patio or balcony", icon: "🌿", isPopular: true },
  { id: "private_balcony", label: "Private balcony", category: "outdoor", description: "Attached private balcony", icon: "🏙️" },
  { id: "shared_balcony", label: "Shared balcony", category: "outdoor", description: "Communal terrace or balcony", icon: "🏢" },
  { id: "backyard", label: "Backyard", category: "outdoor", description: "Open grassy or paved backyard", icon: "🏡" },
  { id: "garden", label: "Garden", category: "outdoor", description: "Landscaped private or shared garden", icon: "🌻" },
  { id: "outdoor_furniture", label: "Outdoor furniture", category: "outdoor", description: "Outdoor seating, lounge chairs or sofa", icon: "🪑" },
  { id: "outdoor_dining_area", label: "Outdoor dining area", category: "standout", description: "Outdoor table and chairs for meals", icon: "🍽️" },
  { id: "bbq_grill", label: "BBQ grill", category: "standout", description: "Barbecue grill on premises", icon: "🍖" },
  { id: "fire_pit", label: "Fire pit", category: "standout", description: "Outdoor fire pit for evening gatherings", icon: "🪵" },
  { id: "hammock", label: "Hammock", category: "outdoor", description: "Relaxing outdoor hammock", icon: "🌴" },

  // ─── Parking & Facilities ───
  { id: "garage", label: "Covered garage", category: "parking", description: "Enclosed private garage parking", icon: "🚗" },
  { id: "street_parking", label: "Street parking", category: "parking", description: "Public street parking available", icon: "🛣️" },
  { id: "ev_charger", label: "EV charger", category: "facilities", description: "Electric vehicle charging station", icon: "🔌" },
  { id: "pet_friendly", label: "Pet friendly", category: "facilities", description: "Pets are permitted on premises", icon: "🐾" },
  { id: "elevator", label: "Elevator", category: "accessibility", description: "Elevator available in the building", icon: "🛗" },

  // ─── Services ───
  { id: "cleaning_available", label: "Cleaning available during stay", category: "services", description: "Housekeeping available for an extra fee", icon: "🧹" },
  { id: "luggage_dropoff", label: "Luggage dropoff allowed", category: "services", description: "Drop off bags early before check-in", icon: "🧳" },
  { id: "long_term_stays_allowed", label: "Long-term stays allowed", category: "services", description: "Stays of 28 days or more allowed", icon: "📅" },

  // ─── Safety Items ───
  { id: "smoke_alarm", label: "Smoke alarm", category: "safety", description: "Working smoke alarm / detector", icon: "🚨" },
  { id: "first_aid_kit", label: "First aid kit", category: "safety", description: "First aid medical supplies", icon: "🩹" },
  { id: "fire_extinguisher", label: "Fire extinguisher", category: "safety", description: "Certified fire extinguisher on premises", icon: "🧯" },
  { id: "carbon_monoxide_alarm", label: "Carbon monoxide alarm", category: "safety", description: "CO detector installed", icon: "⚠️" },
  { id: "emergency_exit", label: "Emergency exit guide", category: "safety", description: "Clearly marked exit routes", icon: "🚪" },
  { id: "security_system", label: "Security alarm system", category: "safety", description: "Monitored property alarm system", icon: "🛡️" },

  // ─── Accessibility ───
  { id: "step_free_entrance", label: "Step-free guest entrance", category: "accessibility", description: "No steps to get inside property", icon: "♿" },
  { id: "step_free_path", label: "Step-free path to entrance", category: "accessibility", description: "Smooth walkway without stairs", icon: "🛤️" },
  { id: "accessible_parking", label: "Accessible parking spot", category: "accessibility", description: "Designated disabled parking spot", icon: "♿" },
  { id: "wide_entrance", label: "Guest entrance wider than 32 inches", category: "accessibility", description: "Doorway accommodates wheelchairs", icon: "↔️" },
  { id: "wide_hallways", label: "Wide hallways", category: "accessibility", description: "Hallways wider than 36 inches", icon: "↔️" },
  { id: "step_free_bedroom", label: "Step-free bedroom access", category: "accessibility", description: "At least one step-free bedroom", icon: "🛏️" },
  { id: "step_free_bathroom", label: "Step-free bathroom access", category: "accessibility", description: "At least one step-free bathroom", icon: "🚿" },
  { id: "grab_rails", label: "Grab rails in bathroom", category: "accessibility", description: "Safety grab bars for toilet/shower", icon: "🦯" },
  { id: "roll_in_shower", label: "Roll-in shower", category: "accessibility", description: "Shower without curb or step", icon: "🚿" },
  { id: "shower_chair", label: "Shower chair", category: "accessibility", description: "Seating provided inside shower", icon: "🪑" },
];

export const AMENITY_ALIASES: Record<string, string> = {
  // Wifi
  "wifi": "wifi",
  "wi-fi": "wifi",
  "high-speed wi-fi": "wifi",

  // TV
  "tv": "tv",
  "smart tv": "tv",
  "smart tv / netflix": "tv",

  // Kitchen
  "kitchen": "kitchen",
  "full kitchen": "kitchen",

  // Washer
  "washer": "washer",
  "washer & dryer": "washer",

  // Parking
  "free parking": "free_parking",
  "free_parking": "free_parking",
  "parking": "free_parking",
  "free parking on premises": "free_parking",
  "paid parking": "paid_parking",
  "paid_parking": "paid_parking",
  "garage": "garage",

  // AC
  "ac": "air_conditioning",
  "air conditioning": "air_conditioning",
  "air_conditioning": "air_conditioning",

  // Workspace
  "workspace": "workspace",
  "dedicated workspace": "workspace",

  // Pool & Jacuzzi
  "pool": "pool",
  "swimming pool": "pool",
  "private pool": "private_pool",
  "shared pool": "shared_pool",
  "hot tub": "hot_tub",
  "hot_tub": "hot_tub",
  "jacuzzi": "hot_tub",

  // Patio & BBQ
  "patio": "patio",
  "private patio / balcony": "patio",
  "private balcony": "private_balcony",
  "shared balcony": "shared_balcony",
  "bbq grill": "bbq_grill",
  "bbq_grill": "bbq_grill",
  "bbq": "bbq_grill",

  // Outdoor
  "outdoor dining area": "outdoor_dining_area",
  "outdoor_dining_area": "outdoor_dining_area",
  "fire pit": "fire_pit",
  "fire_pit": "fire_pit",
  "backyard": "backyard",
  "garden": "garden",

  // Entertainment
  "pool table": "pool_table",
  "pool_table": "pool_table",
  "fireplace": "indoor_fireplace",
  "indoor fireplace": "indoor_fireplace",
  "indoor_fireplace": "indoor_fireplace",
  "piano": "piano",

  // Safety
  "smoke alarm": "smoke_alarm",
  "smoke_alarm": "smoke_alarm",
  "first aid kit": "first_aid_kit",
  "first_aid_kit": "first_aid_kit",
  "first aid": "first_aid_kit",
  "fire extinguisher": "fire_extinguisher",
  "fire_extinguisher": "fire_extinguisher",
  "carbon monoxide alarm": "carbon_monoxide_alarm",
  "carbon_monoxide_alarm": "carbon_monoxide_alarm",
  "co alarm": "carbon_monoxide_alarm",

  // Facilities
  "gym": "gym",
  "fitness gym": "gym",
  "fitness center": "gym",
  "beach access": "beach_access",
  "beach_access": "beach_access",
  "ev charger": "ev_charger",
  "ev_charger": "ev_charger",
  "pet friendly": "pet_friendly",
  "pet_friendly": "pet_friendly",
  "elevator": "elevator",
  "step_free_access": "step_free_entrance",
  "step free access": "step_free_entrance",
};

/**
 * Normalizes an arbitrary amenity string into its canonical ID.
 */
export function normalizeAmenityId(input: string): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (AMENITY_ALIASES[lower]) {
    return AMENITY_ALIASES[lower];
  }

  const slugified = lower
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (AMENITY_ALIASES[slugified]) {
    return AMENITY_ALIASES[slugified];
  }

  return slugified || lower;
}

/**
 * Normalizes an array of amenity inputs, deduplicates them, and returns canonical IDs.
 */
export function normalizeAmenities(inputs: unknown[]): string[] {
  if (!Array.isArray(inputs)) return [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const item of inputs) {
    if (typeof item !== "string") continue;
    const canonical = normalizeAmenityId(item);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      results.push(canonical);
    }
  }

  return results;
}

/**
 * Filter canonical amenities by category or search query
 */
export function searchAmenitiesCatalog(query: string, category?: string): CanonicalAmenity[] {
  const q = query.trim().toLowerCase();
  return CANONICAL_AMENITIES.filter((a) => {
    if (category && category !== "All" && category !== "all") {
      if (category === "favorites" && !a.isPopular && a.category !== "favorites") return false;
      if (category !== "favorites" && a.category !== category) return false;
    }
    if (!q) return true;
    return (
      a.label.toLowerCase().includes(q) ||
      (a.description && a.description.toLowerCase().includes(q)) ||
      a.id.toLowerCase().includes(q)
    );
  });
}

export const AMENITIES_CATALOG = CANONICAL_AMENITIES;
export const ALL_CANONICAL_AMENITY_IDS = CANONICAL_AMENITIES.map((a) => a.id);

const CANONICAL_AMENITY_BY_ID = new Map<string, CanonicalAmenity>(
  CANONICAL_AMENITIES.map((a) => [a.id, a])
);

/**
 * Returns canonical amenity metadata (id, label, icon, description, category)
 * for any given canonical ID or arbitrary alias string.
 */
export function getAmenityMeta(idOrLabel: string): CanonicalAmenity {
  if (!idOrLabel || typeof idOrLabel !== "string") {
    return {
      id: "",
      label: "",
      category: "favorites",
      icon: "🛋️",
      description: "",
    };
  }
  const canonicalId = normalizeAmenityId(idOrLabel);
  const found = CANONICAL_AMENITY_BY_ID.get(canonicalId);
  if (found) return found;

  const prettyLabel = idOrLabel
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: canonicalId || idOrLabel,
    label: prettyLabel,
    category: "favorites",
    icon: "🛋️",
    description: "Amenity available on premises",
  };
}

