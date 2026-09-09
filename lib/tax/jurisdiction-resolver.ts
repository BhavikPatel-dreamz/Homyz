import { JURISDICTIONS_CATALOG } from "./jurisdictions-catalog";
import type { TaxJurisdictionDTO, TaxRuleDTO } from "./types";

export interface ResolvedJurisdiction {
  jurisdiction: TaxJurisdictionDTO;
  systemRules: TaxRuleDTO[];
}

/**
 * Normalizes ISO country input from various user formats (e.g. "Saudi Arabia", "KSA", "SA").
 */
export function normalizeCountryCode(country?: string | null): string {
  if (!country) return "SA";
  const upper = country.trim().toUpperCase();

  if (upper === "SA" || upper === "KSA" || upper.includes("SAUDI")) return "SA";
  if (upper === "AE" || upper === "UAE" || upper.includes("EMIRATES") || upper.includes("DUBAI")) return "AE";
  if (upper === "GB" || upper === "UK" || upper.includes("UNITED KINGDOM") || upper.includes("BRITAIN")) return "GB";
  if (upper === "US" || upper === "USA" || upper.includes("UNITED STATES") || upper.includes("AMERICA")) return "US";
  if (upper.length === 2) return upper;

  return "SA"; // Default platform base
}

/**
 * Resolves the appropriate tax jurisdiction and its canonical platform-managed
 * rules based on the listing's structured location.
 */
export function resolveTaxJurisdiction(location: {
  country?: string | null;
  city?: string | null;
  district?: string | null;
  postalCode?: string | null;
}): ResolvedJurisdiction {
  const countryCode = normalizeCountryCode(location.country);
  const city = location.city?.trim().toLowerCase() || "";

  // 1. City / Municipal Level Match
  if (countryCode === "SA") {
    if (city.includes("riyadh")) {
      return formatCatalogEntry(JURISDICTIONS_CATALOG.SA_RIYADH);
    }
    if (city.includes("jeddah")) {
      return formatCatalogEntry(JURISDICTIONS_CATALOG.SA_JEDDAH);
    }
    return formatCatalogEntry(JURISDICTIONS_CATALOG.SA_NATIONAL);
  }

  if (countryCode === "AE") {
    if (city.includes("dubai") || !city) {
      return formatCatalogEntry(JURISDICTIONS_CATALOG.AE_DUBAI);
    }
    return formatCatalogEntry(JURISDICTIONS_CATALOG.AE_DUBAI);
  }

  if (countryCode === "GB") {
    return formatCatalogEntry(JURISDICTIONS_CATALOG.GB_NATIONAL);
  }

  if (countryCode === "US") {
    if (city.includes("los angeles") || city.includes("la")) {
      return formatCatalogEntry(JURISDICTIONS_CATALOG.US_CA_LOS_ANGELES);
    }
    return formatCatalogEntry(JURISDICTIONS_CATALOG.US_CA_LOS_ANGELES);
  }

  // Fallback to default
  return formatCatalogEntry(JURISDICTIONS_CATALOG.DEFAULT_GLOBAL);
}

function formatCatalogEntry(entry: (typeof JURISDICTIONS_CATALOG)[string]): ResolvedJurisdiction {
  const jurisdiction = { ...entry.jurisdiction };
  const systemRules: TaxRuleDTO[] = entry.defaultRules.map((rule, idx) => ({
    ...rule,
    id: `sys_rule_${jurisdiction.id}_${idx}`,
    jurisdictionId: jurisdiction.id,
  }));

  return { jurisdiction, systemRules };
}

