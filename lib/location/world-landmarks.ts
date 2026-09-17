/**
 * Production-grade World Landmarks, POIs, Airports, Stations & Urban Localities Registry
 * Provides instant (<1ms), offline-resilient, typo-tolerant location search
 * for high-priority global travel destinations (Dubai, Saudi Arabia, India, UK, France, US, etc.).
 */

import type { UnifiedLocationSuggestion, LocationType } from "./places-provider";

export interface LandmarkRecord {
  id: string;
  name: string;
  aliases: string[];
  city: string;
  state?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  type: LocationType;
  defaultRadiusKm: number;
  category?: string;
}

export const WORLD_LANDMARKS: LandmarkRecord[] = [
  // ── Dubai & UAE ─────────────────────────────────────────────────────────────
  {
    id: "landmark_burj_khalifa",
    name: "Burj Khalifa",
    aliases: ["burj khalifa", "burj kalifa", "khalifa tower", "burjkhalifa", "برج خليفة", "tallest building", "burj khalifa dubai"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1972,
    longitude: 55.2744,
    type: "landmark",
    defaultRadiusKm: 5,
  },
  {
    id: "landmark_dubai_mall",
    name: "Dubai Mall",
    aliases: ["dubai mall", "the dubai mall", "dubaimall", "دبي مول", "mall dubai"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1985,
    longitude: 55.2796,
    type: "landmark",
    defaultRadiusKm: 5,
  },
  {
    id: "landmark_burj_al_arab",
    name: "Burj Al Arab",
    aliases: ["burj al arab", "burj alarab", "burjalarab", "برج العرب"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1412,
    longitude: 55.1852,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "area_dubai_marina",
    name: "Dubai Marina",
    aliases: ["dubai marina", "dubia marina", "marina dubai", "دبي مارينا", "marina walk"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.0805,
    longitude: 55.1403,
    type: "neighborhood",
    defaultRadiusKm: 6,
  },
  {
    id: "area_palm_jumeirah",
    name: "Palm Jumeirah",
    aliases: ["palm jumeirah", "the palm", "palm island", "نخلة جميرا", "palm dubai"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1124,
    longitude: 55.139,
    type: "neighborhood",
    defaultRadiusKm: 8,
  },
  {
    id: "area_jbr",
    name: "Jumeirah Beach Residence (JBR)",
    aliases: ["jbr", "jumeirah beach residence", "jbr walk", "jbr beach"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.0784,
    longitude: 55.1328,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "beach_jumeirah_beach",
    name: "Jumeirah Beach",
    aliases: ["jumeirah beach", "jumera beach", "jumerah beach", "شاطئ جميرا", "jumeira beach"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1444,
    longitude: 55.1903,
    type: "beach",
    defaultRadiusKm: 6,
  },
  {
    id: "area_downtown_dubai",
    name: "Downtown Dubai",
    aliases: ["downtown dubai", "downtown", "وسط مدينة دبي", "dubai downtown"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.195,
    longitude: 55.278,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "street_sheikh_zayed_road",
    name: "Sheikh Zayed Road",
    aliases: ["sheikh zayed road", "szr", "shaikh zayed road", "شارع الشيخ زايد"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.18,
    longitude: 55.25,
    type: "street",
    defaultRadiusKm: 8,
  },
  {
    id: "mall_of_the_emirates",
    name: "Mall of the Emirates",
    aliases: ["mall of the emirates", "mote", "ski dubai mall", "مول الإمارات"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1181,
    longitude: 55.2006,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "airport_dubai_international",
    name: "Dubai International Airport (DXB)",
    aliases: ["dubai international airport", "dxb", "dubai airport", "مطار دبي الدولي"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2532,
    longitude: 55.3657,
    type: "station",
    defaultRadiusKm: 12,
  },
  {
    id: "station_dubai_mall_metro",
    name: "Dubai Mall Metro Station",
    aliases: ["dubai mall metro", "dubai mall metro station", "burj khalifa metro station"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2005,
    longitude: 55.2703,
    type: "station",
    defaultRadiusKm: 5,
  },
  {
    id: "area_burjuman",
    name: "Burjuman",
    aliases: ["burjuman", "bur juman", "burjuman mall", "برجمان"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2526,
    longitude: 55.3025,
    type: "area",
    defaultRadiusKm: 6,
  },
  {
    id: "area_business_bay",
    name: "Business Bay",
    aliases: ["business bay", "الخليج التجاري", "business bay dubai"],
    city: "Dubai",
    state: "Dubai Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.1862,
    longitude: 55.2638,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "landmark_louvre_abu_dhabi",
    name: "Louvre Abu Dhabi",
    aliases: ["louvre abu dhabi", "louvre abudhabi", "متحف اللوفر أبوظبي"],
    city: "Abu Dhabi",
    state: "Abu Dhabi Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 24.5337,
    longitude: 54.3982,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "landmark_sheikh_zayed_grand_mosque",
    name: "Sheikh Zayed Grand Mosque",
    aliases: ["sheikh zayed grand mosque", "grand mosque abu dhabi", "جامع الشيخ زايد الكبير"],
    city: "Abu Dhabi",
    state: "Abu Dhabi Emirate",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 24.4128,
    longitude: 54.475,
    type: "landmark",
    defaultRadiusKm: 10,
  },

  // ── Saudi Arabia ────────────────────────────────────────────────────────────
  {
    id: "landmark_kingdom_centre",
    name: "Kingdom Centre",
    aliases: ["kingdom centre", "kingdom tower", "kingdom tower riyadh", "مركز المملكة", "برج المملكة"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.7114,
    longitude: 46.6744,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_al_faisaliah_tower",
    name: "Al Faisaliah Tower",
    aliases: ["al faisaliah tower", "faisaliah", "برج الفيصلية"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.6903,
    longitude: 46.6853,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_king_saud_university",
    name: "King Saud University",
    aliases: ["king saud university", "ksu", "جامعة الملك سعود"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.7162,
    longitude: 46.619,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "landmark_boulevard_riyadh_city",
    name: "Boulevard Riyadh City",
    aliases: ["boulevard riyadh city", "riyadh boulevard", "بوليفارد رياض سيتي"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.7698,
    longitude: 46.6025,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "airport_king_khalid_international",
    name: "King Khalid International Airport (RUH)",
    aliases: ["king khalid international airport", "ruh airport", "riyadh airport", "مطار الملك خالد الدولي"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.9576,
    longitude: 46.6988,
    type: "station",
    defaultRadiusKm: 15,
  },
  {
    id: "area_al_olaya",
    name: "Al Olaya",
    aliases: ["al olaya", "al ulayya", "olaya", "العليا", "al ulayya riyadh"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.7059,
    longitude: 46.6902,
    type: "neighborhood",
    defaultRadiusKm: 6,
  },
  {
    id: "area_al_malqa",
    name: "Al Malqa",
    aliases: ["al malqa", "malqa", "الملقا"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.81,
    longitude: 46.6,
    type: "neighborhood",
    defaultRadiusKm: 6,
  },
  {
    id: "area_hittin",
    name: "Hittin",
    aliases: ["hittin", "hatteen", "حطين"],
    city: "Riyadh",
    state: "Riyadh Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 24.76,
    longitude: 46.61,
    type: "neighborhood",
    defaultRadiusKm: 6,
  },
  {
    id: "airport_king_abdulaziz_jeddah",
    name: "King Abdulaziz International Airport (JED)",
    aliases: ["king abdulaziz international airport", "jeddah airport", "مطار الملك عبد العزيز الدولي"],
    city: "Jeddah",
    state: "Makkah Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 21.6796,
    longitude: 39.1565,
    type: "station",
    defaultRadiusKm: 15,
  },
  {
    id: "beach_jeddah_corniche",
    name: "Jeddah Corniche",
    aliases: ["jeddah corniche", "corniche jeddah", "كورنيش جدة"],
    city: "Jeddah",
    state: "Makkah Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 21.5433,
    longitude: 39.1228,
    type: "beach",
    defaultRadiusKm: 8,
  },
  {
    id: "landmark_al_balad",
    name: "Al Balad Historic District",
    aliases: ["al balad", "old jeddah", "historic jeddah", "البلد جدة"],
    city: "Jeddah",
    state: "Makkah Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 21.4858,
    longitude: 39.1866,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_elephant_rock",
    name: "Elephant Rock (Jabal AlFil)",
    aliases: ["elephant rock", "jabal alfil", "جبل الفيل", "alula elephant rock"],
    city: "AlUla",
    state: "Madinah Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 26.6953,
    longitude: 37.9944,
    type: "landmark",
    defaultRadiusKm: 15,
  },
  {
    id: "landmark_hegra",
    name: "Hegra (Madain Saleh)",
    aliases: ["hegra", "madain saleh", "mada'in saleh", "الحجر", "مدائن صالح"],
    city: "AlUla",
    state: "Madinah Province",
    country: "Saudi Arabia",
    countryCode: "SA",
    latitude: 26.8,
    longitude: 37.95,
    type: "landmark",
    defaultRadiusKm: 20,
  },

  // ── India ───────────────────────────────────────────────────────────────────
  {
    id: "station_surat_railway",
    name: "Surat Railway Station",
    aliases: ["surat railway station", "surt station", "surat station", "surat train station"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.2048,
    longitude: 72.8411,
    type: "station",
    defaultRadiusKm: 6,
  },
  {
    id: "beach_dumas_beach",
    name: "Dumas Beach",
    aliases: ["dumas beach", "dumas", "dumas surat", "dumus beach", "dumas sea face"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.0772,
    longitude: 72.7013,
    type: "beach",
    defaultRadiusKm: 10,
  },
  {
    id: "area_adajan_surat",
    name: "Adajan",
    aliases: ["adajan", "adajan surat", "adajan gam"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.1963,
    longitude: 72.794,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "area_vesu_surat",
    name: "Vesu",
    aliases: ["vesu", "vesu surat", "vesu road"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.1442,
    longitude: 72.7758,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "area_piplod_surat",
    name: "Piplod",
    aliases: ["piplod", "piplod surat", "piplod dumas road"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.161,
    longitude: 72.778,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "area_city_light_surat",
    name: "City Light",
    aliases: ["city light", "citylight surat", "city light surat"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.171,
    longitude: 72.788,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "street_station_road_surat",
    name: "Station Road",
    aliases: ["station road surat", "station road", "railway station road surat"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.2,
    longitude: 72.835,
    type: "street",
    defaultRadiusKm: 5,
  },
  {
    id: "airport_surat",
    name: "Surat International Airport (STV)",
    aliases: ["surat international airport", "surat airport", "stv airport"],
    city: "Surat",
    state: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 21.1141,
    longitude: 72.7417,
    type: "station",
    defaultRadiusKm: 12,
  },
  {
    id: "landmark_gateway_of_india",
    name: "Gateway of India",
    aliases: ["gateway of india", "gateway of india mumbai", "colaba gateway"],
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 18.922,
    longitude: 72.8347,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "area_bandra_mumbai",
    name: "Bandra",
    aliases: ["bandra", "bandra west", "bandra mumbai"],
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 19.0596,
    longitude: 72.8295,
    type: "neighborhood",
    defaultRadiusKm: 6,
  },
  {
    id: "beach_juhu_mumbai",
    name: "Juhu Beach",
    aliases: ["juhu beach", "juhu", "juhu beach mumbai"],
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 19.0988,
    longitude: 72.8264,
    type: "beach",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_marine_drive",
    name: "Marine Drive",
    aliases: ["marine drive", "queens necklace", "marine drive mumbai"],
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 18.9432,
    longitude: 72.823,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_india_gate",
    name: "India Gate",
    aliases: ["india gate", "india gate delhi", "new delhi india gate"],
    city: "Delhi",
    state: "Delhi",
    country: "India",
    countryCode: "IN",
    latitude: 28.6129,
    longitude: 77.2295,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "hospital_apollo",
    name: "Apollo Hospital",
    aliases: ["apollo hospital", "apollo hospitals"],
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 19.018,
    longitude: 73.018,
    type: "landmark",
    defaultRadiusKm: 10,
  },

  // ── United Kingdom ──────────────────────────────────────────────────────────
  {
    id: "landmark_big_ben",
    name: "Big Ben",
    aliases: ["big ben", "elizabeth tower", "big ben london", "houses of parliament"],
    city: "London",
    state: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5007,
    longitude: -0.1246,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_london_eye",
    name: "London Eye",
    aliases: ["london eye", "the london eye", "millennium wheel"],
    city: "London",
    state: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5033,
    longitude: -0.1195,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_tower_bridge",
    name: "Tower Bridge",
    aliases: ["tower bridge", "tower bridge london", "london bridge"],
    city: "London",
    state: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5055,
    longitude: -0.0754,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "area_soho_london",
    name: "Soho",
    aliases: ["soho", "soho london", "west end soho"],
    city: "London",
    state: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5136,
    longitude: -0.1365,
    type: "neighborhood",
    defaultRadiusKm: 5,
  },
  {
    id: "area_westminster",
    name: "Westminster",
    aliases: ["westminster", "city of westminster", "westminster london"],
    city: "London",
    state: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.4975,
    longitude: -0.1357,
    type: "neighborhood",
    defaultRadiusKm: 6,
  },
  {
    id: "airport_heathrow",
    name: "Heathrow Airport (LHR)",
    aliases: ["heathrow airport", "london heathrow", "lhr airport", "heathrow"],
    city: "London",
    state: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.47,
    longitude: -0.4543,
    type: "station",
    defaultRadiusKm: 15,
  },

  // ── France ──────────────────────────────────────────────────────────────────
  {
    id: "landmark_eiffel_tower",
    name: "Eiffel Tower",
    aliases: ["eiffel tower", "tour eiffel", "eiffel", "effel tower", "eiffle tower", "la tour eiffel"],
    city: "Paris",
    state: "Île-de-France",
    country: "France",
    countryCode: "FR",
    latitude: 48.8584,
    longitude: 2.2945,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_louvre_paris",
    name: "Louvre Museum",
    aliases: ["louvre", "louvre museum", "musee du louvre", "the louvre"],
    city: "Paris",
    state: "Île-de-France",
    country: "France",
    countryCode: "FR",
    latitude: 48.8606,
    longitude: 2.3376,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_arc_de_triomphe",
    name: "Arc de Triomphe",
    aliases: ["arc de triomphe", "champs elysees", "champs-elysees"],
    city: "Paris",
    state: "Île-de-France",
    country: "France",
    countryCode: "FR",
    latitude: 48.8738,
    longitude: 2.295,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_disneyland_paris",
    name: "Disneyland Paris",
    aliases: ["disneyland paris", "euro disney", "disneyland", "disney paris"],
    city: "Paris",
    state: "Île-de-France",
    country: "France",
    countryCode: "FR",
    latitude: 48.8722,
    longitude: 2.7758,
    type: "landmark",
    defaultRadiusKm: 15,
  },
  {
    id: "airport_charles_de_gaulle",
    name: "Charles de Gaulle Airport (CDG)",
    aliases: ["charles de gaulle airport", "cdg airport", "paris cdg", "roissy airport"],
    city: "Paris",
    state: "Île-de-France",
    country: "France",
    countryCode: "FR",
    latitude: 49.0097,
    longitude: 2.5479,
    type: "station",
    defaultRadiusKm: 18,
  },

  // ── United States ───────────────────────────────────────────────────────────
  {
    id: "landmark_times_square",
    name: "Times Square",
    aliases: ["times square", "time square", "times square nyc", "times square new york"],
    city: "New York",
    state: "New York",
    country: "United States",
    countryCode: "US",
    latitude: 40.758,
    longitude: -73.9855,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "area_manhattan",
    name: "Manhattan",
    aliases: ["manhattan", "manhattan new york", "nyc manhattan", "midtown manhattan"],
    city: "New York",
    state: "New York",
    country: "United States",
    countryCode: "US",
    latitude: 40.7831,
    longitude: -73.9712,
    type: "neighborhood",
    defaultRadiusKm: 8,
  },
  {
    id: "landmark_central_park",
    name: "Central Park",
    aliases: ["central park", "central park nyc", "central park new york"],
    city: "New York",
    state: "New York",
    country: "United States",
    countryCode: "US",
    latitude: 40.7851,
    longitude: -73.9683,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_empire_state_building",
    name: "Empire State Building",
    aliases: ["empire state building", "empire state", "esb"],
    city: "New York",
    state: "New York",
    country: "United States",
    countryCode: "US",
    latitude: 40.7484,
    longitude: -73.9857,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "airport_jfk",
    name: "John F. Kennedy International Airport (JFK)",
    aliases: ["jfk airport", "jfk", "kennedy airport", "new york jfk"],
    city: "New York",
    state: "New York",
    country: "United States",
    countryCode: "US",
    latitude: 40.6413,
    longitude: -73.7781,
    type: "station",
    defaultRadiusKm: 18,
  },

  // ── Other Global Icons ──────────────────────────────────────────────────────
  {
    id: "landmark_marina_bay_sands",
    name: "Marina Bay Sands",
    aliases: ["marina bay sands", "mbs singapore", "marina bay"],
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    latitude: 1.2834,
    longitude: 103.8607,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "airport_changi",
    name: "Singapore Changi Airport (SIN)",
    aliases: ["changi airport", "singapore airport", "sin airport"],
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    latitude: 1.3644,
    longitude: 103.9915,
    type: "station",
    defaultRadiusKm: 10,
  },
  {
    id: "landmark_tokyo_tower",
    name: "Tokyo Tower",
    aliases: ["tokyo tower", "東京タワー"],
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    latitude: 35.6586,
    longitude: 139.7454,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "landmark_shibuya_crossing",
    name: "Shibuya Crossing",
    aliases: ["shibuya crossing", "shibuya scramble", "shibuya"],
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    latitude: 35.6595,
    longitude: 139.7005,
    type: "landmark",
    defaultRadiusKm: 6,
  },
  {
    id: "landmark_colosseum",
    name: "Colosseum",
    aliases: ["colosseum", "colosseo", "flavian amphitheatre", "rome colosseum"],
    city: "Rome",
    country: "Italy",
    countryCode: "IT",
    latitude: 41.8902,
    longitude: 12.4922,
    type: "landmark",
    defaultRadiusKm: 8,
  },
  {
    id: "landmark_sagrada_familia",
    name: "Sagrada Família",
    aliases: ["sagrada familia", "basilica de la sagrada familia", "sagrada familia barcelona"],
    city: "Barcelona",
    country: "Spain",
    countryCode: "ES",
    latitude: 41.4036,
    longitude: 2.1744,
    type: "landmark",
    defaultRadiusKm: 8,
  },
];

/**
 * Normalizes query string for robust fuzzy matching.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^\w\s\u0600-\u06FF]/g, " ") // retain word chars and Arabic
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const v0 = new Array(s2.length + 1);
  const v1 = new Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) v0[i] = i;

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
  }

  return v1[s2.length];
}

/**
 * Searches the world landmarks registry with typo tolerance and token scoring.
 */
export function searchWorldLandmarks(
  query: string,
  limit: number = 6
): UnifiedLocationSuggestion[] {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];

  const matches: { item: LandmarkRecord; score: number }[] = [];

  for (const lm of WORLD_LANDMARKS) {
    const normName = normalizeText(lm.name);
    let bestScore = -1;

    // 1. Exact match (Score: 1000)
    if (normName === q) {
      bestScore = 1000;
    }

    // 2. Prefix match on name (Score: 500)
    if (bestScore < 0 && normName.startsWith(q)) {
      bestScore = 500 + (q.length / normName.length) * 100;
    }

    // 3. Substring match on name (Score: 300)
    if (bestScore < 0 && normName.includes(q)) {
      bestScore = 300 + (q.length / normName.length) * 50;
    }

    // 4. Aliases & Typos match
    if (bestScore < 0) {
      for (const alias of lm.aliases) {
        const normAlias = normalizeText(alias);
        if (normAlias === q) {
          bestScore = Math.max(bestScore, 900);
          break;
        }
        if (normAlias.startsWith(q)) {
          bestScore = Math.max(bestScore, 450 + (q.length / normAlias.length) * 50);
          break;
        }
        if (normAlias.includes(q)) {
          bestScore = Math.max(bestScore, 250);
          break;
        }
      }
    }

    // 5. Typo tolerance: Levenshtein distance on full query or individual words
    if (bestScore < 0 && q.length >= 4) {
      // Check full alias distance
      for (const alias of [normName, ...lm.aliases.map(normalizeText)]) {
        const dist = levenshteinDistance(q, alias);
        // Allow up to 2 typos for medium strings, 3 for longer
        const maxDist = alias.length > 8 ? 3 : 2;
        if (dist <= maxDist) {
          bestScore = 200 - dist * 30;
          break;
        }

        // Check token-level distance (e.g. "surt" in "surt station" vs "surat")
        const qTokens = q.split(" ");
        const aliasTokens = alias.split(" ");
        let tokenMatches = 0;
        for (const qt of qTokens) {
          if (qt.length < 3) continue;
          for (const at of aliasTokens) {
            if (at.startsWith(qt) || levenshteinDistance(qt, at) <= 1) {
              tokenMatches++;
              break;
            }
          }
        }
        if (tokenMatches > 0 && tokenMatches >= Math.floor(qTokens.length / 2)) {
          bestScore = Math.max(bestScore, 150 + tokenMatches * 40);
          break;
        }
      }
    }

    if (bestScore > 0) {
      matches.push({ item: lm, score: bestScore });
    }
  }

  // Sort by highest match score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit).map(({ item }) => {
    const subParts = [item.name !== item.city ? item.city : null, item.state, item.country].filter(Boolean);
    return {
      id: `landmark_${item.id}`,
      name: item.name,
      fullAddress: [item.name, ...subParts].join(", "),
      city: item.city,
      state: item.state || "",
      country: item.country,
      countryCode: item.countryCode,
      latitude: item.latitude,
      longitude: item.longitude,
      locationType: item.type,
      providerPlaceId: `landmark:${item.id}`,
      provider: "osm", // compatible type signature
      distanceKm: item.defaultRadiusKm,
    };
  });
}

/**
 * Look up exact landmark coordinates by ID or normalized name.
 */
export function findLandmarkByNameOrId(term: string): LandmarkRecord | null {
  const norm = normalizeText(term);
  for (const lm of WORLD_LANDMARKS) {
    if (lm.id === term || normalizeText(lm.name) === norm) return lm;
    for (const a of lm.aliases) {
      if (normalizeText(a) === norm) return lm;
    }
  }
  return null;
}

