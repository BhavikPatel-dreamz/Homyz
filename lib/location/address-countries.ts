import { getCountries } from "libphonenumber-js";

export type AddressCountry = {
  iso2: string;
  name: string;
  value: string;
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

/**
 * All countries and territories supported by the application's international
 * phone metadata. Keeping the ISO code in the persisted value makes the
 * selected country unambiguous for maps, verification, and tax rules.
 */
export const ADDRESS_COUNTRIES: AddressCountry[] = getCountries()
  .map((iso2) => {
    const name = countryNames.of(iso2) ?? iso2;
    return { iso2, name, value: `${name} - ${iso2}` };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

const COUNTRY_VALUE_BY_ISO2 = new Map(
  ADDRESS_COUNTRIES.map((country) => [country.iso2, country.value]),
);

const COUNTRY_VALUE_BY_NAME = new Map(
  ADDRESS_COUNTRIES.map((country) => [country.name.toLocaleLowerCase(), country.value]),
);

/**
 * Converts a country returned by Nominatim, a previously saved value, or an
 * ISO-3166 code into the value used by the address selector.
 */
export function formatAddressCountry(
  country?: string | null,
  countryCode?: string | null,
): string {
  const normalizedCode = countryCode?.trim().toUpperCase();
  if (normalizedCode && COUNTRY_VALUE_BY_ISO2.has(normalizedCode)) {
    return COUNTRY_VALUE_BY_ISO2.get(normalizedCode)!;
  }

  const normalizedCountry = country?.trim();
  if (!normalizedCountry) return "";

  const savedCode = normalizedCountry.match(/\s-\s([A-Za-z]{2})$/)?.[1]?.toUpperCase();
  if (savedCode && COUNTRY_VALUE_BY_ISO2.has(savedCode)) {
    return COUNTRY_VALUE_BY_ISO2.get(savedCode)!;
  }

  if (/^[A-Za-z]{2}$/.test(normalizedCountry)) {
    const value = COUNTRY_VALUE_BY_ISO2.get(normalizedCountry.toUpperCase());
    if (value) return value;
  }

  return COUNTRY_VALUE_BY_NAME.get(normalizedCountry.toLocaleLowerCase()) ?? normalizedCountry;
}
