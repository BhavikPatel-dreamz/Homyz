/**
 * Centralized Country Code Dataset and Utilities for Homyz
 */
import { normalizePhone, isValidE164Phone } from "./normalization";

export interface Country {
  name: string;
  code: string;
  iso2: string;
  flag: string;
  placeholder: string;
  minLength: number;
  maxLength: number;
}

export const COUNTRY_CODES: Country[] = [
  { name: "Italy", code: "+39", iso2: "IT", flag: "🇮🇹", placeholder: "3XX XXX XXXX", minLength: 9, maxLength: 10 },
  { name: "United States", code: "+1", iso2: "US", flag: "🇺🇸", placeholder: "5XX XXX XXXX", minLength: 10, maxLength: 10 },
  { name: "Canada", code: "+1", iso2: "CA", flag: "🇨🇦", placeholder: "5XX XXX XXXX", minLength: 10, maxLength: 10 },
  { name: "United Kingdom", code: "+44", iso2: "GB", flag: "🇬🇧", placeholder: "7XXX XXXXXX", minLength: 10, maxLength: 10 },
  { name: "France", code: "+33", iso2: "FR", flag: "🇫🇷", placeholder: "6 XX XX XX XX", minLength: 9, maxLength: 9 },
  { name: "Germany", code: "+49", iso2: "DE", flag: "🇩🇪", placeholder: "17X XXXXXXXX", minLength: 10, maxLength: 11 },
  { name: "Spain", code: "+34", iso2: "ES", flag: "🇪🇸", placeholder: "6XX XXX XXX", minLength: 9, maxLength: 9 },
  { name: "Switzerland", code: "+41", iso2: "CH", flag: "🇨🇭", placeholder: "7X XXX XX XX", minLength: 9, maxLength: 9 },
  { name: "Austria", code: "+43", iso2: "AT", flag: "🇦🇹", placeholder: "6XX XXXXXXX", minLength: 10, maxLength: 13 },
  { name: "Netherlands", code: "+31", iso2: "NL", flag: "🇳🇱", placeholder: "6 XXXXXXXX", minLength: 9, maxLength: 9 },
  { name: "Belgium", code: "+32", iso2: "BE", flag: "🇧🇪", placeholder: "4XX XX XX XX", minLength: 9, maxLength: 9 },
  { name: "Australia", code: "+61", iso2: "AU", flag: "🇦🇺", placeholder: "4XX XXX XXX", minLength: 9, maxLength: 9 },
  { name: "India", code: "+91", iso2: "IN", flag: "🇮🇳", placeholder: "9XX XXX XXXX", minLength: 10, maxLength: 10 },
  { name: "United Arab Emirates", code: "+971", iso2: "AE", flag: "🇦🇪", placeholder: "5X XXX XXXX", minLength: 9, maxLength: 9 },
  { name: "Saudi Arabia", code: "+966", iso2: "SA", flag: "🇸🇦", placeholder: "5XX XXX XXX", minLength: 9, maxLength: 9 },
  { name: "Japan", code: "+81", iso2: "JP", flag: "🇯🇵", placeholder: "90 XXXX XXXX", minLength: 10, maxLength: 10 },
  { name: "China", code: "+86", iso2: "CN", flag: "🇨🇳", placeholder: "13X XXXX XXXX", minLength: 11, maxLength: 11 },
  { name: "Brazil", code: "+55", iso2: "BR", flag: "🇧🇷", placeholder: "11 9XXXX XXXX", minLength: 10, maxLength: 11 },
  { name: "Mexico", code: "+52", iso2: "MX", flag: "🇲🇽", placeholder: "55 XXXX XXXX", minLength: 10, maxLength: 10 },
  { name: "Singapore", code: "+65", iso2: "SG", flag: "🇸🇬", placeholder: "8XXX XXXX", minLength: 8, maxLength: 8 },
  { name: "Portugal", code: "+351", iso2: "PT", flag: "🇵🇹", placeholder: "9X XXX XXXX", minLength: 9, maxLength: 9 },
  { name: "Greece", code: "+30", iso2: "GR", flag: "🇬🇷", placeholder: "69X XXX XXXX", minLength: 10, maxLength: 10 },
  { name: "Sweden", code: "+46", iso2: "SE", flag: "🇸🇪", placeholder: "7X XXX XX XX", minLength: 9, maxLength: 9 },
  { name: "Norway", code: "+47", iso2: "NO", flag: "🇳🇴", placeholder: "4XX XX XXX", minLength: 8, maxLength: 8 },
  { name: "Denmark", code: "+45", iso2: "DK", flag: "🇩🇰", placeholder: "2X XX XX XX", minLength: 8, maxLength: 8 },
  { name: "Finland", code: "+358", iso2: "FI", flag: "🇫🇮", placeholder: "40 123 4567", minLength: 9, maxLength: 10 },
  { name: "Poland", code: "+48", iso2: "PL", flag: "🇵🇱", placeholder: "5XX XXX XXX", minLength: 9, maxLength: 9 },
  { name: "Ireland", code: "+353", iso2: "IE", flag: "🇮🇪", placeholder: "8X XXX XXXX", minLength: 9, maxLength: 9 },
  { name: "Turkey", code: "+90", iso2: "TR", flag: "🇹🇷", placeholder: "5XX XXX XX XX", minLength: 10, maxLength: 10 },
  { name: "South Africa", code: "+27", iso2: "ZA", flag: "🇿🇦", placeholder: "8X XXX XXXX", minLength: 9, maxLength: 9 },
];

export function getAllCountries(): Country[] {
  return COUNTRY_CODES;
}

export function getCountryByIso2(iso2: string): Country | undefined {
  return COUNTRY_CODES.find((c) => c.iso2.toUpperCase() === iso2.toUpperCase());
}

export function getCountryByCallingCode(code: string): Country | undefined {
  const normalized = code.startsWith("+") ? code : `+${code}`;
  return COUNTRY_CODES.find((c) => c.code === normalized);
}

export function getCountriesByCallingCode(code: string): Country[] {
  const normalized = code.startsWith("+") ? code : `+${code}`;
  return COUNTRY_CODES.filter((c) => c.code === normalized);
}

export function searchCountries(query: string): Country[] {
  if (!query) return COUNTRY_CODES;
  const q = query.trim().toLowerCase();
  return COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.iso2.toLowerCase().includes(q)
  );
}

export { normalizePhone as normalizePhoneNumber, isValidE164Phone as validatePhoneNumber };
