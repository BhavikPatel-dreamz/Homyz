/**
 * Travel Stamp Collection Dataset & Dynamic Generator for Homyz "Where I've Been" Profile Feature
 * Hand-drawn aesthetic matching Figma design specifications.
 */

export type TravelStampLocation = {
  name: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
};

export type TravelStampItem = {
  id: string;
  title: string;
  subtitle: string;
  accentBg: string;
  fillHex: string;
  borderColor: string;
  countryCode?: string;
  iconType: "paris" | "coffee" | "rome" | "tokyo" | "newyork" | "london" | "barcelona" | "dubai" | "sydney" | "bucharest" | "bali" | "riyadh" | "custom";
  iconUrl?: string;
  location?: TravelStampLocation;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const BUILTIN_TRAVEL_STAMPS: TravelStampItem[] = [
  {
    id: "paris",
    title: "Paris",
    subtitle: "stay like a homie",
    accentBg: "bg-[#FDE8EB]",
    fillHex: "#FDE8EB",
    borderColor: "border-pink-300",
    countryCode: "FR",
    iconType: "paris",
  },
  {
    id: "coffee",
    title: "Coffee",
    subtitle: "stay like a homie",
    accentBg: "bg-[#E0E7FF]",
    fillHex: "#E0E7FF",
    borderColor: "border-indigo-300",
    iconType: "coffee",
  },
  {
    id: "rome",
    title: "Rome",
    subtitle: "stay like a homie",
    accentBg: "bg-[#FEF3C7]",
    fillHex: "#FEF3C7",
    borderColor: "border-amber-300",
    countryCode: "IT",
    iconType: "rome",
  },
  {
    id: "tokyo",
    title: "Tokyo",
    subtitle: "stay like a homie",
    accentBg: "bg-[#FEE2E2]",
    fillHex: "#FEE2E2",
    borderColor: "border-red-300",
    countryCode: "JP",
    iconType: "tokyo",
  },
  {
    id: "newyork",
    title: "New York",
    subtitle: "stay like a homie",
    accentBg: "bg-[#DBEAFE]",
    fillHex: "#DBEAFE",
    borderColor: "border-blue-300",
    countryCode: "US",
    iconType: "newyork",
  },
  {
    id: "london",
    title: "London",
    subtitle: "stay like a homie",
    accentBg: "bg-[#D1FAE5]",
    fillHex: "#D1FAE5",
    borderColor: "border-emerald-300",
    countryCode: "GB",
    iconType: "london",
  },
  {
    id: "barcelona",
    title: "Barcelona",
    subtitle: "stay like a homie",
    accentBg: "bg-[#FFEDD5]",
    fillHex: "#FFEDD5",
    borderColor: "border-orange-300",
    countryCode: "ES",
    iconType: "barcelona",
  },
  {
    id: "dubai",
    title: "Dubai",
    subtitle: "stay like a homie",
    accentBg: "bg-[#FEF08A]",
    fillHex: "#FEF08A",
    borderColor: "border-yellow-300",
    countryCode: "AE",
    iconType: "dubai",
  },
  {
    id: "sydney",
    title: "Sydney",
    subtitle: "stay like a homie",
    accentBg: "bg-[#CFFAFE]",
    fillHex: "#CFFAFE",
    borderColor: "border-cyan-300",
    countryCode: "AU",
    iconType: "sydney",
  },
  {
    id: "bucharest",
    title: "Bucharest",
    subtitle: "stay like a homie",
    accentBg: "bg-[#F3E8FF]",
    fillHex: "#F3E8FF",
    borderColor: "border-purple-300",
    countryCode: "RO",
    iconType: "bucharest",
  },
  {
    id: "bali",
    title: "Bali",
    subtitle: "stay like a homie",
    accentBg: "bg-[#CCFBF1]",
    fillHex: "#CCFBF1",
    borderColor: "border-teal-300",
    countryCode: "ID",
    iconType: "bali",
  },
  {
    id: "riyadh",
    title: "Riyadh",
    subtitle: "stay like a homie",
    accentBg: "bg-[#FFE4E6]",
    fillHex: "#FFE4E6",
    borderColor: "border-rose-300",
    countryCode: "SA",
    iconType: "riyadh",
  },
];

export const TRAVEL_STAMPS = BUILTIN_TRAVEL_STAMPS;

/**
 * Creates a dynamic TravelStampItem from a location search result & optional custom image upload.
 */
export function createCustomStamp(
  locationName: string,
  iconUrl?: string,
  countryCode?: string,
  locationDetails?: TravelStampLocation
): TravelStampItem {
  const cleanTitle = locationName.split(",")[0].trim();
  const slugId = `stamp-${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36).slice(-4)}`;

  const hexColors = [
    "#FDE8EB", // Soft pink
    "#E0E7FF", // Soft indigo
    "#FEF3C7", // Soft amber
    "#DBEAFE", // Soft blue
    "#D1FAE5", // Soft green
    "#F3E8FF", // Soft purple
  ];
  // Deterministic color assignment based on title string length
  const fillHex = hexColors[cleanTitle.length % hexColors.length];

  return {
    id: slugId,
    title: cleanTitle,
    subtitle: "stay like a homie",
    accentBg: `bg-[${fillHex}]`,
    fillHex,
    borderColor: "border-amber-300",
    countryCode,
    iconType: "custom",
    iconUrl,
    location: locationDetails || {
      name: locationName,
      country: countryCode,
    },
    isCustom: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getStampById(id: string, customStamps: TravelStampItem[] = []): TravelStampItem | undefined {
  const combined = [...BUILTIN_TRAVEL_STAMPS, ...customStamps];
  return combined.find((s) => s.id === id);
}
