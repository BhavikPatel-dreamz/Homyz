/**
 * The source for the initial location catalogue. The current schema has no
 * Country/City/Location relation, so prisma/seed.ts persists this complete,
 * validated catalogue in the existing AppSettings JSON setting.
 */
export type SeedLocationType = "CITY" | "LOCATION";

export type SeedLocation = {
  name: string;
  slug: string;
  type: SeedLocationType;
  latitude: number;
  longitude: number;
  timezone: string;
  currencyCode: string;
  isActive: true;
  isFeatured: true;
  isPopular: true;
  displayOrder: number;
};

export type SeedCountry = {
  name: string;
  code: string;
  currencyCode: string;
  isActive: true;
  locations: readonly SeedLocation[];
};

const location = (
  name: string,
  slug: string,
  latitude: number,
  longitude: number,
  timezone: string,
  currencyCode: string,
  displayOrder: number,
  type: SeedLocationType = "CITY",
): SeedLocation => ({
  name, slug, type, latitude, longitude, timezone, currencyCode,
  isActive: true, isFeatured: true, isPopular: true, displayOrder,
});

export const CURATED_LOCATION_COUNTRIES = [
  { name: "Saudi Arabia", code: "SA", currencyCode: "SAR", isActive: true, locations: [
    location("Riyadh", "riyadh", 24.7136, 46.6753, "Asia/Riyadh", "SAR", 1), location("Jeddah", "jeddah", 21.4858, 39.1925, "Asia/Riyadh", "SAR", 2), location("Dammam", "dammam", 26.4207, 50.0888, "Asia/Riyadh", "SAR", 3), location("Al Khobar", "al-khobar", 26.2172, 50.1971, "Asia/Riyadh", "SAR", 4), location("AlUla", "alula", 26.6084, 37.9232, "Asia/Riyadh", "SAR", 5),
  ] },
  { name: "United Arab Emirates", code: "AE", currencyCode: "AED", isActive: true, locations: [
    location("Dubai", "dubai", 25.2048, 55.2708, "Asia/Dubai", "AED", 1), location("Abu Dhabi", "abu-dhabi", 24.4539, 54.3773, "Asia/Dubai", "AED", 2), location("Sharjah", "sharjah", 25.3463, 55.4209, "Asia/Dubai", "AED", 3), location("Ajman", "ajman", 25.4052, 55.5136, "Asia/Dubai", "AED", 4), location("Ras Al Khaimah", "ras-al-khaimah", 25.7895, 55.9432, "Asia/Dubai", "AED", 5),
  ] },
  { name: "India", code: "IN", currencyCode: "INR", isActive: true, locations: [
    location("Mumbai", "mumbai", 19.076, 72.8777, "Asia/Kolkata", "INR", 1), location("Delhi", "delhi", 28.6139, 77.209, "Asia/Kolkata", "INR", 2), location("Bengaluru", "bengaluru", 12.9716, 77.5946, "Asia/Kolkata", "INR", 3), location("Goa", "goa", 15.2993, 74.124, "Asia/Kolkata", "INR", 4, "LOCATION"), location("Surat", "surat", 21.1702, 72.8311, "Asia/Kolkata", "INR", 5),
  ] },
  { name: "United States", code: "US", currencyCode: "USD", isActive: true, locations: [
    location("New York", "new-york", 40.7128, -74.006, "America/New_York", "USD", 1), location("Los Angeles", "los-angeles", 34.0522, -118.2437, "America/Los_Angeles", "USD", 2), location("Miami", "miami", 25.7617, -80.1918, "America/New_York", "USD", 3), location("Las Vegas", "las-vegas", 36.1699, -115.1398, "America/Los_Angeles", "USD", 4), location("San Francisco", "san-francisco", 37.7749, -122.4194, "America/Los_Angeles", "USD", 5),
  ] },
  { name: "United Kingdom", code: "GB", currencyCode: "GBP", isActive: true, locations: [
    location("London", "london", 51.5072, -0.1276, "Europe/London", "GBP", 1), location("Manchester", "manchester", 53.4808, -2.2426, "Europe/London", "GBP", 2), location("Edinburgh", "edinburgh", 55.9533, -3.1883, "Europe/London", "GBP", 3), location("Birmingham", "birmingham", 52.4862, -1.8904, "Europe/London", "GBP", 4), location("Liverpool", "liverpool", 53.4084, -2.9916, "Europe/London", "GBP", 5),
  ] },
  { name: "France", code: "FR", currencyCode: "EUR", isActive: true, locations: [
    location("Paris", "paris", 48.8566, 2.3522, "Europe/Paris", "EUR", 1), location("Nice", "nice", 43.7102, 7.262, "Europe/Paris", "EUR", 2), location("Lyon", "lyon", 45.764, 4.8357, "Europe/Paris", "EUR", 3), location("Marseille", "marseille", 43.2965, 5.3698, "Europe/Paris", "EUR", 4), location("Bordeaux", "bordeaux", 44.8378, -0.5792, "Europe/Paris", "EUR", 5),
  ] },
  { name: "Germany", code: "DE", currencyCode: "EUR", isActive: true, locations: [
    location("Berlin", "berlin", 52.52, 13.405, "Europe/Berlin", "EUR", 1), location("Munich", "munich", 48.1351, 11.582, "Europe/Berlin", "EUR", 2), location("Hamburg", "hamburg", 53.5511, 9.9937, "Europe/Berlin", "EUR", 3), location("Frankfurt", "frankfurt", 50.1109, 8.6821, "Europe/Berlin", "EUR", 4), location("Cologne", "cologne", 50.9375, 6.9603, "Europe/Berlin", "EUR", 5),
  ] },
  { name: "Italy", code: "IT", currencyCode: "EUR", isActive: true, locations: [
    location("Rome", "rome", 41.9028, 12.4964, "Europe/Rome", "EUR", 1), location("Milan", "milan", 45.4642, 9.19, "Europe/Rome", "EUR", 2), location("Venice", "venice", 45.4408, 12.3155, "Europe/Rome", "EUR", 3), location("Florence", "florence", 43.7696, 11.2558, "Europe/Rome", "EUR", 4), location("Naples", "naples", 40.8518, 14.2681, "Europe/Rome", "EUR", 5),
  ] },
  { name: "Spain", code: "ES", currencyCode: "EUR", isActive: true, locations: [
    location("Madrid", "madrid", 40.4168, -3.7038, "Europe/Madrid", "EUR", 1), location("Barcelona", "barcelona", 41.3874, 2.1686, "Europe/Madrid", "EUR", 2), location("Seville", "seville", 37.3891, -5.9845, "Europe/Madrid", "EUR", 3), location("Valencia", "valencia", 39.4699, -0.3763, "Europe/Madrid", "EUR", 4), location("Malaga", "malaga", 36.7213, -4.4214, "Europe/Madrid", "EUR", 5),
  ] },
  { name: "Japan", code: "JP", currencyCode: "JPY", isActive: true, locations: [
    location("Tokyo", "tokyo", 35.6762, 139.6503, "Asia/Tokyo", "JPY", 1), location("Osaka", "osaka", 34.6937, 135.5023, "Asia/Tokyo", "JPY", 2), location("Kyoto", "kyoto", 35.0116, 135.7681, "Asia/Tokyo", "JPY", 3), location("Sapporo", "sapporo", 43.0618, 141.3545, "Asia/Tokyo", "JPY", 4), location("Fukuoka", "fukuoka", 33.5904, 130.4017, "Asia/Tokyo", "JPY", 5),
  ] },
  { name: "Singapore", code: "SG", currencyCode: "SGD", isActive: true, locations: [
    location("Singapore", "singapore", 1.3521, 103.8198, "Asia/Singapore", "SGD", 1), location("Marina Bay", "marina-bay", 1.2834, 103.8607, "Asia/Singapore", "SGD", 2, "LOCATION"), location("Sentosa", "sentosa", 1.2494, 103.8303, "Asia/Singapore", "SGD", 3, "LOCATION"), location("Orchard", "orchard", 1.3048, 103.8318, "Asia/Singapore", "SGD", 4, "LOCATION"), location("Clarke Quay", "clarke-quay", 1.2906, 103.8462, "Asia/Singapore", "SGD", 5, "LOCATION"),
  ] },
  { name: "Thailand", code: "TH", currencyCode: "THB", isActive: true, locations: [
    location("Bangkok", "bangkok", 13.7563, 100.5018, "Asia/Bangkok", "THB", 1), location("Phuket", "phuket", 7.8804, 98.3923, "Asia/Bangkok", "THB", 2), location("Chiang Mai", "chiang-mai", 18.7883, 98.9853, "Asia/Bangkok", "THB", 3), location("Pattaya", "pattaya", 12.9236, 100.8825, "Asia/Bangkok", "THB", 4), location("Krabi", "krabi", 8.0863, 98.9063, "Asia/Bangkok", "THB", 5),
  ] },
  { name: "Australia", code: "AU", currencyCode: "AUD", isActive: true, locations: [
    location("Sydney", "sydney", -33.8688, 151.2093, "Australia/Sydney", "AUD", 1), location("Melbourne", "melbourne", -37.8136, 144.9631, "Australia/Melbourne", "AUD", 2), location("Brisbane", "brisbane", -27.4698, 153.0251, "Australia/Brisbane", "AUD", 3), location("Perth", "perth", -31.9505, 115.8605, "Australia/Perth", "AUD", 4), location("Gold Coast", "gold-coast", -28.0167, 153.4, "Australia/Brisbane", "AUD", 5, "LOCATION"),
  ] },
  { name: "Canada", code: "CA", currencyCode: "CAD", isActive: true, locations: [
    location("Toronto", "toronto", 43.6532, -79.3832, "America/Toronto", "CAD", 1), location("Vancouver", "vancouver", 49.2827, -123.1207, "America/Vancouver", "CAD", 2), location("Montreal", "montreal", 45.5017, -73.5673, "America/Toronto", "CAD", 3), location("Calgary", "calgary", 51.0447, -114.0719, "America/Edmonton", "CAD", 4), location("Ottawa", "ottawa", 45.4215, -75.6972, "America/Toronto", "CAD", 5),
  ] },
  { name: "Brazil", code: "BR", currencyCode: "BRL", isActive: true, locations: [
    location("Rio de Janeiro", "rio-de-janeiro", -22.9068, -43.1729, "America/Sao_Paulo", "BRL", 1), location("São Paulo", "sao-paulo", -23.5558, -46.6396, "America/Sao_Paulo", "BRL", 2), location("Salvador", "salvador", -12.9777, -38.5016, "America/Bahia", "BRL", 3), location("Brasília", "brasilia", -15.7939, -47.8828, "America/Sao_Paulo", "BRL", 4), location("Florianópolis", "florianopolis", -27.5954, -48.548, "America/Sao_Paulo", "BRL", 5),
  ] },
  { name: "South Africa", code: "ZA", currencyCode: "ZAR", isActive: true, locations: [
    location("Cape Town", "cape-town", -33.9249, 18.4241, "Africa/Johannesburg", "ZAR", 1), location("Johannesburg", "johannesburg", -26.2041, 28.0473, "Africa/Johannesburg", "ZAR", 2), location("Durban", "durban", -29.8587, 31.0218, "Africa/Johannesburg", "ZAR", 3), location("Pretoria", "pretoria", -25.7479, 28.2293, "Africa/Johannesburg", "ZAR", 4), location("Port Elizabeth", "port-elizabeth", -33.9608, 25.6022, "Africa/Johannesburg", "ZAR", 5),
  ] },
  { name: "Turkey", code: "TR", currencyCode: "TRY", isActive: true, locations: [
    location("Istanbul", "istanbul", 41.0082, 28.9784, "Europe/Istanbul", "TRY", 1), location("Antalya", "antalya", 36.8969, 30.7133, "Europe/Istanbul", "TRY", 2), location("Ankara", "ankara", 39.9334, 32.8597, "Europe/Istanbul", "TRY", 3), location("Izmir", "izmir", 38.4237, 27.1428, "Europe/Istanbul", "TRY", 4), location("Cappadocia", "cappadocia", 38.6431, 34.8283, "Europe/Istanbul", "TRY", 5, "LOCATION"),
  ] },
  { name: "Egypt", code: "EG", currencyCode: "EGP", isActive: true, locations: [
    location("Cairo", "cairo", 30.0444, 31.2357, "Africa/Cairo", "EGP", 1), location("Alexandria", "alexandria", 31.2001, 29.9187, "Africa/Cairo", "EGP", 2), location("Sharm El Sheikh", "sharm-el-sheikh", 27.9158, 34.33, "Africa/Cairo", "EGP", 3), location("Hurghada", "hurghada", 27.2579, 33.8116, "Africa/Cairo", "EGP", 4), location("Luxor", "luxor", 25.6872, 32.6396, "Africa/Cairo", "EGP", 5),
  ] },
  { name: "Malaysia", code: "MY", currencyCode: "MYR", isActive: true, locations: [
    location("Kuala Lumpur", "kuala-lumpur", 3.139, 101.6869, "Asia/Kuala_Lumpur", "MYR", 1), location("Penang", "penang", 5.4141, 100.3288, "Asia/Kuala_Lumpur", "MYR", 2, "LOCATION"), location("Langkawi", "langkawi", 6.35, 99.8, "Asia/Kuala_Lumpur", "MYR", 3, "LOCATION"), location("Johor Bahru", "johor-bahru", 1.4927, 103.7414, "Asia/Kuala_Lumpur", "MYR", 4), location("Kota Kinabalu", "kota-kinabalu", 5.9804, 116.0735, "Asia/Kuching", "MYR", 5),
  ] },
  { name: "Indonesia", code: "ID", currencyCode: "IDR", isActive: true, locations: [
    location("Bali", "bali", -8.4095, 115.1889, "Asia/Makassar", "IDR", 1, "LOCATION"), location("Jakarta", "jakarta", -6.2088, 106.8456, "Asia/Jakarta", "IDR", 2), location("Yogyakarta", "yogyakarta", -7.7956, 110.3695, "Asia/Jakarta", "IDR", 3), location("Bandung", "bandung", -6.9175, 107.6191, "Asia/Jakarta", "IDR", 4), location("Lombok", "lombok", -8.65, 116.3249, "Asia/Makassar", "IDR", 5, "LOCATION"),
  ] },
] as const satisfies readonly SeedCountry[];

export const CURATED_LOCATION_COUNT = CURATED_LOCATION_COUNTRIES.reduce(
  (total, country) => total + country.locations.length,
  0,
);

export function validateCuratedLocationSeed(): void {
  if (CURATED_LOCATION_COUNTRIES.length !== 20 || CURATED_LOCATION_COUNT !== 100) {
    throw new Error(`Expected 20 countries and 100 locations; received ${CURATED_LOCATION_COUNTRIES.length} countries and ${CURATED_LOCATION_COUNT} locations.`);
  }
  const countryCodes = new Set<string>();
  const slugs = new Set<string>();
  for (const country of CURATED_LOCATION_COUNTRIES) {
    if (countryCodes.has(country.code) || country.locations.length !== 5) {
      throw new Error(`Country ${country.code} must be unique and contain exactly five locations.`);
    }
    countryCodes.add(country.code);
    for (const item of country.locations) {
      if (slugs.has(item.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) {
        throw new Error(`Location slug '${item.slug}' must be globally unique and normalized.`);
      }
      if (item.currencyCode !== country.currencyCode || item.latitude < -90 || item.latitude > 90 || item.longitude < -180 || item.longitude > 180) {
        throw new Error(`Invalid country, currency, or coordinates for ${item.name}.`);
      }
      slugs.add(item.slug);
    }
  }
}
