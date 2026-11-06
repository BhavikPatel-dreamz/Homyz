import type { DataQualityWarning } from "./analytics-contracts";

/**
 * Computes a deterministic, stable identifier for a warning based on
 * its code, sorted affected metrics, and scope.
 */
export function getWarningIdentifier(warning: DataQualityWarning): string {
  const code = (warning.code || "WARNING").trim().toUpperCase();
  const metrics = (warning.affectedMetrics || []).slice().sort().join(",");
  const scope = (warning.scope || "global").toLowerCase();
  return `${code}::${metrics}::${scope}`;
}

/**
 * Normalizes and deduplicates an array of warnings.
 * Preserves distinct warnings while ensuring each logical warning
 * appears exactly once.
 */
export function normalizeDataQualityWarnings(
  warnings: (DataQualityWarning | null | undefined)[]
): DataQualityWarning[] {
  const seen = new Set<string>();
  const result: DataQualityWarning[] = [];

  for (const w of warnings) {
    if (!w || !w.message) continue;
    const id = getWarningIdentifier(w);
    if (!seen.has(id)) {
      seen.add(id);
      result.push({
        ...w,
        affectedMetrics: (w.affectedMetrics || []).slice(),
      });
    }
  }

  return result;
}

/**
 * Filters warnings relevant to a specific dashboard tab/view.
 * Scoped warnings only appear on matching tabs; global warnings appear on all tabs.
 * In overview, warnings for summarized domains (occupancy, revenue, operations) are included.
 */
export function filterWarningsForTab(
  warnings: (DataQualityWarning | null | undefined)[],
  activeTab: string
): DataQualityWarning[] {
  const normalized = normalizeDataQualityWarnings(warnings);
  return normalized.filter((w) => {
    const scope = w.scope || "global";
    if (scope === "global") return true;
    if (activeTab === "overview") {
      return (
        scope === "overview" ||
        scope === "occupancy" ||
        scope === "revenue" ||
        scope === "operations"
      );
    }
    return scope === activeTab;
  });
}

